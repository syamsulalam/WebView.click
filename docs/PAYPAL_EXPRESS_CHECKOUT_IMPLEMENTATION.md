# PayPal Checkout And Subscriptions

Last updated: 28 May 2026.

Purpose: local reference for WebView.click PayPal checkout, yearly subscription billing, pricing, D1 storage, and production QA.

## Official References

- JavaScript SDK reference: https://developer.paypal.com/sdk/js/v1/reference/
- Subscriptions integration guide: https://developer.paypal.com/docs/subscriptions/integrate/
- Webhook event names: https://developer.paypal.com/api/rest/webhooks/event-names/

## Pricing Model

Base new-domain annual total is controlled by `PAYMENT_USD_AMOUNT`, default `$197`.

The domain fee is controlled by `PAYMENT_DOMAIN_FEE_USD`, default `$17`.

Server-side pricing derives:

- New domain: `$180/year hosting + $17/year domain fee = $197/year`.
- Owned domain: `$180/year hosting + no domain fee = $180/year`.
- Multi-year term discounts apply only to hosting.
- Domain fee is never discounted.
- Page/edit add-ons are one-time setup fees using `PAYMENT_ADDON_PAGE_USD`, default `$10`.

Term discount:

- 1 year: no discount.
- 2 years: 5% hosting discount.
- 3 years: 10% hosting discount.
- Continue +5% each year through 9 years at 40%.
- 10 years: 50% hosting discount.

## Buyer Flow

Shared UI: `src/components/WebsiteActionPanel.tsx`.

Routes using the shared panel:

- `/demo`
- `/:businessId`

Buyer chooses:

- Base setup or page add/edit work.
- Term length, 1-10 years.
- Billing cadence: pay once or yearly billing.
- New domain or owned domain.

For new domains, checkout attempts `/api/domains/quote` before payment. The buyer still sees the public `$17/year` domain fee; internal registrar cost is stored for fulfillment.

For owned domains, the `$17/year` domain fee is removed.

## PayPal One-Time Checkout

Used when buyer chooses pay once/prepaid.

Server endpoint:

- `POST /api/payments/checkout`

PayPal API:

- Creates order with `POST /v2/checkout/orders`.
- Uses `intent=CAPTURE`.
- Stores `paymentReference` as PayPal `invoice_id`.

Browser:

- Loads PayPal JS SDK with `intent=capture`.
- Renders PayPal button.
- On approval, calls `POST /api/payments/paypal-capture-order`.

Server capture:

- Calls `POST /v2/checkout/orders/{id}/capture`.
- Updates `lead_payments` to `paid`.
- Updates `subscriptions`.
- Marks lead `won_paid`.
- Writes CRM activity.

## PayPal Yearly Subscriptions

Used when buyer chooses yearly billing and PayPal API credentials are configured.

Server endpoint:

- `POST /api/payments/checkout`

Plan behavior:

- Checkout first searches `system_settings` for a cached exact-match plan.
- Cache key format: `PAYPAL_SUBSCRIPTION_PLAN__{mode}__{domainMode}__term_{n}__annual_{price}__hosting_{price}__domain_{fee}__setup_{fee}`.
- Exact match includes PayPal mode, domain mode, term years, annual amount, discounted hosting, domain fee, and setup fee.
- If matched, checkout reuses the PayPal plan ID.
- If missing, checkout creates a PayPal Catalog Product + Billing Plan and saves product/plan IDs to `system_settings`.

Browser:

- Loads PayPal JS SDK with `vault=true&intent=subscription`.
- Uses `actions.subscription.create({ plan_id, custom_id })`.
- `custom_id` is the WebView.click `paymentReference`.

Approval endpoint:

- `POST /api/payments/paypal-subscription-approved`
- Looks up the subscription with PayPal.
- Updates `lead_payments`, `subscriptions`, lead status, and CRM activity.

Webhook backup:

