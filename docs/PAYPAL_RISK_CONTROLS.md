# PayPal Risk Controls

Last checked: 2026-05-25

Purpose: keep WebView.click able to accept early PayPal payments without pretending PayPal Personal is a safe long-term business rail. This is operational/product guidance, not legal, tax, or compliance advice. Recheck PayPal's current User Agreement, Acceptable Use Policy, fees, and account-specific notices before going live.

## Recommendation

Use PayPal only as a fallback/manual rail for the current website setup offer.

Preferred order:

1. PayPal Business invoice/payment link for commercial payments.
2. PayPal Personal only as a temporary, low-volume bridge while upgrading.
3. Xendit/Midtrans/DOKU as the more serious Indonesia merchant checkout rails.
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
- Show the buyer a payment note instruction before opening PayPal.
- Keep delivery proof: preview URL, exported package, setup messages, DNS/domain notes, and handover confirmation.
- Avoid large sudden PayPal volume on a fresh account.
- Withdraw funds on a normal cadence instead of keeping large balances in PayPal.
- Upgrade to PayPal Business before repeat commercial sales become normal.
- Keep refund/scope terms clear before payment, especially for digital/service-like work.
- Do not misrepresent WebView.click as purely personal, purely non-commercial, or unrelated to website setup.

## Buyer Payment Note

Default note shown by WebView.click:

> Please pay as goods/services or invoice payment, not Friends and Family. Include the business name, requested domain, and WebView.click payment reference in the payment note.

The checkout endpoint appends a generated reference:

`{businessId} | {requestedDomain} | {orderId}`

This makes PayPal payments easier to match against CRM activity and reduces unclear-payment disputes.

## Implemented Controls

- [x] `/api/payments/checkout` records a `checkout_pending` lead/activity before returning a PayPal/manual payment link.
- [x] `/api/payments/checkout` generates a payment reference for PayPal, Wise, and Payoneer manual rails.
- [x] PayPal checkout returns `requiresManualReview=true`, so the public setup panel shows instructions before opening PayPal.
- [x] Public `/demo` and `/:businessId` checkout modal shows payment note instructions and copyable payment reference for PayPal/manual rails.
- [x] Admin Settings includes `PAYPAL_ACCOUNT_MODE` with `business` and `personal_bridge`.
- [x] Admin Settings includes `PAYPAL_RISK_ACKNOWLEDGED`.
- [x] Admin Settings includes editable `PAYPAL_PAYMENT_NOTE`.
- [x] Admin Settings shows a PayPal account-risk guardrails panel.
- [x] Admin Dashboard marks PayPal as partial, not ready, when a PayPal link exists but the risk checklist is not acknowledged or the link/mode looks personal.
- [x] Codebase reference documents the PayPal/manual payment review step.
- [x] Added `lead_payments` ledger table for manual payment reconciliation.
- [x] Added `/admin/leads` payment reconciliation UI with recent ledger cards and checkout-pending CSV export.
- [x] Added per-lead "Verify payment" action with processor, transaction ID, payer email, amount, payment reference, and proof notes.
- [x] Added `/terms-refund` public terms/refund page for generated digital packages and managed launch support.
- [x] Added inert `/api/payments/paypal-webhook` endpoint that safely acknowledges events until PayPal Business credentials/webhook ID are configured, then verifies signatures and records matched completed payments.

## In Progress / Future Controls

- [ ] Add filters/search/pagination to the payment ledger if reconciliation volume grows.
- [ ] Add direct transaction receipt attachment/upload if disputes become common.
- [ ] Add optional Upwork/Contra manual payment links for higher-trust service contracts.

## Production Smoke Test

1. In `/admin/settings#settings-payment`, set `PAYMENT_PROCESSOR=paypal`.
2. Set `PAYPAL_ACCOUNT_MODE=personal_bridge` only if temporarily using Personal; otherwise use `business`.
3. Set `PAYPAL_RISK_ACKNOWLEDGED=true` after reviewing this document.
4. Set `PAYPAL_PAYMENT_NOTE`.
5. Save settings.
6. Open `/demo` or a public generated preview.
7. Continue through Download / Setup until payment.
8. Confirm the modal shows PayPal instructions and a copyable payment reference before opening the payment link.
9. Confirm `/admin/leads` has a `checkout_pending` lead/activity with the same reference.
10. After checking PayPal, open `/admin/leads`, click the lead's verify-payment action, enter transaction ID, payer email, amount, payment reference, and proof notes, then confirm the lead becomes `won_paid`.

## PayPal Business Webhook Setup Later

When PayPal Business is ready:

1. Create a PayPal REST app.
2. Add webhook URL: `https://webview.click/api/payments/paypal-webhook`.
3. Subscribe to completed payment events such as `PAYMENT.CAPTURE.COMPLETED`.
4. Copy the PayPal webhook ID into `PAYPAL_WEBHOOK_ID`.
5. Add `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, and set `PAYPAL_IS_PRODUCTION`.
6. Test in sandbox first.

Until those settings are filled, the endpoint safely returns success and ignores events.

## Sources

- PayPal User Agreement: https://www.paypal.com/us/legalhub/paypal/useragreement-full
- PayPal payment holds help: https://www.paypal.com/us/cshelp/article/why-is-my-payment-on-hold-or-unavailable-help126
- PayPal Acceptable Use Policy: https://www.paypal.com/us/legalhub/paypal/acceptableuse-full
- PayPal Indonesia legal agreements index: https://www.paypal.com/id/legalhub/paypal/home?country.x=ID&locale.x=en_ID
