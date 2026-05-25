# PayPal Checkout Implementation

Last checked: 25 May 2026.

Purpose: document the PayPal Business Checkout integration for WebView.click's `$197/year` managed launch offer and optional flat-fee page/edit add-ons.

## Current PayPal Pattern

PayPal's current Checkout pattern is the JavaScript SDK plus Orders v2 API:

1. Load the PayPal JavaScript SDK with the PayPal client ID and `currency=USD`.
2. Create an order server-side with `POST /v2/checkout/orders`.
3. Buyer approves the order in the PayPal UI.
4. Capture the approved order server-side with `POST /v2/checkout/orders/{id}/capture`.
5. Record the capture ID, payer email, amount, and order reference in the CRM/payment ledger.

This replaces the old manual "open PayPal link and type a note" flow for configured PayPal Business accounts. The manual PayPal Business link remains only as a fallback when API order creation fails.

## Buyer Offer

Base package:

- `$197/year`
- Includes `$17/year` domain allowance for new domains.
- Includes `$180/year` static hosting allocation, equivalent to `$15/month x 12`.
- Includes free setup: generated website launch, upload, DNS pointing, SSL, and handoff.

Optional add-ons:

- `$10` per additional generated page.
- `$10` per existing-page edit action.
- 5-9 total page/edit actions: 10% bulk discount.
- 10+ total page/edit actions: 20% bulk discount.

Product positioning:

- Keep the headline simple: `$197/year domain + hosting + free setup`.
- Present add-ons as optional, buyer-selected extras so the base offer still feels like the main deal.
- Avoid implying unlimited revisions. Each additional page/edit is a flat-fee action.

## Implemented Flow

Public `/demo` and `/:businessId`:

- The shared `WebsiteActionPanel` shows the base package value stack and add-on selectors.
- Buyer chooses new-domain or owned-domain setup, runs the domain pre-check, enters email, and clicks Continue.
- `POST /api/payments/checkout` records `checkout_pending` in D1 and creates a PayPal order when `PAYMENT_PROCESSOR=paypal` and API credentials are filled.
- The modal renders PayPal's JavaScript SDK button in-place. The buyer approves payment without leaving the site flow.
- On approval, the browser calls `POST /api/payments/paypal-capture-order`.
- The Pages Function captures the order with PayPal, records `lead_payments.payment_status='paid'`, updates the subscription, marks the lead `won_paid`, and writes CRM activity.

Pages Functions:

- `POST /api/payments/checkout` creates a PayPal order with `intent=CAPTURE`.
- `POST /api/payments/paypal-capture-order` captures the approved PayPal order and records the payment.
- `POST /api/payments/paypal-webhook` remains available as a backup reconciliation path for `PAYMENT.CAPTURE.COMPLETED`.

Settings:

- `PAYMENT_PROCESSOR=paypal`
- `PAYMENT_USD_AMOUNT=197`
- `PAYMENT_ADDON_PAGE_USD=10`
- `PAYPAL_IS_PRODUCTION=false` for sandbox, `true` for live.
- `PAYPAL_SANDBOX_CLIENT_ID`
- `PAYPAL_SANDBOX_CLIENT_SECRET`
- `PAYPAL_LIVE_CLIENT_ID`
- `PAYPAL_LIVE_CLIENT_SECRET`
- `PAYPAL_WEBHOOK_ID` after webhook is configured.
- `PAYPAL_BUSINESS_URL` optional fallback link.

Legacy fallback:

- Existing `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are still read as fallback values so older production settings do not break.
- New setup should fill the sandbox and live fields separately, then switch mode only with `PAYPAL_IS_PRODUCTION`.

## Sandbox QA

1. In PayPal Developer Dashboard, use sandbox REST app credentials.
2. In `/admin/settings#settings-payment`, set `PAYMENT_PROCESSOR=paypal`.
3. Paste sandbox `PAYPAL_SANDBOX_CLIENT_ID` and `PAYPAL_SANDBOX_CLIENT_SECRET`.
4. Set `PAYPAL_IS_PRODUCTION=false`.
5. Use `/demo` or a generated public preview.
6. Select domain mode, optionally add page/edit actions, and continue.
7. Confirm the PayPal button appears inside the WebView.click modal.
8. Pay with a sandbox buyer account.
9. Confirm the modal shows payment captured.
10. Confirm `/admin/leads` shows a paid ledger row with PayPal transaction ID and payer email.
11. Only after this succeeds, paste live `PAYPAL_LIVE_CLIENT_ID` and `PAYPAL_LIVE_CLIENT_SECRET`, then set `PAYPAL_IS_PRODUCTION=true`.

## Debug Notes

- If the PayPal button does not load, check browser console for SDK load errors and confirm the client ID matches sandbox/live mode.
- If PayPal is selected in Settings and the active mode Client ID/Secret is missing, `/admin/settings` shows an amber warning before you leave the page.
- If order creation fails, `/api/payments/checkout` falls back to `PAYPAL_BUSINESS_URL` when available and keeps the checkout-pending CRM row.
- If capture succeeds in PayPal but CRM recording fails, use `/admin/leads` manual payment verification with the PayPal capture ID while reviewing Function logs.
- Keep webhook configured even though direct capture records payments immediately; it protects against browser callback interruptions.

## Sources

- PayPal Orders API v2: https://developer.paypal.com/docs/api/orders/v2/
- PayPal Orders create-order reference: https://docs.paypal.ai/reference/api/rest/orders/create-order
- PayPal Orders capture reference: https://docs.paypal.ai/reference/api/rest/orders/capture-payment-for-order
- PayPal JavaScript SDK buttons: https://developer.paypal.com/sdk/js/reference/
- PayPal standard checkout integration: https://developer.paypal.com/studio/checkout/standard/integrate