- `POST /api/payments/paypal-webhook`
- Handles `BILLING.SUBSCRIPTION.ACTIVATED`.
- Handles `PAYMENT.SALE.COMPLETED` with `billing_agreement_id` for subscription renewal payments.

## Settings

Admin page:

- `/admin/settings#settings-payment`

Important keys:

- `PAYMENT_PROCESSOR=paypal`
- `PAYMENT_USD_AMOUNT=197`
- `PAYMENT_DOMAIN_FEE_USD=17`
- `PAYMENT_ADDON_PAGE_USD=10`
- `PAYPAL_IS_PRODUCTION=false` for sandbox, `true` for live
- `PAYPAL_SANDBOX_CLIENT_ID`
- `PAYPAL_SANDBOX_CLIENT_SECRET`
- `PAYPAL_SANDBOX_WEBHOOK_ID`
- `PAYPAL_LIVE_CLIENT_ID`
- `PAYPAL_LIVE_CLIENT_SECRET`
- `PAYPAL_LIVE_WEBHOOK_ID`
- `PAYPAL_BUSINESS_URL` optional manual fallback
- `PAYPAL_RISK_ACKNOWLEDGED=true` only after reviewing risk controls

Legacy fallback keys still work:

- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID`

Prefer mode-specific sandbox/live keys.

## Admin Visibility

Admin orders:

- `/admin/orders`
- Shows billing cadence, term, hosting/domain split, PayPal plan ID, PayPal subscription ID, domain quote, and fulfillment note.

Settings smoke checklist and plan cache viewer:

- `/admin/settings#settings-payment`
- Visible when PayPal is selected.
- Reads `GET /api/settings/payment-smoke`.
- Shows whether live PayPal Client ID, live Client Secret, live webhook ID, a live cached subscription plan, and recent paid PayPal ledger evidence exist.
- Stores `PAYPAL_CONTROLLED_LIVE_TEST_REFERENCE`, the exact PayPal order/capture/subscription ID or WebView.click payment reference from the controlled live test.
- The controlled-live checklist row turns green only when the stored reference matches a recent paid PayPal ledger row.
- Shows one aggregate `Ready for traffic` badge that turns green only when every smoke checklist row passes.
- Reads `GET /api/settings/paypal-plan-cache`.
- Shows cached subscription plan rows without exposing PayPal secrets.
- Includes copy-plan-ID button for PayPal dashboard comparison.

## D1 Storage

No manual D1 schema migration is required for this PayPal/domain-fee work.

Existing tables used:

- `system_settings`
- `lead_payments`
- `subscriptions`
- `crm_activities`
- `leads`

New settings/cache keys are stored in existing `system_settings`.

If `PAYMENT_DOMAIN_FEE_USD` does not exist yet, backend defaults to `$17`. Opening Settings and saving will persist the key.

PayPal plan cache rows are created lazily by the first matching yearly-billing checkout.

`setupTables()` also ensures `system_settings.updated_at` exists for older D1 databases, so the plan-cache viewer can sort rows without a manual SQL step.

## Production QA

Do not assume payment logic is perfect without testing. The minimum safe test before real buyers:

1. Set PayPal to sandbox.
2. Run one owned-domain yearly subscription checkout.
3. Run one new-domain yearly subscription checkout.
4. Run one pay-once checkout.
5. Confirm `/admin/orders` shows paid/pending state, plan ID, subscription ID, amount, and fulfillment note.
6. Confirm PayPal webhook signature verification works for the active mode.
7. Paste the exact controlled live test order/capture/subscription/payment reference into `/admin/settings#settings-payment`.
8. Check that the smoke checklist matches the recorded reference before sending traffic.

If skipping sandbox, do at least one low-value controlled live transaction with your own account before sending live traffic.

## Risk Notes

- PayPal subscriptions require Business/API app readiness.
- PayPal can hold or review funds for new sellers, unusual volume, disputes, or changed selling patterns.
- Keep proof of delivery, domain setup notes, and payment references.
- Avoid Personal/Friends-and-Family style fallback payments for business sales.
