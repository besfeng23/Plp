# PLP Telegram Command Bot

The PLP Telegram Command Bot is a read-only operations bridge for Pueblo La Perla Boracay. Telegram messages enter a Vercel API route, pass an allow-list check, route through a deterministic PLP agent, and call server-side tools for GitHub, Vercel, PayPal health, and Supabase booking/payment status.

## What it can answer

- `help`
- `check production`
- `check paypal`
- `check checkout errors`
- `check all PRs`
- `what PR is merge-ready`
- `show latest bookings`
- `any payment exceptions`
- `give me morning update`

The first version is intentionally deterministic and read-only. It does not use expensive AI routing, and it does not merge PRs, deploy, close issues, delete records, change bookings, or alter payment state.

## Required Vercel environment variables

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_ALLOWED_USER_IDS=
TELEGRAM_WEBHOOK_SECRET=
GITHUB_TOKEN=
VERCEL_TOKEN=
VERCEL_TEAM_ID=
VERCEL_PROJECT_ID=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_BASE_URL=https://plp-boracay.vercel.app
```

## Optional environment variables

```env
PLP_BOT_MODE=read_only
```

`PLP_BOT_MODE` is documented for future expansion. The current bot behavior is read-only regardless of this value.

## Security model

- Only Telegram users listed in `TELEGRAM_ALLOWED_USER_IDS` can receive operational answers.
- If `TELEGRAM_WEBHOOK_SECRET` is configured, the webhook requires Telegram's `X-Telegram-Bot-Api-Secret-Token` header.
- Unauthorized Telegram messages receive no operational details.
- Bot tokens, GitHub tokens, Vercel tokens, and Supabase service-role keys are never returned in responses.
- PayPal health only returns booleans such as whether credentials are configured; it never returns credential values.
- Supabase booking output masks email and phone values.
- Errors sent to Telegram are sanitized and do not include stack traces.
- No write actions are implemented in this first version.

If action commands are added later, require explicit confirmation phrases such as:

```text
YES MERGE PR 55
YES CLOSE PR 52
```

Never execute dangerous actions from vague language such as `do it`.

## Setup guide

1. Create a Telegram bot with BotFather.
2. Save `TELEGRAM_BOT_TOKEN` in Vercel Production environment variables.
3. Get your Telegram user ID from a trusted Telegram user-info bot or from Telegram update metadata during a controlled setup.
4. Save the comma-separated allow-list in `TELEGRAM_ALLOWED_USER_IDS`, for example `123,456`.
5. Generate a long random value for `TELEGRAM_WEBHOOK_SECRET` and save it in Vercel Production.
6. Add read-only operational tokens for GitHub and Vercel, plus the existing server-side Supabase variables.
7. Set the webhook:

```bash
curl -X POST "https://api.telegram.org/bot<token>/setWebhook" \
  -d "url=https://plp-boracay.vercel.app/api/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```

## Test commands

Send these messages from an allowed Telegram account:

```text
help
check production
check paypal
check prs
show latest bookings
any payment exceptions
give me morning update
```

## Architecture

```text
Telegram → Vercel API route → PLP Agent Router → server-side tool modules → GitHub/Vercel/Supabase/PayPal health
```

Files:

- `api/telegram/webhook.js` accepts Telegram webhook updates.
- `api/telegram/plpAgent.js` routes natural-language text to deterministic intents.
- `api/telegram/sendMessage.js` sends safe Telegram replies.
- `api/_tools/githubStatus.js` reads open PR status.
- `api/_tools/vercelStatus.js` reads latest production deployment status.
- `api/_tools/paypalHealth.js` reuses existing PayPal health configuration checks.
- `api/_tools/supabaseBookings.js` reads masked booking and payment exception summaries.
