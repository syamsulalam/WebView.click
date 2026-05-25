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

## USD-First Options Familiar to US Buyers

The short answer: yes, there are more USD-first alternatives, but most Lemon/Paddle-style Merchant of Record platforms are built for software, SaaS, templates, downloads, or automated digital products. They often reject custom web development, consulting, freelancing, manual services, or anything where the main value is human labor.

For the current WebView.click offer, the cleanest USD-first options are:

1. PayPal Business
2. Payoneer Request a Payment
3. Upwork Direct Contracts
4. Contra contracts/payments
5. Stripe through a properly formed US entity, if you want the most familiar card checkout

For a future productized self-serve offer, such as “downloadable website template pack”, “AI website generator SaaS subscription”, or “licensed generated site software”, then Merchant of Record tools like FastSpring, 2Checkout/Verifone, PayPro Global, Paddle, Polar, or Dodo may become more viable. For manual done-for-you service, they are risky unless support confirms approval in writing.

### Better Fit for Current Service Offer

| Option | USD-first? | Familiar to US buyers? | Fit for web dev service? | Notes |
| --- | --- | --- | --- | --- |
| PayPal Business | Yes | High | Good fallback | Use Business, not Personal. Good for US buyers, but account holds/disputes are still a risk. |
| Payoneer Request a Payment | Yes | Medium | Good B2B fallback | Supports requesting payment from global clients with card/bank/ACH-style options. Approval/feature availability can vary. |
| Upwork Direct Contracts | Yes | High for freelance/web work | Strong | Designed for freelance service contracts, escrow, credit card/PayPal/ACH. Not your own checkout API, but very trustable for US clients. |
| Contra | USD-centric | Medium | Strong | Designed for contractor/freelance work; clients can pay by major cards and bank account. Less familiar than Upwork/PayPal. |
| US LLC + Stripe | Yes | Very high | Strong if compliant | Best checkout UX, but requires entity, tax, bank, bookkeeping, and proper Stripe onboarding. Do not fake location/entity details. |

### Risky for Current Service Offer

| Option | USD-first? | Why risky |
| --- | --- | --- |
| Paddle | Yes | Their help docs say Paddle is built for software companies and that primary human services like consulting/design/IT services are not a good fit. |
| Polar | Yes | Acceptable use says acceptable products are software/digital goods/access; prohibited list includes human services. |
| Dodo Payments | Yes | Their policy explicitly prohibits “Manual Digital Services”, including custom design, development, freelancing, or consulting. |
| Lemon Squeezy | Yes | Prohibited-products docs prohibit services including web development/design/consulting. |
| Gumroad / Payhip / Ko-fi | Usually USD | More creator/digital-product oriented; may be okay for template/download products, but not a strong B2B web development checkout and can inherit Stripe/PayPal risk. |

### Possible but Needs Approval

| Option | USD-first? | Why it may still be useful |
| --- | --- | --- |
| FastSpring | Yes | MoR for software, SaaS, and digital goods/services. Could fit if WebView.click is positioned as software/SaaS/productized digital delivery, but custom service approval should be confirmed before integrating. |
| 2Checkout / Verifone | Yes | Broad global payment/currency support and mature checkout. Underwriting can be strict; confirm service category and Indonesia payout/onboarding before building deep integration. |
| PayPro Global | Yes | MoR for software/SaaS/digital products. Confirm whether productized website generation is accepted and whether manual setup/service labor is allowed. |

## Practical Path

For the current offer:

1. Keep Xendit/Midtrans/DOKU for Indonesia-local card checkout and IDR settlement.
2. Add PayPal Business as the most recognizable US fallback.
3. Add Payoneer Request a Payment for invoice-style USD B2B payment.
4. Add an optional “Pay via Upwork Direct Contract” or “Pay via Contra” manual link for clients who want escrow/trust.
5. Treat Stripe as the long-term best checkout only if you set up a proper supported entity and tax/accounting process.

