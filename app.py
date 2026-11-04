"""NEhelp: a map that connects small businesses with the providers who can help them.

Run it with:  uv run app.py
Then open:    http://127.0.0.1:5050

Privacy is enforced here on the server, in three layers:
  1. Public facts (name, area, has a website?)   -> everyone
  2. Needs the owner chose to share               -> providers
  3. Private guesses ("signals")                  -> the owner only
A provider's browser never receives layer 3, so it can't leak through the page.
"""

import copy
import json
import os
import shutil
import subprocess
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory

load_dotenv()

BASE = Path(__file__).parent
SEED = json.loads((BASE / "data" / "sample_data.json").read_text())

NEEDS = SEED["needs"]
NEED_KEYS = [n["key"] for n in NEEDS]
NEED_LABELS = {n["key"]: n["label"] for n in NEEDS}
STATUSES = {"happy", "unhappy", "past", "none", "unknown"}
providers = {p["id"]: p for p in SEED["providers"]}

# Real businesses (names changed) from scripts/fetch_real_data.py. If that file exists it
# replaces the made-up unclaimed businesses; the signed-up profiles stay as samples.
REAL_FILE = BASE / "data" / "real_businesses.json"
real = json.loads(REAL_FILE.read_text()) if REAL_FILE.exists() else []
seed = [b for b in SEED["businesses"] if b["claimed"] or not real]

# Owner edits are kept in memory, so restarting the server resets the demo.
businesses = {b["id"]: b for b in copy.deepcopy(seed + real)}

# Public facts that reveal a gap even when a business hasn't signed up.
PUBLIC_GAPS = {"website": "has_website", "social_media": "has_social"}

app = Flask(__name__, static_folder="static", static_url_path="")


def get_business(business_id):
    b = businesses.get(business_id)
    if b is None:
        abort(404)
    return b


# ---------- The three privacy layers ----------

def public_view(b):
    """Layer 1: facts anyone could already find online."""
    view = {k: b[k] for k in ("id", "name", "type", "area", "lat", "lng", "claimed", "public")}
    view["real"] = b.get("real", False)
    return view


def match_for(b, need_key, provider_id):
    """What one provider is allowed to know about one need of one business."""
    label = NEED_LABELS[need_key]
    if not b["claimed"]:
        gap = PUBLIC_GAPS.get(need_key)
        # False means "checked and none listed"; None means "we don't know".
        if gap and b["public"].get(gap) is False:
            where = "on OpenStreetMap" if b.get("real") else "publicly"
            return {"need": need_key, "state": "public_gap", "text": f"No {label.lower()} listed {where}"}
        return {"need": need_key, "state": "no_info", "text": "Not on NEhelp yet"}

    need = b["needs"].get(need_key)
    if not need or not need["shared"]:
        return {"need": need_key, "state": "private", "text": f"{label}: not shared"}

    status = need["status"]
    match = {"need": need_key, "note": need["note"]}
    if need["provider"] == provider_id and status in ("happy", "unhappy"):
        # Your own customer: you see their rating and comment.
        match.update(
            state="customer_happy" if status == "happy" else "customer_unhappy",
            text=f"Your customer for {label.lower()}: {'happy' if status == 'happy' else 'not happy'}",
            rating=need["rating"],
            comment=need["comment"],
        )
    elif status in ("none", "past"):
        match.update(state="open", text=f"Wants help with {label.lower()}")
    elif status == "unhappy":
        # A lead, but we don't say which competitor they're unhappy with.
        match.update(state="open", text=f"Not happy with their current {label.lower()} provider")
    elif status == "happy":
        match.update(state="served", text=f"{label}: sorted with another provider")
    else:
        match.update(state="no_info", text=f"{label}: not filled in")
    return match


def provider_view(b, provider):
    """Layer 1 plus layer 2 (shared needs). Never includes private signals."""
    view = public_view(b)
    view["matches"] = [match_for(b, key, provider["id"]) for key in provider["categories"]]
    view["offers"] = b.get("offers", [])
    return view


# ---------- API ----------

