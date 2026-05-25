# PayPal Risk Controls

Last checked: 2026-05-25

Purpose: keep WebView.click able to accept early PayPal payments without pretending PayPal Personal is a safe long-term business rail. This is operational/product guidance, not legal, tax, or compliance advice. Recheck PayPal's current User Agreement, Acceptable Use Policy, fees, and account-specific notices before going live.

## Recommendation

Use PayPal Business Checkout as the primary USD-friendly rail once sandbox and live API credentials are ready. Keep a PayPal Business payment/invoice link only as a fallback.

Preferred order:

1. PayPal Business Checkout using Orders v2 API.
2. PayPal Business invoice/payment link as fallback if API order creation fails.
3. Xendit/Midtrans/DOKU as Indonesia-local checkout rails.
4. Wise/Payoneer/Upwork/Contra for larger B2B clients who want invoice, bank-transfer, or contract-style payment.

Do not ask buyers to send payment as Friends and Family. Use goods/services, invoice-style payment, or a PayPal Business checkout/payment link so the transaction matches the commercial nature of the offer.

## Why Personal Is Risky

PayPal distinguishes personal and business accounts. Their user agreement says personal accounts are for personal/family/household use, while business accounts are required when the account is primarily for business or commercial activity, even if the business is not incorporated.

Account risk is behavior-based, not just a simple public monthly limit. Risk signals include:

- New seller or newly active seller activity.
- Sudden jump in sales volume or average transaction size.
- International payments from unfamiliar buyers.
- Multiple refunds, disputes, chargebacks, or customer complaints.
- Business/commercial volume on an account treated as personal.
- Unclear product description or mismatched buyer expectation.
- Prohibited or pre-approval categories under PayPal's Acceptable Use Policy.

## Operating Rules

- Keep payment descriptions boring and accurate: "Generated website package and launch workflow for [business]".
- Always collect business name, requested domain, customer email, and payment reference before sending the buyer to PayPal.
- For manual fallback links only, show the buyer a payment note instruction before opening PayPal.
- Keep delivery proof: preview URL, exported package, setup messages, DNS/domain notes, and handover confirmation.
- Avoid large sudden PayPal volume on a fresh account.
- Withdraw funds on a normal cadence instead of keeping large balances in PayPal.
- Upgrade to PayPal Business before repeat commercial sales become normal.
- Keep refund/scope terms clear before payment, especially for digital/service-like work.
- Do not misrepresent WebView.click as purely personal, purely non-commercial, or unrelated to website setup.

## Buyer Payment Note

Default fallback note shown by WebView.click when a manual PayPal link is used:

> Please pay as goods/services or invoice payment, not Friends and Family. Include the business name, requested domain, and WebView.click payment reference in the payment note.

For API checkout, the reference is stored in the PayPal order `invoice_id`. For manual fallback links, the checkout endpoint appends the generated reference:

`{businessId} | {orderId}`

This makes PayPal payments easier to match against CRM activity and reduces unclear-payment disputes.

## Implemented Controls

