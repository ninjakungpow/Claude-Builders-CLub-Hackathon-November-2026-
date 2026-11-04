# NEhelp

A map that connects small businesses with the providers who can help them.

- **Small businesses** sign up cheaply, list what they use and how happy they are, and get honest advice from Claude about what they actually need, including what they can skip.
- **Providers** (banks, card payment firms, accountants, marketing agencies) pay to see who wants help, who has no provider and which of their own customers are happy.

**Status:** hackathon demo. All data is made up (see `data/sample_data.json`).

## Privacy: three layers

| Layer | Example | Who sees it |
|---|---|---|
| Public facts | Name, area, has a website? | Everyone |
| Needs the owner shares | "Wants help with taxes" | Providers, only if the owner ticks **Show providers** |
| Private guesses | "No accountant and the tax deadline is 31 January" | The owner only |

The server enforces this in `app.py` (`public_view`, `provider_view`, `match_for`), so private data never reaches a provider's browser. A provider is also never told *which* competitor an unhappy business uses.

## How Claude is used

The **adviser** (`/api/business/<id>/advise`) sends the owner's profile to Claude Opus 5.5 and gets back structured advice for every need: *sort this now*, *worth considering*, *you can skip this* or *already sorted*, each with a reason and a next step. It's told to take the owner's side and not push paid services they don't need.

## Run it

You need [uv](https://docs.astral.sh/uv/) (`brew install uv`).

```sh
cp .env.example .env      # then paste your Claude API key into .env
uv run app.py
```

Open http://127.0.0.1:5050. The map and both views work without a key. Only the adviser needs one.

## Not built yet

- Logins and payments. Anyone can open any owner view in this demo.
- Ratings that other small businesses can browse.
- Real data from official sources (FSA hygiene ratings, Companies House).
- Messaging between providers and businesses.
- Saving changes. Edits are kept in memory and reset when the server restarts.