@app.get("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.get("/api/meta")
def meta():
    return jsonify(
        needs=NEEDS,
        providers=list(providers.values()),
        claimed=[{"id": b["id"], "name": b["name"]} for b in businesses.values() if b["claimed"]],
        adviser_ready=adviser_backend() is not None,
    )


@app.get("/api/businesses")
def all_public():
    return jsonify([public_view(b) for b in businesses.values()])


@app.get("/api/business/<business_id>")
def owner_view(business_id):
    # Demo only: there are no logins yet, so anyone can open the owner view.
    return jsonify(get_business(business_id))


@app.put("/api/business/<business_id>/needs")
def update_needs(business_id):
    b = get_business(business_id)
    if not b["claimed"]:
        abort(400, "This business hasn't signed up.")
    incoming = request.get_json(force=True)
    for key, need in incoming.items():
        if key not in NEED_KEYS or need.get("status") not in STATUSES:
            abort(400, f"Bad need: {key}")
        rating = need.get("rating")
        if rating is not None and rating not in range(1, 6):
            abort(400, "Rating must be 1 to 5.")
        provider = need.get("provider")
        if provider not in providers and provider not in (None, "other"):
            abort(400, "Unknown provider.")
        b["needs"][key] = {
            "status": need["status"],
            "provider": provider,
            "rating": rating,
            "comment": str(need.get("comment", ""))[:280],
            "note": str(need.get("note", ""))[:280],
            "shared": bool(need.get("shared")),
        }
    return jsonify(b)


@app.get("/api/provider/<provider_id>/map")
def provider_map(provider_id):
    provider = providers.get(provider_id)
    if provider is None:
        abort(404)
    return jsonify([provider_view(b, provider) for b in businesses.values()])


# ---------- Claude adviser ----------

ADVISER_PROMPT = """You are a business adviser for UK small businesses, built into NEhelp, a map that \
connects small businesses with providers such as banks, accountants and marketing agencies.

You'll get one business's profile as JSON: what it uses now, what it used before, how happy the \
owner is, the owner's notes, and some private guesses from public data. For each need, tell the \
owner honestly whether they need it.

- Be on the owner's side. Not every business needs a website or a marketing agency. Say so when \
that's true, and don't push paid services they don't need.
- Mention free or official help where it fits, such as GOV.UK, HMRC guidance or a local council \
business support service.
- Don't give regulated financial or legal advice. Suggest a qualified professional instead.
- Write in plain, warm English for a busy owner. Keep each reason and next step to one or two sentences.
- Cover every need in the profile, in the same order."""

ADVICE_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "advice": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "need": {"type": "string", "enum": NEED_KEYS},
                    "verdict": {
                        "type": "string",
                        "enum": ["sort_now", "worth_considering", "not_needed", "already_sorted"],
                    },
                    "reason": {"type": "string"},
                    "next_step": {"type": "string"},
                },
                "required": ["need", "verdict", "reason", "next_step"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "advice"],
    "additionalProperties": False,
}


def adviser_profile(b):
    """The owner's own data, with labels Claude can read. Only the owner sees the result."""
    def describe(need):
        provider = providers.get(need["provider"], {}).get("name")
        return {
            "status": need["status"],
            "provider": provider or ("another provider" if need["provider"] == "other" else None),
            "rating_out_of_5": need["rating"],
            "owner_comment": need["comment"],
            "owner_note": need["note"],
        }

    return {
        "business": {"name": b["name"], "type": b["type"], "area": f"{b['area']}, North East England"},
        "public_facts": b["public"],
        "needs": {NEED_LABELS[k]: describe(b["needs"][k]) for k in NEED_KEYS if k in b["needs"]},
        "offers": b.get("offers", []),
        "private_guesses": [s["text"] for s in b.get("signals", [])],
    }


def error(message, status):
    return jsonify(error=message), status


def adviser_backend():
    """Use the Claude API if there's a key; otherwise the Claude Code installed on this computer."""
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "api"
    if shutil.which("claude"):
        return "claude_code"
    return None


def ask_claude_code(system_prompt, schema, user_input):
    """Run Claude Code headless (`claude -p`). Uses your Claude login, so no API key is needed.

    For local demos only: a hosted version would need an API key.
    """
    command = [
        "claude", "-p",
        "--output-format", "json",
        "--json-schema", json.dumps(schema),
        "--system-prompt", system_prompt,
        "--tools", "",  # it only reads what we send; it gets no tools
        "--no-session-persistence",
    ]
    try:
        run = subprocess.run(command, input=user_input, capture_output=True, text=True, timeout=300, cwd=BASE)
    except subprocess.TimeoutExpired:
        return error("Claude took too long. Try again.", 504)
    try:
        result = json.loads(run.stdout)
    except json.JSONDecodeError:
        return error(f"Claude Code didn't answer. Is it signed in? {run.stderr.strip()[:200]}", 502)
    if result.get("is_error") or not result.get("structured_output"):
        return error(f"Claude couldn't answer: {str(result.get('result', ''))[:200]}", 502)
    return jsonify(result["structured_output"])