- [x] `/api/payments/checkout` records a `checkout_pending` lead/activity before returning a PayPal/manual payment link.
- [x] `/api/payments/checkout` generates a payment reference for PayPal, Wise, and Payoneer manual rails.
- [x] `/api/payments/checkout` creates a PayPal Orders v2 order when Business API credentials are configured.
- [x] Public `/demo` and `/:businessId` render the PayPal JavaScript SDK button inside the checkout modal for API-backed PayPal checkout.
- [x] `/api/payments/paypal-capture-order` captures approved PayPal orders and records paid ledger/subscription/lead status.
- [x] Checkout supports optional `$10` page/edit add-ons with 10% bulk discount at 5-9 actions and 20% at 10+ actions.
- [x] PayPal API checkout returns `requiresManualReview=false` and captures in-place; manual fallback links still return `requiresManualReview=true`.
- [x] Public `/demo` and `/:businessId` checkout modal shows payment note instructions and copyable payment reference for manual fallback rails; API-backed PayPal stores the reference on the PayPal order.
- [x] Admin Settings shows fallback account mode only when a manual PayPal fallback link is configured or an old `personal_bridge` value is present.
- [x] Admin Settings includes `PAYPAL_RISK_ACKNOWLEDGED`.
- [x] Admin Settings shows editable `PAYPAL_PAYMENT_NOTE` only when a manual PayPal fallback link is configured.
- [x] Admin Settings shows a compact PayPal guardrails panel.
- [x] Admin Dashboard marks PayPal as partial, not ready, when a PayPal link exists but the risk checklist is not acknowledged or the link/mode looks personal.
- [x] Codebase reference documents the PayPal/manual payment review step.
- [x] Added `lead_payments` ledger table for manual payment reconciliation.
- [x] Added `/admin/leads` payment reconciliation UI with recent ledger cards and checkout-pending CSV export.
- [x] Added per-lead "Verify payment" action with processor, transaction ID, payer email, amount, payment reference, and proof notes.
- [x] Added `/terms-refund` public terms/refund page for generated digital packages and managed launch support.
- [x] Added `/api/payments/paypal-webhook` endpoint that safely acknowledges events until PayPal Business credentials/webhook ID are configured, then verifies signatures and records matched completed payments as a backup to direct capture.

## In Progress / Future Controls

- [ ] Add filters/search/pagination to the payment ledger if reconciliation volume grows.
- [ ] Add direct transaction receipt attachment/upload if disputes become common.
- [ ] Add optional Upwork/Contra manual payment links for higher-trust service contracts.

## Production Smoke Test

1. In `/admin/settings#settings-payment`, set `PAYMENT_PROCESSOR=paypal`.
2. Paste the sandbox API key / Client ID into `PAYPAL_SANDBOX_CLIENT_ID` and the sandbox secret into `PAYPAL_SANDBOX_CLIENT_SECRET`.
3. Set the PayPal mode toggle to Sandbox (`PAYPAL_IS_PRODUCTION=false`).
4. Set `PAYPAL_RISK_ACKNOWLEDGED=true` after reviewing this document.
5. Optionally set `PAYPAL_BUSINESS_URL` as fallback; only then review fallback account mode and `PAYPAL_PAYMENT_NOTE`.
6. Save settings.
7. Open `/demo` or a public generated preview.
8. Continue through Download / Setup until payment.
9. Confirm the modal shows the PayPal button in-place.
10. Pay with a sandbox buyer account.
11. Confirm `/admin/leads` has a paid PayPal ledger row with capture ID, payer email, amount, and matching reference.
12. Paste the live API key / Client ID into `PAYPAL_LIVE_CLIENT_ID` and the live secret into `PAYPAL_LIVE_CLIENT_SECRET`, then switch the PayPal mode toggle to Live (`PAYPAL_IS_PRODUCTION=true`) only after sandbox capture works.

## PayPal Business Webhook Setup Later

When PayPal Business is ready:

1. Create a PayPal REST app.
2. Add webhook URL: `https://webview.click/api/payments/paypal-webhook`.
3. Subscribe to completed payment events such as `PAYMENT.CAPTURE.COMPLETED`.
4. Copy the PayPal webhook ID into `PAYPAL_WEBHOOK_ID`.
5. Add the active mode credential pair (`PAYPAL_SANDBOX_CLIENT_ID`/`PAYPAL_SANDBOX_CLIENT_SECRET` or `PAYPAL_LIVE_CLIENT_ID`/`PAYPAL_LIVE_CLIENT_SECRET`) and set the matching Sandbox/Live toggle.
6. Test in sandbox first.

Until those settings are filled, the endpoint safely returns success and ignores events.

## Sources

- PayPal User Agreement: https://www.paypal.com/us/legalhub/paypal/useragreement-full
- PayPal payment holds help: https://www.paypal.com/us/cshelp/article/why-is-my-payment-on-hold-or-unavailable-help126
- PayPal Acceptable Use Policy: https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
- PayPal Indonesia legal agreements index: https://www.paypal.com/id/legalhub/paypal/home?country.x=ID&locale.x=en_ID
