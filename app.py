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
import secrets
import shutil
import subprocess
import time
from collections import defaultdict, deque
from functools import wraps
from pathlib import Path

import anthropic
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request, send_from_directory, session
from werkzeug.exceptions import HTTPException

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
app.secret_key = os.environ.get("SECRET_KEY") or secrets.token_hex(32)
app.config.update(SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE="Lax")


@app.errorhandler(HTTPException)
def json_errors(e):
    """API callers get JSON, so the page can show the real message."""
    if request.path.startswith("/api/"):
        return jsonify(error=e.description), e.code
    return e


def get_business(business_id):
    b = businesses.get(business_id)
    if b is None:
        abort(404)
    return b


def own_business(business_id):
    """The business, but only for the owner signed in to it."""
    b = get_business(business_id)
    if session.get("business_id") != business_id:
        abort(403, "Sign in as this business first.")
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
        # Real businesses haven't agreed to anything, so they're never offered as leads.
        if gap and not b.get("real") and b["public"].get(gap) is False:
            return {"need": need_key, "state": "public_gap", "text": f"No {label.lower()} listed publicly"}
        return {"need": need_key, "state": "no_info", "text": "Not on NEhelp yet"}

    need = b["needs"].get(need_key)
    if not need or not need["shared"]:
        return {"need": need_key, "state": "private", "text": f"{label}: not shared"}

    status = need["status"]
    is_customer = need["provider"] == provider_id and status in ("happy", "unhappy")
    if is_customer and not need.get("share_feedback"):
        # "Show providers" asks for offers. Telling your own provider how you
        # rate them is a separate choice, so they learn nothing without it.
        return {"need": need_key, "state": "private", "text": f"{label}: not shared"}

    match = {"need": need_key, "note": need["note"]}
    if is_customer:
        # Your own customer, who chose to share this with you.
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


@app.post("/api/demo-login")
def demo_login():
    """Stand-in for a real login: the demo lets you pick who you are.

    Everything private is checked against this session, so a real login can
    replace this one route without changing the rest.
    """
    body = request.get_json(force=True)
    if not isinstance(body, dict) or not isinstance(body.get("id"), str):
        abort(400, "Choose who to sign in as.")
    role, target = body.get("role"), body["id"]
    session.clear()
    if role == "owner" and businesses.get(target, {}).get("claimed"):
        session["business_id"] = target
    elif role == "provider" and target in providers:
        session["provider_id"] = target
    else:
        abort(400, "Choose who to sign in as.")
    return jsonify(ok=True)


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
    return jsonify(own_business(business_id))


@app.put("/api/business/<business_id>/needs")
def update_needs(business_id):
    b = own_business(business_id)
    incoming = request.get_json(force=True)
    if not isinstance(incoming, dict):
        abort(400, "Send your needs as a list of answers.")
    for key, need in incoming.items():
        if key not in NEED_KEYS or not isinstance(need, dict) or need.get("status") not in STATUSES:
            abort(400, f"Bad need: {key}")
        rating = need.get("rating")
        if rating is not None and (type(rating) is not int or rating not in range(1, 6)):
            abort(400, "Rating must be 1 to 5.")
        provider = need.get("provider")
        if provider is not None and (not isinstance(provider, str) or (provider not in providers and provider != "other")):
            abort(400, "Unknown provider.")
        b["needs"][key] = {
            "status": need["status"],
            "provider": provider,
            "rating": rating,
            "comment": str(need.get("comment", ""))[:280],
            "note": str(need.get("note", ""))[:280],
            "shared": bool(need.get("shared")),
            "share_feedback": bool(need.get("share_feedback")),
        }
    return jsonify(b)


@app.get("/api/provider/<provider_id>/map")
def provider_map(provider_id):
    provider = providers.get(provider_id)
    if provider is None:
        abort(404)
    if session.get("provider_id") != provider_id:
        abort(403, "Sign in as this provider first.")
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


def ask_claude(system_prompt, schema, user_input, effort):
    """Ask Claude for JSON that matches the schema, and return it as a response."""
    backend = adviser_backend()
    if backend is None:
        return error("Claude isn't set up here. Install Claude Code or add a Claude API key to .env.", 503)
    if backend == "claude_code":
        return ask_claude_code(system_prompt, schema, user_input)

    try:
        response = anthropic.Anthropic().beta.messages.create(
            model="claude-opus-5-5",
            max_tokens=16000,
            # If Claude declines, the API retries on a recommended fallback model.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
            system=system_prompt,
            messages=[{"role": "user", "content": user_input}],
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
        return error("Claude couldn't answer this one.", 502)
    if response.stop_reason == "max_tokens":
        return error("Claude's answer was cut off. Try again.", 502)

    text = next((block.text for block in response.content if block.type == "text"), "")
    try:
        return jsonify(json.loads(text))
    except json.JSONDecodeError:
        return error("Claude's answer couldn't be read. Try again.", 502)


CLAUDE_CALLS_PER_MINUTE = 10
recent_claude_calls = defaultdict(deque)


def limit_claude_calls(view):
    """Each call costs money, so one visitor can't make unlimited calls."""
    @wraps(view)
    def limited(*args, **kwargs):
        now = time.monotonic()
        calls = recent_claude_calls[request.remote_addr]
        while calls and now - calls[0] > 60:
            calls.popleft()
        if len(calls) >= CLAUDE_CALLS_PER_MINUTE:
            return error("Too many requests. Wait a minute and try again.", 429)
        calls.append(now)
        return view(*args, **kwargs)
    return limited


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
@limit_claude_calls
def draft_request():
    body = request.get_json(force=True)
    if not isinstance(body, dict):
        return error("Tell us what would help first.", 400)
    text = str(body.get("text", "")).strip()[:2000]
    if not text:
        return error("Tell us what would help first.", 400)
    business = body.get("business")
    business = business if isinstance(business, dict) else {}
    user_input = json.dumps({
        "owner_says": text,
        "business": {k: str(business.get(k, ""))[:100] for k in ("name", "kind", "area")},
    }, indent=2)
    return ask_claude(DRAFT_PROMPT, DRAFT_SCHEMA, user_input, effort="low")


@app.post("/api/business/<business_id>/advise")
@limit_claude_calls
def advise(business_id):
    b = own_business(business_id)
    return ask_claude(ADVISER_PROMPT, ADVICE_SCHEMA, json.dumps(adviser_profile(b), indent=2), effort="medium")


if __name__ == "__main__":
    app.run(debug=os.environ.get("FLASK_DEBUG") == "1", port=5050)
