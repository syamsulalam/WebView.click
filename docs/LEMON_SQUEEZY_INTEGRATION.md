# Lemon Squeezy Integration Notes

Last updated: 18 Mei 2026.

Dokumen ini merangkum rencana integrasi Lemon Squeezy untuk paket WebView.click `$197 Domain + Hosting + Free Setup`.

Status: legacy only. Lemon Squeezy's prohibited-products documentation currently prohibits services of any kind, including web development/design/consulting. Do not use this as the default processor for the current done-for-you service offer. See `docs/PAYMENT_PROCESSOR_RESEARCH.md`.

Sources:
- API requests/auth: https://docs.lemonsqueezy.com/api/getting-started/requests
- Create checkout: https://docs.lemonsqueezy.com/api/checkouts/create-checkout
- Checkout object: https://docs.lemonsqueezy.com/api/checkouts/the-checkout-object
- Taking payments guide: https://docs.lemonsqueezy.com/guides/developer-guide/taking-payments
- Webhooks: https://docs.lemonsqueezy.com/help/webhooks
- Variants: https://docs.lemonsqueezy.com/api/variants/list-all-variants

## Current Product Offer

Package:
- `$197` one-time.
- Domain for 1 year.
- Hosting for 1 year.
- Pricing note shown in UI: `$15/month x 12 months + free setup`.
- Admin processes domain/setup after payment.

## Settings Required

Managed from `/admin/settings`:
- `LEMON_SQUEEZY_API_KEY`
- `LEMON_SQUEEZY_STORE_ID`
- `LEMON_SQUEEZY_VARIANT_ID`
- `ADMIN_WHATSAPP_NUMBER`

Fallback/mock:
- If any Lemon Squeezy setting is missing, `/api/payments/checkout` returns mock mode.
- Mock mode still creates/updates a lead with `checkout_pending`.
- Mock mode returns a WhatsApp notification URL for admin follow-up.

## API Pattern

Lemon Squeezy API:
- Base URL: `https://api.lemonsqueezy.com/v1`
- Requests use JSON:API.
- Required headers:
  - `Accept: application/vnd.api+json`
  - `Content-Type: application/vnd.api+json`
  - `Authorization: Bearer {api_key}`

Create checkout endpoint:
- `POST /v1/checkouts`
- Requires relationships:
  - `store`
  - `variant`
- Useful attributes:
  - `custom_price`: integer in cents, so `$197.00` is `19700`.
  - `product_options.name`
  - `product_options.description`
  - `product_options.redirect_url`
  - `checkout_data.email`
  - `checkout_data.custom`

WebView.click currently sends:
- business ID
- business name
- requested domain
- admin WhatsApp number
- customer email if supplied

## Current Endpoint

File: `functions/api/[[path]].ts`

Endpoint:
- `POST /api/payments/checkout`

Request body:

```json
{
  "businessId": "kopi-senja-jakarta",
  "businessName": "Kopi Senja Jakarta",
  "domain": "kopisenja.com",
  "email": "owner@example.com"
}
```

Success response with configured Lemon Squeezy:

```json
{
  "success": true,
  "mock": false,
  "checkoutUrl": "https://...",
  "adminNotifyUrl": "https://wa.me/..."
}
```

Mock response:

```json
{
  "success": true,
  "mock": true,
  "checkoutUrl": "",
  "adminNotifyUrl": "https://wa.me/...",
  "message": "Lemon Squeezy belum dikonfigurasi..."
}
```

## Lead Status

When checkout is requested:
- `leads.status` is set to `checkout_pending`.
- A CRM activity is inserted with requested domain and admin WhatsApp URL.

Admin UI:
- `/admin/leads` has `Checkout Pending` in the status dropdown.

## Webhooks To Add Later

Recommended events:
- `order_created`
- `order_refunded`
- `subscription_created` only if this becomes recurring later
- `subscription_cancelled` only if this becomes recurring later

Webhook handler should:
- Verify Lemon Squeezy signature using signing secret.
- Read `checkout_data.custom.business_id`.
- Update lead status to `won_paid` after successful order.
- Store order ID, customer email, amount, and domain request.
- Trigger admin notification through WhatsApp provider when available.

## Notes

- Keep API key server-side only in D1/env, never client-side.
- Use test mode before production checkout.
- Store ID and Variant ID can be found via dashboard or API list endpoints.
- The current implementation uses one fixed variant plus `custom_price` for the `$197` offer.