For a future MoR-compatible offer:

1. Productize delivery so the buyer immediately receives a digital product or software access.
2. Separate “manual setup” into optional post-purchase support, or sell it through PayPal/Payoneer/Upwork/Contra instead.
3. Ask FastSpring, 2Checkout/Verifone, PayPro Global, Paddle, Polar, or Dodo support for written approval before using them for anything service-like.

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
- WebView.click has PayPal risk controls in `/admin/settings#settings-payment`: account mode, risk acknowledgement, editable payment note, and buyer-facing payment reference review before opening PayPal.
- See `docs/PAYPAL_RISK_CONTROLS.md` for the operating checklist and implementation tracker.

### Upwork Direct Contracts

Best fit: high-trust USD service payment for US buyers who want escrow and a familiar freelance workflow.

What matters:
- Upwork Direct Contracts are designed for freelancer-initiated contracts with clients outside the public marketplace.
- Clients can fund contracts with credit card, PayPal, or ACH/bank options.
- Upwork lists project costs in USD, with optional local currency conversion depending on the client.
- This is not a native checkout API. It is a manual link/workflow rail that can be placed in the admin/payment settings.

Settings needed:
- `UPWORK_DIRECT_CONTRACT_URL` if added later.

Operational note:
- Best for prospects who hesitate to pay an unknown overseas provider directly.
- Downside: more friction than a direct checkout button.

### Contra

Best fit: modern freelance/contractor payment rail for service work.

What matters:
- Contra is explicitly built around contract work and contractor payments.
- Clients can pay by major cards and, in some cases, bank account.
- Contra handles contractor payment workflow and compliance documents.
- It is less universally recognized than PayPal or Upwork, but it is more aligned with services than most MoRs.

Settings needed:
- `CONTRA_PAYMENT_URL` if added later.

Operational note:
- Use as a trust/escrow-style payment option, not as the default one-click checkout.

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

Stripe is the most familiar checkout UX for US buyers, but it is not the simple path for an Indonesia-based service seller. Stripe has Indonesia-specific support docs, but Stripe Indonesia is limited and not the same as a US Stripe account with USD settlement. A US LLC/Stripe Atlas-style setup can be a long-term route, but only if the entity, bank, tax, and actual operating facts are legitimate.

Settings needed if added later:
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID` or dynamic checkout configuration
- webhook signing secret

Operational note:
- Do not use workarounds that misrepresent your country/entity. That is a common path to account closure and held funds.

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
- Paddle acceptable use / not fit for primary human services: https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle
- Polar supported countries and MoR payouts: https://polar.sh/docs/merchant-of-record/supported-countries
- Polar acceptable use: https://polar.sh/legal/acceptable-use-policy
- Dodo merchant acceptance policy: https://docs.dodopayments.com/miscellaneous/merchant-acceptance
- Dodo MoR in Indonesia: https://dodopayments.com/blogs/merchant-of-record-in-indonesia/
- Stripe Indonesia support: https://support.stripe.com/questions/supported-payment-methods-currencies-and-businesses-for-stripe-accounts-in-indonesia
- FastSpring MoR docs: https://developer.fastspring.com/docs/getting-started-with-fastspring/
- FastSpring payment methods: https://developer.fastspring.com/docs/payment-methods-accepted-by-fastspring
- 2Checkout / Verifone payment methods: https://verifone.cloud/docs/2checkout/Documentation/03Billing-and-payments/Payment-methods
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
- Payoneer Request a Payment: https://www.payoneer.com/get-paid-by-clients/payment-request/
- Upwork Direct Contracts: https://support.upwork.com/hc/en-us/articles/360047918314-How-to-accept-and-fund-a-Direct-Contract
- Upwork payment currency note: https://support.upwork.com/hc/en-us/articles/211068028-How-to-pay-in-your-local-currency
- Contra global payments: https://contra.com/features/global-payments
