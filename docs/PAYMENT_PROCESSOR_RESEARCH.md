# Payment Processor Research for WebView.click

Last checked: 2026-05-18

Purpose: choose payment options for selling WebView.click done-for-you website setup to mostly US customers while the operator is based in Indonesia. This is product/payment research, not legal, tax, or compliance advice. Recheck provider terms before going live.

## Current Problem

Lemon Squeezy is not a safe primary processor for the current offer. Its prohibited-products page says services of any kind are prohibited, including marketing, design, web development, consulting, and related services.

That means the `$197/year domain + hosting + setup` offer should not rely on Lemon Squeezy unless the offer is changed into a compliant self-serve digital product and confirmed with Lemon Squeezy support.

## Recommendation

Use a multi-rail payment setup:

1. Xendit as the first serious card checkout to test.
2. Midtrans as the second Indonesia-local gateway.
3. DOKU as another Indonesia-local checkout option if onboarding is easier or approval is better.
4. PayPal Business as a fallback, not PayPal Personal.
5. Wise Business or Payoneer as manual invoice/request-payment rails for larger B2B clients who prefer bank transfer or invoice payment.

Keep the app capable of mock checkout when keys are missing. Every checkout attempt should still create `checkout_pending` CRM activity so follow-up is not lost.

## Processor Notes

### Xendit

Best fit: Indonesia-based merchant accepting cards, with hosted invoices/payment links and international card support.

What matters:
- Xendit says Indonesian merchants can accept foreign cards/international payments through cards.
- Xendit says Indonesian card transactions settle in IDR because of Bank Indonesia rules, even if the checkout can display USD-style pricing.
- Xendit supports Indonesia and several SEA/HK markets.
- Good first integration because the hosted invoice flow is simple: create an invoice server-side and redirect the customer to the invoice URL.

Settings needed:
- `PAYMENT_PROCESSOR=xendit`
- `XENDIT_SECRET_KEY`
- `PAYMENT_USD_AMOUNT`, for example `197`
- `PAYMENT_USD_TO_IDR_RATE`, for example `16000`

Operational note:
- Display `$197` in the site, but send an IDR amount to Xendit. Show the approximate conversion to reduce disputes.

### Midtrans

Best fit: Indonesian payment gateway with broad local methods and card support.

What matters:
- Midtrans supports many payment methods, including bank transfer, e-wallets, credit cards, over-the-counter, direct debit, and cardless credit.
- Midtrans says transactions are processed in IDR; if selling in another currency, the amount should be converted to IDR before sending the request.
- Snap Redirect is a practical hosted-checkout flow: server creates a Snap transaction and redirects customer to `redirect_url`.

Settings needed:
- `PAYMENT_PROCESSOR=midtrans`
- `MIDTRANS_SERVER_KEY`
- `MIDTRANS_CLIENT_KEY` for reference/frontend readiness
- `MIDTRANS_IS_PRODUCTION=true` after testing
- `PAYMENT_USD_AMOUNT`
- `PAYMENT_USD_TO_IDR_RATE`

Operational note:
- Start in sandbox. Move to production keys only after at least one full test checkout flow.

### DOKU

Best fit: Indonesia-local payment gateway with hosted checkout and many payment methods.

What matters:
- DOKU has Payment Link, Checkout, Direct API, QRIS, and other products.
- DOKU Checkout returns a hosted `payment.url`.
- DOKU uses `Client-Id`, `Request-Id`, `Request-Timestamp`, `Request-Target`, body SHA-256 digest, and HMAC-SHA256 signature with Secret Key.

Settings needed:
- `PAYMENT_PROCESSOR=doku`
- `DOKU_CLIENT_ID`
- `DOKU_SECRET_KEY`
- `DOKU_IS_PRODUCTION=true` after testing
- `PAYMENT_USD_AMOUNT`
- `PAYMENT_USD_TO_IDR_RATE`

Operational note:
- DOKU is useful if Xendit/Midtrans onboarding rejects the business category or card approval is weaker.

### PayPal Business

Best fit: fallback for international buyers who already trust PayPal.

What matters:
- Use Business, not Personal, for commercial volume.
- Fees and currency conversion spread can be expensive.
- PayPal can hold/review funds, especially with sudden international volume, so it should not be the only rail.

Settings needed:
- `PAYMENT_PROCESSOR=paypal`
- `PAYPAL_BUSINESS_URL`, preferably a PayPal Business checkout/invoice/payment link, not only a casual PayPal.me personal link.

Operational note:
- Ask buyers to include business name/domain in the payment note.
- Keep CRM checkout activity because PayPal link payments may not auto-update without webhooks.

### Wise Business

Best fit: larger manual invoices and bank-transfer style payment collection.

What matters:
- Wise Business lets businesses receive in multiple currencies and share account details/payment requests, but availability depends on location/account eligibility.
- This is not a universal card checkout replacement.

Settings needed:
- `PAYMENT_PROCESSOR=wise`
- `WISE_PAYMENT_URL`

Operational note:
- Good for serious B2B buyers who can pay invoices. Less good for instant impulse checkout.

### Payoneer

Best fit: manual request-payment alternative for freelance/B2B clients.

What matters:
- Useful when clients can pay a Payoneer payment request.
- Not ideal as the only automated checkout rail.

Settings needed:
- `PAYMENT_PROCESSOR=payoneer`
- `PAYONEER_PAYMENT_URL`

Operational note:
- Keep invoice/request-payment records and match them manually in CRM unless a later webhook integration is added.

### Stripe

Stripe is worth monitoring because Stripe has Indonesia-specific support documentation, but for this workflow it is not the first implementation target. Confirm your exact entity type, onboarding eligibility, supported business category, payout currency, and tax setup before using it.

## Implementation Decision

The app should support these modes:

- `mock`: no external call; records checkout pending and returns WhatsApp/admin follow-up.
- `xendit`: create hosted invoice and redirect to invoice URL.
- `midtrans`: create Snap transaction and redirect to Snap URL.
- `doku`: create DOKU Checkout payment and redirect to payment URL.
- `paypal`: redirect to configured PayPal Business link.
- `wise`: redirect to configured Wise request/payment link.
- `payoneer`: redirect to configured Payoneer payment request link.
- `lemon_squeezy_legacy`: keep old Lemon integration only as legacy and show warning in Settings.

## Sources

- Lemon Squeezy prohibited products: https://docs.lemonsqueezy.com/help/getting-started/prohibited-products
- Xendit USD/international payments note: https://help.xendit.co/hc/en-us/articles/360035083551-Can-Xendit-help-me-accept-payments-in-USD-or-other-currencies
- Xendit payment methods/country support: https://www.xendit.co/en/products/all-payment-methods/
- Midtrans pricing/payment methods: https://midtrans.com/pricing
- Midtrans non-IDR guidance: https://docs.midtrans.com/docs/can-i-receive-payments-using-other-currency-than-idr
- Midtrans Snap integration/access keys: https://docs.midtrans.com/docs/snap-snap-integration-guide and https://docs.midtrans.com/docs/access-keys
- DOKU payment gateway: https://www.doku.com/en-us/products/payment-gateway
- DOKU Checkout backend integration: https://developers.doku.com/accept-payments/doku-checkout/integration-guide/backend-integration
- DOKU signature generation: https://dashboard.doku.com/docs/docs/technical-references/generate-signature/
- Wise Business receive money: https://wise.com/us/business/receive-money
- PayPal Business fees: https://www.paypal.com/us/business/paypal-business-fees
