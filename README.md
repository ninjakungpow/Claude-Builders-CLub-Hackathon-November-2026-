# NEhelp

A map that connects small businesses with the providers who can help them.

- **Small businesses** sign up cheaply, list what they use and how happy they are, and get honest advice from Claude about what they actually need, including what they can skip.
- **Providers** (banks, card payment firms, accountants, marketing agencies) pay to see who wants help, who has no provider and which of their own customers are happy.

**Status:** hackathon demo. Signed-up businesses, providers and ratings are made up (`data/sample_data.json`). Businesses that haven't signed up are real, from OpenStreetMap and the Food Standards Agency, with their names changed and locations rounded to about 100m (`data/real_businesses.json`). They are shown on the map but never offered to providers as leads.

## Privacy: three layers

| Layer | Example | Who sees it |
|---|---|---|
| Public facts | Name, area, has a website? | Everyone |
| Needs the owner shares | "Wants help with taxes" | Providers, only if the owner ticks **Show providers** |
| Private guesses | "No accountant and the tax deadline is 31 January" | The owner only |

The server enforces this in `app.py` (`public_view`, `provider_view`, `match_for`, `own_business`): private routes check who is signed in, and `tests/test_privacy.py` covers the rules. A provider is also never told *which* competitor an unhappy business uses.

**Show providers** asks for offers. Showing your rating and comment to your current provider is a separate tick, off by default.

Sign-in is a demo stand-in (`/api/demo-login`): anyone can still choose to be any business or provider, so a real login is needed before real people use this.

## How Claude is used

The **adviser** (`/api/business/<id>/advise`) sends the owner's profile to Claude Opus 5.5 and gets back structured advice for every need: *sort this now*, *worth considering*, *you can skip this* or *already sorted*, each with a reason and a next step. It's told to take the owner's side and not push paid services they don't need.

The **request drafter** (`/api/draft-request`) turns the owner's own words into a clear request a company can pick up. Both calls are limited to 10 a minute per visitor.

## Run it

You need [uv](https://docs.astral.sh/uv/) (`brew install uv`).

```sh
cp .env.example .env      # then paste your Claude API key into .env
uv run app.py
```

Open http://127.0.0.1:5050. The map and both views work without a key. Claude features use the key if there is one, or Claude Code on this computer if not. A hosted version needs the key.

Run the privacy tests with `uv run --with pytest python -m pytest`.

## Not built yet

- Real logins and payments.
- Ratings that other small businesses can browse.
- A way for real businesses to ask to be removed from the map.
- Messaging between providers and businesses.
- Saving changes. Edits are kept in memory and reset when the server restarts.
