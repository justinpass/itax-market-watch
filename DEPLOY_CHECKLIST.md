# Deployment checklist

## Before first production deploy

- [ ] Review the seeded official-source items in `frontend/data/market.json`.
- [ ] Confirm the topic universe and labels match the intended tax practice.
- [ ] Confirm whether the product should use RSM branding or neutral ITAX branding.
- [ ] Review each configured source in `config/sources.json`.
- [ ] Run `python scripts/refresh_news.py` once and inspect the diff.
- [ ] Decide whether scheduled GitHub Action commits are acceptable for the repository.
- [ ] Confirm GitHub repository visibility (private recommended for an internal concept).
- [ ] Connect the GitHub repository to Vercel and set Framework Preset to **Services**.
- [ ] Verify `/`, `/api/health`, `/api/topics` and `/api/updates` after deployment.
- [ ] Confirm the GitHub Actions refresh workflow can push to the default branch.

## Acceptance checks

- [ ] Desktop view resembles the supplied tax-market-watch concept.
- [ ] Mobile view remains usable.
- [ ] Watchlist selections persist after refresh.
- [ ] Topic cards open detail views.
- [ ] Source links open the original authority page.
- [ ] Analyst note can be added to the meeting agenda.
- [ ] No signal is represented as a financial price or investment recommendation.
