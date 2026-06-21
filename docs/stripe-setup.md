# Stripe Setup — Products, Prices & Wiring

Everything you need to create in Stripe for **not-spotify** premium, with suggested prices in **MYR**. Stripe runs entirely in **test mode** (a "sandbox") — no real money, test cards only.

> Stripe is **optional** for day-to-day dev: login, playback, playlists, profiles, and admin all work without it. You only need this to exercise the **Premium checkout** flow.

---

## What to create in Stripe

The app supports **5 subscription plans**. Each is **one recurring Stripe Price** under a single "Premium" product (or one product each — either works). **There are no one-time payments** — every plan is a recurring subscription. Seat counts for Duo/Family are managed *in-app* (so each checkout is quantity 1).

| Plan | Billing type | Suggested price (MYR) | Seats | App plan key | user-secret to set |
|---|---|---|---|---|---|
| **Premium Monthly** | Recurring · **monthly** | **RM 17.90 / month** | 1 | `monthly` | `Stripe:MonthlyPriceId` |
| **Premium Yearly** | Recurring · **yearly** | **RM 182.90 / year** (≈15% off 12× monthly) | 1 | `yearly` | `Stripe:YearlyPriceId` |
| **Premium Duo** | Recurring · **monthly** | **RM 23.90 / month** | 2 | `duo` | `Stripe:DuoPriceId` |
| **Premium Family** | Recurring · **monthly** | **RM 29.90 / month** | 6 | `family` | `Stripe:FamilyPriceId` |
| **Premium Student** | Recurring · **monthly** | **RM 8.90 / month** | 1 | `student` | `Stripe:StudentPriceId` |

*Prices are average Malaysian streaming rates (aligned with Spotify Malaysia) — adjust freely. The **amount you set in Stripe is what the customer is charged at checkout**; the code only cares about the price **ID**, not the number. (If the Premium page also shows hardcoded display prices, keep them in sync with these.)*

**Minimum to make checkout work:** just `monthly` + `yearly`. Duo/Family/Student are optional — any you leave unset simply show as "not configured" and stay disabled on the Premium page.

---

## 1. Turn on test mode & set a business name

1. Stripe Dashboard → toggle **Test mode** (or use a **Sandbox**).
2. **Settings → Business → Public details** → set a **Public business name** (e.g. `Not Spotify Test`) and save. *(Stripe Checkout requires this even in test mode. No bank account or live activation needed.)*

## 2. Create the prices

For **each** row in the table above:

1. **Product catalog** → <https://dashboard.stripe.com/test/products> → **Add product** (e.g. name `Premium Monthly`).
2. Under **Pricing**: **Recurring**, set the **billing period** (monthly or yearly per the table), **currency MYR**, and the amount.
3. Save, then open the price and copy its **API ID** — a real one looks like:
   ```
   price_1Rxxxxxxxxxxxxxxxxxxxx
   ```
   ⚠️ Use the real `price_…` API ID, **not** a label like `price_55`.

*(You can put all five prices under one "Premium" product instead of five products — only the price IDs matter.)*

## 3. Get your secret key

**Developers → API keys** (test mode) → copy the **Secret key** (`sk_test_…`, **not** `pk_test_…`).

> **Tip:** for sharing with teammates, prefer a **restricted key** (Developers → API keys → *Create restricted key*) scoped to just Checkout/Billing — smaller blast radius if it leaks. The full `sk_test_…` is fine for a test-mode student project.

## 4. Wire it into the backend

From `backend/src/NotSpotify.Api`:
```powershell
dotnet user-secrets set "Stripe:SecretKey" "sk_test_your_secret_key"
dotnet user-secrets set "Stripe:MonthlyPriceId" "price_your_monthly_id"
dotnet user-secrets set "Stripe:YearlyPriceId"  "price_your_yearly_id"
# optional tiers:
dotnet user-secrets set "Stripe:DuoPriceId"     "price_your_duo_id"
dotnet user-secrets set "Stripe:FamilyPriceId"  "price_your_family_id"
dotnet user-secrets set "Stripe:StudentPriceId" "price_your_student_id"
# checkout redirect URLs (defaults shown — override only if needed):
dotnet user-secrets set "Stripe:SuccessUrl" "http://localhost:5173/premium?checkout=success"
dotnet user-secrets set "Stripe:CancelUrl"  "http://localhost:5173/premium?checkout=cancelled"
dotnet user-secrets set "Stripe:PortalReturnUrl" "http://localhost:5173/account"
```

## 5. Webhook (per developer)

Premium only flips on after Stripe confirms via webhook. In local dev the Stripe CLI forwards events:
```powershell
stripe listen --forward-to https://localhost:7045/stripe/webhook
```
It prints a signing secret (`whsec_…`) — set it, then **restart the backend**:
```powershell
dotnet user-secrets set "Stripe:WebhookSecret" "whsec_your_secret"
```
> `stripe listen` mints a **new** `whsec_…` per session/per developer, so **`Stripe:WebhookSecret` is the one value each teammate sets individually** — it is *not* shared.

## 6. Test the checkout

Log in (e.g. `alex@example.com` / `Password123!`) → `/premium` → pick a plan → pay with the Stripe test card:
```
4242 4242 4242 4242   any future expiry · any CVC · any postal code
```
After the webhook lands, the account becomes Premium.

---

## Sharing across the team (one Stripe account)

Same model as the AWS/Supabase keys — **share one test account's keys, don't export anything:**

- **Share once:** `Stripe:SecretKey` (or a restricted key) + the price IDs (`MonthlyPriceId`, `YearlyPriceId`, Duo/Family/Student). Everyone sets them in their own user-secrets.
- **Per-developer:** `Stripe:WebhookSecret` (from each person's own `stripe listen`). `SuccessUrl`/`CancelUrl` are localhost — same for all.
- Keep all keys in **user-secrets, never in git**. It's test mode, so there's no real-money risk — but treat keys as secret regardless.

*(Need the products in a **different** Stripe account later? Just recreate the 5 prices — a few minutes — or script them with Stripe CLI fixtures. There's no per-account export, and for one shared team account you don't need one.)*

For the full Stripe CLI install walkthrough, see the **Stripe Billing Setup** section in the [main README](../README.md).