def advise_with_claude_code(profile):
    return ask_claude_code(ADVISER_PROMPT, ADVICE_SCHEMA, json.dumps(profile, indent=2))


# ---------- Request drafting (the "Turn into a request" button) ----------

REQUEST_CATEGORIES = ["Finance", "Marketing", "Employment"]

DRAFT_PROMPT = """You help small business owners in the North East of England ask for help on NEhelp. \
Larger local companies lend staff with spare time to help them.

You'll get the owner's own words about what's wrong, plus a little about their business. Turn it into \
one clear request a company could pick up:
- title: 2 to 5 words, like "Website refresh" or "Invoice setup".
- cat: the best fit of Finance, Marketing or Employment.
- check: 2 to 5 short, concrete tasks, each starting with a verb.
- help: "Free" unless the owner says they can pay or want a discount.
- hours: a realistic estimate of hours of work for a skilled helper.
- desc: one plain sentence describing the need, written for the helper.
Only include what the owner asked for. If they mention two unrelated problems, pick the main one \
and mention the other in desc."""

DRAFT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "cat": {"type": "string", "enum": REQUEST_CATEGORIES},
        "check": {"type": "array", "items": {"type": "string"}},
        "help": {"type": "string", "enum": ["Free", "Discounted", "Paid"]},
        "hours": {"type": "integer"},
        "desc": {"type": "string"},
    },
    "required": ["title", "cat", "check", "help", "hours", "desc"],
    "additionalProperties": False,
}


@app.post("/api/draft-request")
def draft_request():
    body = request.get_json(force=True)
    text = str(body.get("text", "")).strip()[:2000]
    if not text:
        return error("Tell us what would help first.", 400)
    business = body.get("business") or {}
    user_input = json.dumps({
        "owner_says": text,
        "business": {k: str(business.get(k, ""))[:100] for k in ("name", "kind", "area")},
    }, indent=2)

    backend = adviser_backend()
    if backend == "claude_code":
        return ask_claude_code(DRAFT_PROMPT, DRAFT_SCHEMA, user_input)
    if backend is None:
        return error("Claude isn't set up on this computer.", 503)
    try:
        response = anthropic.Anthropic().beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=16000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low", "format": {"type": "json_schema", "schema": DRAFT_SCHEMA}},
            system=DRAFT_PROMPT,
            messages=[{"role": "user", "content": user_input}],
        )
    except anthropic.APIError as e:
        return error(f"Claude API error: {e}", 502)
    if response.stop_reason in ("refusal", "max_tokens"):
        return error("Claude couldn't draft this one.", 502)
    return jsonify(json.loads(next(b.text for b in response.content if b.type == "text")))


@app.post("/api/business/<business_id>/advise")
def advise(business_id):
    b = get_business(business_id)
    if not b["claimed"]:
        return error("This business hasn't signed up.", 400)
    backend = adviser_backend()
    if backend is None:
        return error("The adviser needs Claude Code installed or a Claude API key in .env.", 503)
    if backend == "claude_code":
        return advise_with_claude_code(adviser_profile(b))

    client = anthropic.Anthropic()
    try:
        response = client.beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=16000,
            # If Claude declines, the API retries on a recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={
                "effort": "medium",
                "format": {"type": "json_schema", "schema": ADVICE_SCHEMA},
            },
            system=ADVISER_PROMPT,
            messages=[{"role": "user", "content": json.dumps(adviser_profile(b), indent=2)}],
        )
    except anthropic.AuthenticationError:
        return error("Claude didn't accept the API key. Check the key in .env.", 502)
    except anthropic.RateLimitError:
        return error("Too many requests right now. Wait a minute and try again.", 429)
    except anthropic.APIStatusError as e:
        return error(f"Claude API error ({e.status_code}): {e.message}", 502)
    except anthropic.APIConnectionError:
        return error("Couldn't reach Claude. Check your internet connection.", 502)

    if response.stop_reason == "refusal":
        return error("The adviser couldn't answer this one.", 502)
    if response.stop_reason == "max_tokens":
        return error("The adviser's answer was cut off. Try again.", 502)

    text = next(block.text for block in response.content if block.type == "text")
    return jsonify(json.loads(text))


if __name__ == "__main__":
    app.run(debug=True, port=5050)
