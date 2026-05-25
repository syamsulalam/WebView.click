type D1Result<T = unknown> = {
  results?: T[];
  success?: boolean;
  meta?: unknown;
  error?: string;
};

type D1PreparedStatement<T = unknown> = {
  bind: (...values: unknown[]) => D1PreparedStatement<T>;
  all: <R = T>() => Promise<D1Result<R>>;
  first: <R = T>() => Promise<R | null>;
  run: () => Promise<D1Result<T>>;
};

type D1DatabaseLike = {
  prepare: <T = unknown>(query: string) => D1PreparedStatement<T>;
};

export type PaymentsDeps = {
  json: (data: unknown, status?: number) => Response;
  errorJson: (error: string, status?: number, details?: unknown) => Response;
  readJsonBody: (request: Request) => Promise<Record<string, unknown>>;
  asString: (value: unknown, fallback?: string) => string;
  ensureRequiredColumns: (db: D1DatabaseLike, specs: unknown[]) => Promise<void>;
  checkoutRequiredColumns: unknown[];
  paymentLedgerRequiredColumns: unknown[];
  getSetting: (db: D1DatabaseLike, env: unknown, key: string) => Promise<string | undefined>;
  upsertLeadRecord: (db: D1DatabaseLike, values: Record<string, unknown>) => Promise<void>;
  insertCrmActivitySafe: (db: D1DatabaseLike, values: Record<string, unknown>) => Promise<void>;
};

function normalizeBusinessId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return slug || crypto.randomUUID();
}

function normalizeWhatsAppNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

async function sha256Base64(value: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(buffer));
}

async function hmacSha256Base64(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return bytesToBase64(new Uint8Array(signature));
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function paypalApiBase(isProduction: boolean) {
  return isProduction ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function getPaypalApiCredentials(deps: PaymentsDeps, db: D1DatabaseLike, env: unknown) {
  const [
    legacyClientId,
    legacyClientSecret,
    sandboxClientId,
    sandboxClientSecret,
    liveClientId,
    liveClientSecret,
    sandboxWebhookId,
    liveWebhookId,
    legacyWebhookId,
    productionSetting,
  ] = await Promise.all([
    deps.getSetting(db, env, "PAYPAL_CLIENT_ID"),
    deps.getSetting(db, env, "PAYPAL_CLIENT_SECRET"),
    deps.getSetting(db, env, "PAYPAL_SANDBOX_CLIENT_ID"),
    deps.getSetting(db, env, "PAYPAL_SANDBOX_CLIENT_SECRET"),
    deps.getSetting(db, env, "PAYPAL_LIVE_CLIENT_ID"),
    deps.getSetting(db, env, "PAYPAL_LIVE_CLIENT_SECRET"),
    deps.getSetting(db, env, "PAYPAL_SANDBOX_WEBHOOK_ID"),
    deps.getSetting(db, env, "PAYPAL_LIVE_WEBHOOK_ID"),
    deps.getSetting(db, env, "PAYPAL_WEBHOOK_ID"),
    deps.getSetting(db, env, "PAYPAL_IS_PRODUCTION"),
  ]);
  const isProduction = productionSetting === "true";
  return {
    isProduction,
    mode: isProduction ? "live" : "sandbox",
    productionSetting,
    clientId: isProduction ? firstString(liveClientId, legacyClientId) : firstString(sandboxClientId, legacyClientId),
    clientSecret: isProduction ? firstString(liveClientSecret, legacyClientSecret) : firstString(sandboxClientSecret, legacyClientSecret),
    webhookId: isProduction ? firstString(liveWebhookId, legacyWebhookId) : firstString(sandboxWebhookId, legacyWebhookId),
  };
}

async function paypalAccessToken(baseUrl: string, clientId: string, clientSecret: string) {
  const response = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const data = await response.json().catch(() => ({})) as { access_token?: string; error_description?: string; error?: string };
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || `PayPal token request failed with HTTP ${response.status}`);
  }
  return data.access_token;
}

async function verifyPaypalWebhookSignature(
  baseUrl: string,
  accessToken: string,
  webhookId: string,
  request: Request,
  event: Record<string, unknown>,
) {
  const payload = {
    auth_algo: request.headers.get("paypal-auth-algo") || "",
    cert_url: request.headers.get("paypal-cert-url") || "",
    transmission_id: request.headers.get("paypal-transmission-id") || "",
    transmission_sig: request.headers.get("paypal-transmission-sig") || "",
    transmission_time: request.headers.get("paypal-transmission-time") || "",
    webhook_id: webhookId,
    webhook_event: event,
  };
  const response = await fetch(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({})) as { verification_status?: string };
  return response.ok && data.verification_status === "SUCCESS";
}

function objectValue(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
}

function money(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2);
}

function clampCount(value: unknown) {
  const number = Math.floor(Number(value) || 0);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(number, 50);
}

function checkoutPricing(baseAmountUsd: number, addOnPageUsd: number, addOnsRaw: unknown) {
  const addOns = objectValue(addOnsRaw);
  const newPages = clampCount(addOns.newPages);
  const editedPages = clampCount(addOns.editedPages);
  const totalPageActions = newPages + editedPages;
  const discountRate = totalPageActions >= 10 ? 0.2 : totalPageActions >= 5 ? 0.1 : 0;
  const baseCents = Math.max(100, Math.round(baseAmountUsd * 100));
  const addOnUnitCents = Math.max(0, Math.round(addOnPageUsd * 100));
  const grossAddOnCents = totalPageActions * addOnUnitCents;
  const discountCents = Math.round(grossAddOnCents * discountRate);
  const addOnCents = Math.max(0, grossAddOnCents - discountCents);
  const totalCents = baseCents + addOnCents;
  return {
    baseUsd: baseCents / 100,
    addOnUnitUsd: addOnUnitCents / 100,
    newPages,
    editedPages,
    totalPageActions,
    discountRate,
    discountUsd: discountCents / 100,
    addOnUsd: addOnCents / 100,
    totalUsd: totalCents / 100,
    totalCents,
  };
}

function paypalCheckoutDescription(pricing: ReturnType<typeof checkoutPricing>, requestedDomain: string, domainMode: string) {
  const includedDomain = domainMode === "owned"
    ? "customer-owned domain connection"
    : `$17/year domain allowance for ${requestedDomain || "selected domain"}`;
  const addOns = pricing.totalPageActions > 0
    ? ` Includes ${pricing.totalPageActions} additional page/edit action${pricing.totalPageActions === 1 ? "" : "s"}${pricing.discountRate ? ` with ${Math.round(pricing.discountRate * 100)}% bulk discount` : ""}.`
    : "";
  return `$197/year includes ${includedDomain}, $180/year static hosting, SSL, DNS/upload, generated site launch, and free setup.${addOns}`;
}

async function createPaypalCheckoutOrder(options: {
  baseUrl: string;
  accessToken: string;
  requestId: string;
  packageName: string;
  businessName: string;
  businessId: string;
  requestedDomain: string;
  domainMode: string;
  customerEmail: string;
  paymentReference: string;
  origin: string;
  pricing: ReturnType<typeof checkoutPricing>;
}) {
  const addOnName = `Additional page/edit actions (${options.pricing.totalPageActions})`;
  const items = [
    {
      name: options.packageName.slice(0, 127),
      description: paypalCheckoutDescription(options.pricing, options.requestedDomain, options.domainMode).slice(0, 127),
      sku: "webview-annual-launch",
      unit_amount: { currency_code: "USD", value: money(options.pricing.baseUsd) },
      quantity: "1",
      category: "DIGITAL_GOODS",
    },
    ...(options.pricing.addOnUsd > 0 ? [{
      name: addOnName.slice(0, 127),
      description: `Flat-fee additional generated page or edit work. ${Math.round(options.pricing.discountRate * 100)}% bulk discount applied.`.slice(0, 127),
      sku: "webview-page-edit-addon",
      unit_amount: { currency_code: "USD", value: money(options.pricing.addOnUsd) },
      quantity: "1",
      category: "DIGITAL_GOODS",
    }] : []),
  ];
  const response = await fetch(`${options.baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
      "paypal-request-id": options.requestId,
      prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [{
        reference_id: "default",
        custom_id: options.businessId,
        invoice_id: options.paymentReference.slice(0, 127),
        description: `${options.packageName} for ${options.businessName}`.slice(0, 127),
        amount: {
          currency_code: "USD",
          value: money(options.pricing.totalUsd),
          breakdown: {
            item_total: { currency_code: "USD", value: money(options.pricing.totalUsd) },
          },
        },
        items,
      }],
      payment_source: {
        paypal: {
          experience_context: {
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            landing_page: "LOGIN",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            return_url: `${options.origin}/terms-refund`,
            cancel_url: `${options.origin}/terms-refund`,
          },
        },
      },
    }),
  });
  const data = await response.json().catch(() => ({})) as { id?: string; status?: string; links?: Array<{ href?: string; rel?: string; method?: string }>; message?: string; details?: unknown };
  if (!response.ok || !data.id) {
    throw new Error(data.message || JSON.stringify(data.details || data) || `PayPal create order failed with HTTP ${response.status}`);
  }
  return data;
}

function extractPaypalPaymentFromOrder(order: Record<string, unknown>, fallbackReference = "") {
  const purchaseUnits = Array.isArray(order.purchase_units) ? order.purchase_units : [];
  const firstPurchaseUnit = objectValue(purchaseUnits[0]);
  const payments = objectValue(firstPurchaseUnit.payments);
  const captures = Array.isArray(payments.captures) ? payments.captures : [];
  const capture = objectValue(captures[0]);
  const captureAmount = objectValue(capture.amount);
  const payer = objectValue(order.payer);
  const paymentSource = objectValue(order.payment_source);
  const paypalSource = objectValue(paymentSource.paypal);
  const reference = firstString(firstPurchaseUnit.invoice_id, fallbackReference);
  return {
    transactionId: firstString(capture.id, order.id),
    captureStatus: firstString(capture.status, order.status),
    payerEmail: firstString(paypalSource.email_address, payer.email_address),
    amountUsd: firstNumber(captureAmount.value),
    paymentReference: reference,
    businessId: firstString(firstPurchaseUnit.custom_id, reference.includes("|") ? reference.split("|")[0].trim() : ""),
  };
}

function extractPaypalPayment(event: Record<string, unknown>) {
  const resource = objectValue(event.resource);
  const purchaseUnits = Array.isArray(resource.purchase_units) ? resource.purchase_units : [];
  const firstPurchaseUnit = objectValue(purchaseUnits[0]);
  const payments = objectValue(firstPurchaseUnit.payments);
  const captures = Array.isArray(payments.captures) ? payments.captures : [];
  const capture = objectValue(captures[0]);
  const amount = objectValue(resource.amount);
  const captureAmount = objectValue(capture.amount);
  const payer = objectValue(resource.payer);
  const payerName = objectValue(payer.name);
  const reference = firstString(resource.invoice_id, firstPurchaseUnit.invoice_id, resource.custom_id, firstPurchaseUnit.custom_id);
  return {
    eventType: firstString(event.event_type),
    transactionId: firstString(capture.id, resource.id),
    payerEmail: firstString(payer.email_address, resource.payer_email),
    payerName: firstString(payerName.given_name, payerName.surname),
    amountUsd: firstNumber(captureAmount.value, amount.value),
    paymentReference: reference,
    businessId: reference.includes("|") ? reference.split("|")[0].trim() : firstString(resource.custom_id, firstPurchaseUnit.custom_id),
  };
}

async function recordPaypalWebhookPayment(deps: PaymentsDeps, db: D1DatabaseLike, event: Record<string, unknown>, verifiedBy: string) {
  await deps.ensureRequiredColumns(db, deps.paymentLedgerRequiredColumns);
  const payment = extractPaypalPayment(event);
  if (!payment.transactionId || !payment.amountUsd) {
    return { recorded: false, reason: "missing_transaction_or_amount", payment };
  }

  const existing = await db.prepare("SELECT id FROM lead_payments WHERE transaction_id = ? LIMIT 1").bind(payment.transactionId).first<{ id: string }>();
  if (existing?.id) {
    return { recorded: false, duplicate: true, paymentId: existing.id, payment };
  }

  const lead = payment.businessId
    ? await db.prepare("SELECT id, business_id, business_name FROM leads WHERE business_id = ?").bind(payment.businessId).first<{ id: string; business_id: string; business_name: string }>()
    : null;
  if (!lead?.id) {
    return { recorded: false, reason: "lead_not_matched", payment };
  }

  const now = new Date().toISOString();
  const pendingPayment = payment.paymentReference
    ? await db
      .prepare(
        `SELECT id FROM lead_payments
         WHERE lead_id = ? AND payment_status = 'pending' AND payment_reference = ?
         ORDER BY datetime(created_at) DESC
         LIMIT 1`,
      )
      .bind(lead.id, payment.paymentReference)
      .first<{ id: string }>()
    : null;
  const paymentId = pendingPayment?.id || crypto.randomUUID();
  if (pendingPayment?.id) {
    await db
      .prepare(
        `UPDATE lead_payments
         SET processor = 'paypal', payment_status = 'paid', amount_usd = ?, amount_idr = 0, transaction_id = ?, payer_email = ?,
             proof_notes = ?, raw_json = ?, verified_at = ?, verified_by = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(payment.amountUsd, payment.transactionId, payment.payerEmail, `Verified PayPal webhook event ${payment.eventType || "unknown"}.`, JSON.stringify(event), now, verifiedBy, now, paymentId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO lead_payments (
          id, lead_id, business_id, processor, payment_status, amount_usd, amount_idr,
          transaction_id, payer_email, payment_reference, proof_notes, raw_json, verified_at, verified_by, updated_at
        ) VALUES (?, ?, ?, 'paypal', 'paid', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        paymentId,
        lead.id,
        lead.business_id,
        payment.amountUsd,
        payment.transactionId,
        payment.payerEmail,
        payment.paymentReference,
        `Verified PayPal webhook event ${payment.eventType || "unknown"}.`,
        JSON.stringify(event),
        now,
        verifiedBy,
        now,
      )
      .run();
  }

  const subscription = await db.prepare("SELECT id FROM subscriptions WHERE lead_id = ? ORDER BY datetime(created_at) DESC LIMIT 1").bind(lead.id).first<{ id: string }>();
  if (subscription?.id) {
    await db
      .prepare(
        `UPDATE subscriptions
         SET package_type = ?, amount_paid = ?, payment_status = 'paid', payment_method = 'paypal', payment_reference = ?, subscription_start_date = COALESCE(subscription_start_date, ?), updated_at = ?
         WHERE id = ?`,
      )
      .bind("managed_launch_support", payment.amountUsd, payment.transactionId, now, now, subscription.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO subscriptions (id, lead_id, package_type, amount_paid, payment_status, payment_method, payment_reference, subscription_start_date, created_at, updated_at)
         VALUES (?, ?, 'managed_launch_support', ?, 'paid', 'paypal', ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), lead.id, payment.amountUsd, payment.transactionId, now, now, now)
      .run();
  }

  await db.prepare("UPDATE leads SET status = 'won_paid', email = COALESCE(NULLIF(?, ''), email), updated_at = ? WHERE id = ?").bind(payment.payerEmail, now, lead.id).run();
  await deps.insertCrmActivitySafe(db, {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    staff_id: verifiedBy,
    activity_type: "payment_verified",
    description: `PayPal webhook verified payment. Amount: $${payment.amountUsd}. Transaction: ${payment.transactionId}. Payer: ${payment.payerEmail || "not recorded"}. Reference: ${payment.paymentReference || "not recorded"}.`,
  });

  return { recorded: true, paymentId, payment };
}

async function handlePaypalWebhook(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown) {
  const event = await deps.readJsonBody(request);
  const credentials = await getPaypalApiCredentials(deps, db, env);

  if (!credentials.clientId || !credentials.clientSecret || !credentials.webhookId) {
    return deps.json({
      success: true,
      configured: false,
      ignored: true,
      mode: credentials.mode,
      message: `PayPal webhook endpoint is available but ${credentials.mode} API credentials/webhook ID are not configured yet.`,
    });
  }

  const baseUrl = paypalApiBase(credentials.isProduction);
  const accessToken = await paypalAccessToken(baseUrl, credentials.clientId, credentials.clientSecret);
  const verified = await verifyPaypalWebhookSignature(baseUrl, accessToken, credentials.webhookId, request, event);
  if (!verified) {
    return deps.errorJson("PayPal webhook signature verification failed.", 400);
  }

  const eventType = deps.asString(event.event_type);
  const shouldRecord = ["PAYMENT.CAPTURE.COMPLETED", "PAYMENT.SALE.COMPLETED"].includes(eventType);
  if (!shouldRecord) {
    return deps.json({ success: true, configured: true, verified: true, ignored: true, eventType });
  }

  const result = await recordPaypalWebhookPayment(deps, db, event, "paypal_webhook");
  return deps.json({ success: true, configured: true, verified: true, eventType, ...result });
}

async function recordPaypalCapturedOrder(
  deps: PaymentsDeps,
  db: D1DatabaseLike,
  order: Record<string, unknown>,
  paymentReference: string,
  verifiedBy: string,
) {
  await deps.ensureRequiredColumns(db, deps.paymentLedgerRequiredColumns);
  const payment = extractPaypalPaymentFromOrder(order, paymentReference);
  if (!payment.transactionId || !payment.amountUsd) {
    return { recorded: false, reason: "missing_transaction_or_amount", payment };
  }
  if (payment.captureStatus && payment.captureStatus !== "COMPLETED") {
    return { recorded: false, reason: "capture_not_completed", payment };
  }
  if (paymentReference && payment.paymentReference && payment.paymentReference !== paymentReference) {
    return { recorded: false, reason: "payment_reference_mismatch", payment };
  }

  const existing = await db.prepare("SELECT id FROM lead_payments WHERE transaction_id = ? LIMIT 1").bind(payment.transactionId).first<{ id: string }>();
  if (existing?.id) {
    return { recorded: false, duplicate: true, paymentId: existing.id, payment };
  }

  const lead = payment.businessId
    ? await db.prepare("SELECT id, business_id, business_name FROM leads WHERE business_id = ?").bind(payment.businessId).first<{ id: string; business_id: string; business_name: string }>()
    : null;
  if (!lead?.id) {
    return { recorded: false, reason: "lead_not_matched", payment };
  }

  const now = new Date().toISOString();
  const pendingPayment = payment.paymentReference
    ? await db
      .prepare(
        `SELECT id FROM lead_payments
         WHERE lead_id = ? AND payment_status = 'pending' AND payment_reference = ?
         ORDER BY datetime(created_at) DESC
         LIMIT 1`,
      )
      .bind(lead.id, payment.paymentReference)
      .first<{ id: string }>()
    : null;
  const paymentId = pendingPayment?.id || crypto.randomUUID();
  const rawJson = JSON.stringify({ source: "paypal_checkout_capture", order });
  if (pendingPayment?.id) {
    await db
      .prepare(
        `UPDATE lead_payments
         SET processor = 'paypal', payment_status = 'paid', amount_usd = ?, amount_idr = 0, transaction_id = ?, payer_email = ?,
             proof_notes = ?, raw_json = ?, verified_at = ?, verified_by = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(payment.amountUsd, payment.transactionId, payment.payerEmail, "Captured by PayPal Checkout Orders API.", rawJson, now, verifiedBy, now, paymentId)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO lead_payments (
          id, lead_id, business_id, processor, payment_status, amount_usd, amount_idr,
          transaction_id, payer_email, payment_reference, proof_notes, raw_json, verified_at, verified_by, updated_at
        ) VALUES (?, ?, ?, 'paypal', 'paid', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        paymentId,
        lead.id,
        lead.business_id,
        payment.amountUsd,
        payment.transactionId,
        payment.payerEmail,
        payment.paymentReference,
        "Captured by PayPal Checkout Orders API.",
        rawJson,
        now,
        verifiedBy,
        now,
      )
      .run();
  }

  const subscription = await db.prepare("SELECT id FROM subscriptions WHERE lead_id = ? ORDER BY datetime(created_at) DESC LIMIT 1").bind(lead.id).first<{ id: string }>();
  if (subscription?.id) {
    await db
      .prepare(
        `UPDATE subscriptions
         SET package_type = ?, amount_paid = ?, payment_status = 'paid', payment_method = 'paypal', payment_reference = ?, subscription_start_date = COALESCE(subscription_start_date, ?), updated_at = ?
         WHERE id = ?`,
      )
      .bind("managed_launch_support", payment.amountUsd, payment.transactionId, now, now, subscription.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO subscriptions (id, lead_id, package_type, amount_paid, payment_status, payment_method, payment_reference, subscription_start_date, created_at, updated_at)
         VALUES (?, ?, 'managed_launch_support', ?, 'paid', 'paypal', ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), lead.id, payment.amountUsd, payment.transactionId, now, now, now)
      .run();
  }

  await db.prepare("UPDATE leads SET status = 'won_paid', email = COALESCE(NULLIF(?, ''), email), updated_at = ? WHERE id = ?").bind(payment.payerEmail, now, lead.id).run();
  await deps.insertCrmActivitySafe(db, {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    staff_id: verifiedBy,
    activity_type: "payment_verified",
    description: `PayPal Checkout captured payment. Amount: $${payment.amountUsd}. Transaction: ${payment.transactionId}. Payer: ${payment.payerEmail || "not recorded"}. Reference: ${payment.paymentReference || "not recorded"}.`,
  });

  return { recorded: true, paymentId, payment };
}

async function handlePaypalCaptureOrder(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown) {
  const body = await deps.readJsonBody(request);
  const orderId = deps.asString(body.orderId || body.orderID).trim();
  const paymentReference = deps.asString(body.paymentReference).trim();
  if (!/^[A-Z0-9]{1,36}$/.test(orderId)) {
    return deps.errorJson("Invalid PayPal order ID.", 400);
  }

  const credentials = await getPaypalApiCredentials(deps, db, env);
  if (!credentials.clientId || !credentials.clientSecret) {
    return deps.errorJson(`PayPal ${credentials.mode} API credentials are not configured.`, 400, credentials.isProduction ? ["PAYPAL_LIVE_CLIENT_ID", "PAYPAL_LIVE_CLIENT_SECRET"] : ["PAYPAL_SANDBOX_CLIENT_ID", "PAYPAL_SANDBOX_CLIENT_SECRET"]);
  }

  const baseUrl = paypalApiBase(credentials.isProduction);
  const accessToken = await paypalAccessToken(baseUrl, credentials.clientId, credentials.clientSecret);
  const response = await fetch(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "paypal-request-id": `${orderId}-capture`,
      prefer: "return=representation",
    },
    body: "{}",
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    return deps.errorJson(firstString(data.message, `PayPal capture failed with HTTP ${response.status}`), 502, data);
  }

  const result = await recordPaypalCapturedOrder(deps, db, data, paymentReference, "paypal_checkout");
  if (!result.recorded && result.reason) {
    return deps.errorJson(`PayPal captured, but CRM recording failed: ${result.reason}`, 409, result);
  }
  return deps.json({ success: true, processor: "paypal", order: data, ...result });
}

export async function handlePayments(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown, segments: string[]): Promise<Response> {
  if (request.method === "POST" && segments[1] === "paypal-webhook") {
    return handlePaypalWebhook(deps, request, db, env);
  }

  if (request.method === "POST" && segments[1] === "paypal-capture-order") {
    return handlePaypalCaptureOrder(deps, request, db, env);
  }

  if (request.method !== "POST" || segments[1] !== "checkout") {
    return deps.errorJson("Not Found", 404);
  }

  const body = await deps.readJsonBody(request);
  const businessId = normalizeBusinessId(deps.asString(body.businessId, "demo-site"));
  const businessName = deps.asString(body.businessName, "Demo Site");
  const requestedDomain = deps.asString(body.domain);
  const domainMode = deps.asString(body.domainMode, "new") === "owned" ? "owned" : "new";
  const customerEmail = deps.asString(body.email);
  const origin = new URL(request.url).origin;
  const [
    selectedProcessorRaw,
    adminWhatsAppSetting,
    paymentAmountUsdSetting,
    paymentAddOnPageUsdSetting,
    usdToIdrRateSetting,
    packageNameSetting,
    packageDescriptionSetting,
    xenditSecretKey,
    midtransServerKey,
    midtransProductionSetting,
    dokuClientId,
    dokuSecretKey,
    dokuProductionSetting,
    paypalBusinessUrl,
    paypalAccountModeSetting,
    paypalRiskAcknowledgedSetting,
    paypalPaymentNoteSetting,
    paypalClientId,
    paypalClientSecret,
    paypalSandboxClientId,
    paypalSandboxClientSecret,
    paypalLiveClientId,
    paypalLiveClientSecret,
    paypalProductionSetting,
    wisePaymentUrl,
    payoneerPaymentUrl,
    lemonApiKey,
    lemonStoreId,
    lemonVariantId,
  ] = await Promise.all([
    deps.getSetting(db, env, "PAYMENT_PROCESSOR"),
    deps.getSetting(db, env, "ADMIN_WHATSAPP_NUMBER"),
    deps.getSetting(db, env, "PAYMENT_USD_AMOUNT"),
    deps.getSetting(db, env, "PAYMENT_ADDON_PAGE_USD"),
    deps.getSetting(db, env, "PAYMENT_USD_TO_IDR_RATE"),
    deps.getSetting(db, env, "PAYMENT_PACKAGE_NAME"),
    deps.getSetting(db, env, "PAYMENT_PACKAGE_DESCRIPTION"),
    deps.getSetting(db, env, "XENDIT_SECRET_KEY"),
    deps.getSetting(db, env, "MIDTRANS_SERVER_KEY"),
    deps.getSetting(db, env, "MIDTRANS_IS_PRODUCTION"),
    deps.getSetting(db, env, "DOKU_CLIENT_ID"),
    deps.getSetting(db, env, "DOKU_SECRET_KEY"),
    deps.getSetting(db, env, "DOKU_IS_PRODUCTION"),
    deps.getSetting(db, env, "PAYPAL_BUSINESS_URL"),
    deps.getSetting(db, env, "PAYPAL_ACCOUNT_MODE"),
    deps.getSetting(db, env, "PAYPAL_RISK_ACKNOWLEDGED"),
    deps.getSetting(db, env, "PAYPAL_PAYMENT_NOTE"),
    deps.getSetting(db, env, "PAYPAL_CLIENT_ID"),
    deps.getSetting(db, env, "PAYPAL_CLIENT_SECRET"),
    deps.getSetting(db, env, "PAYPAL_SANDBOX_CLIENT_ID"),
    deps.getSetting(db, env, "PAYPAL_SANDBOX_CLIENT_SECRET"),
    deps.getSetting(db, env, "PAYPAL_LIVE_CLIENT_ID"),
    deps.getSetting(db, env, "PAYPAL_LIVE_CLIENT_SECRET"),
    deps.getSetting(db, env, "PAYPAL_IS_PRODUCTION"),
    deps.getSetting(db, env, "WISE_PAYMENT_URL"),
    deps.getSetting(db, env, "PAYONEER_PAYMENT_URL"),
    deps.getSetting(db, env, "LEMON_SQUEEZY_API_KEY"),
    deps.getSetting(db, env, "LEMON_SQUEEZY_STORE_ID"),
    deps.getSetting(db, env, "LEMON_SQUEEZY_VARIANT_ID"),
  ]);
  const selectedProcessor = deps.asString(selectedProcessorRaw, "mock").toLowerCase();
  const paymentProcessor = ["xendit", "midtrans", "doku", "paypal", "wise", "payoneer", "lemon_squeezy_legacy"].includes(selectedProcessor)
    ? selectedProcessor
    : "mock";
  const basePaymentAmountUsd = Math.max(1, Number(paymentAmountUsdSetting || 197) || 197);
  const addOnPageUsd = Math.max(0, Number(paymentAddOnPageUsdSetting || 10) || 10);
  const pricing = checkoutPricing(basePaymentAmountUsd, addOnPageUsd, body.addOns);
  const paymentAmountUsd = pricing.totalUsd;
  const usdToIdrRate = Math.max(1, Number(usdToIdrRateSetting || 16000) || 16000);
  const amountIdr = Math.max(1000, Math.round(paymentAmountUsd * usdToIdrRate));
  const amountCents = Math.round(paymentAmountUsd * 100);
  const packageName = packageNameSetting || "WebView.click Done-for-you Website Setup";
  const packageDescription = packageDescriptionSetting || `$${basePaymentAmountUsd}/year: domain/hosting coordination and done-for-you website setup.`;
  const adminWhatsApp = adminWhatsAppSetting || "081233838173";
  const orderId = `wv-${Date.now()}-${businessId}`.replace(/[^a-zA-Z0-9._~-]+/g, "-").slice(0, 50);
  const paymentReference = `${businessId} | ${orderId}`.slice(0, 127);
  const paypalAccountMode = deps.asString(paypalAccountModeSetting, "business");
  const paypalRiskAcknowledged = deps.asString(paypalRiskAcknowledgedSetting) === "true";
  const paypalPaymentNote = deps.asString(
    paypalPaymentNoteSetting,
    "Please pay as goods/services or invoice payment, not Friends and Family. Include the business name, requested domain, and WebView.click payment reference in the payment note.",
  );
  const paypalRiskWarning = paypalAccountMode === "personal_bridge"
    ? "PayPal Personal is marked as a temporary bridge. Use goods/services or invoice-style payment, keep proof of delivery, avoid sudden volume jumps, and upgrade to PayPal Business before regular commercial use."
    : "PayPal can still hold or review funds for new sellers, unusual volume, disputes, or changed selling patterns. Keep delivery records and match the payment reference in CRM.";
  const paypalIsProduction = paypalProductionSetting === "true";
  const activePaypalClientId = paypalIsProduction ? firstString(paypalLiveClientId, paypalClientId) : firstString(paypalSandboxClientId, paypalClientId);
  const activePaypalClientSecret = paypalIsProduction ? firstString(paypalLiveClientSecret, paypalClientSecret) : firstString(paypalSandboxClientSecret, paypalClientSecret);
  const activePaypalMode = paypalIsProduction ? "live" : "sandbox";

  const notifyText = encodeURIComponent(
    `WebView.click checkout request\nBusiness: ${businessName}\nDomain: ${requestedDomain || "-"}\nDomain mode: ${domainMode === "owned" ? "customer-owned domain" : "new domain registration"}\nProcessor: ${paymentProcessor}\nPackage: $${paymentAmountUsd} done-for-you website setup`,
  );
  const adminNotifyUrl = `https://wa.me/${normalizeWhatsAppNumber(adminWhatsApp)}?text=${notifyText}`;

  await deps.ensureRequiredColumns(db, [...deps.checkoutRequiredColumns, ...deps.paymentLedgerRequiredColumns]);
  const leadId = crypto.randomUUID();
  await deps.upsertLeadRecord(db, {
    id: leadId,
    business_id: businessId,
    business_name: businessName,
    niche: "demo",
    email: customerEmail,
    status: "checkout_pending",
    view_count: 0,
    updated_at: new Date().toISOString(),
  });

  const row = await db.prepare("SELECT id FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string }>();
  if (row?.id) {
    const existingPendingPayment = await db
      .prepare("SELECT id FROM lead_payments WHERE lead_id = ? AND payment_reference = ? AND payment_status = 'pending' LIMIT 1")
      .bind(row.id, paymentReference)
      .first<{ id: string }>();
    if (!existingPendingPayment?.id) {
      await db
        .prepare(
          `INSERT INTO lead_payments (
            id, lead_id, business_id, processor, payment_status, amount_usd, amount_idr,
            transaction_id, payer_email, payment_reference, proof_notes, raw_json, updated_at
          ) VALUES (?, ?, ?, ?, 'pending', ?, ?, '', ?, ?, ?, ?, ?)`,
        )
        .bind(
          crypto.randomUUID(),
          row.id,
          businessId,
          paymentProcessor,
          paymentAmountUsd,
          amountIdr,
          customerEmail,
          paymentReference,
          "Checkout requested; waiting for manual payment verification.",
          JSON.stringify({ source: "checkout_request", businessId, businessName, requestedDomain, domainMode, paymentProcessor, paymentReference, pricing }),
          new Date().toISOString(),
        )
        .run();
    }
    await deps.insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: row.id,
      staff_id: "system",
      activity_type: "checkout_pending",
      description: `Payment processor: ${paymentProcessor}. Domain request: ${requestedDomain || "not provided"} (${domainMode}). Amount: $${paymentAmountUsd} / approx IDR ${amountIdr}. Payment reference: ${paymentReference}. Admin WA: ${adminNotifyUrl}`,
    });
  }

  const mockResponse = (message: string, missing: string[] = []) => deps.json({
    success: true,
    mock: true,
    processor: paymentProcessor,
    checkoutUrl: "",
    adminNotifyUrl,
    amountUsd: paymentAmountUsd,
    amountIdr,
    pricing,
    paymentReference,
    missing,
    message,
  });

  if (paymentProcessor === "xendit") {
    if (!xenditSecretKey) return mockResponse("Xendit belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["XENDIT_SECRET_KEY"]);
    const response = await fetch("https://api.xendit.co/v2/invoices", {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${xenditSecretKey}:`)}`, "content-type": "application/json" },
      body: JSON.stringify({
        external_id: orderId,
        amount: amountIdr,
        description: `${packageName} for ${businessName}`,
        payer_email: customerEmail || undefined,
        invoice_duration: 86400,
        success_redirect_url: `${origin}/admin/leads`,
        failure_redirect_url: `${origin}/admin/leads`,
        currency: "IDR",
        items: [{ name: packageName, quantity: 1, price: amountIdr, category: "services" }],
        metadata: { businessId, businessName, requestedDomain, domainMode, amountUsd: paymentAmountUsd },
      }),
    });
    const data = await response.json().catch(() => ({})) as { invoice_url?: string; error_code?: string; message?: string };
    if (!response.ok || !data.invoice_url) {
      return deps.json({ success: false, mock: true, processor: paymentProcessor, checkoutUrl: "", adminNotifyUrl, error: data.message || data.error_code || `Xendit returned HTTP ${response.status}`, message: "Xendit checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending." }, 502);
    }
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: data.invoice_url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing });
  }

  if (paymentProcessor === "midtrans") {
    if (!midtransServerKey) return mockResponse("Midtrans belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["MIDTRANS_SERVER_KEY"]);
    const endpoint = midtransProductionSetting === "true" ? "https://app.midtrans.com/snap/v1/transactions" : "https://app.sandbox.midtrans.com/snap/v1/transactions";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Basic ${btoa(`${midtransServerKey}:`)}`, "content-type": "application/json" },
      body: JSON.stringify({
        transaction_details: { order_id: orderId, gross_amount: amountIdr },
        item_details: [{ id: "webview-setup", price: amountIdr, quantity: 1, name: packageName.slice(0, 50) }],
        customer_details: { first_name: businessName.slice(0, 30), email: customerEmail || undefined },
        credit_card: { secure: true },
        custom_field1: businessId,
        custom_field2: requestedDomain,
        custom_field3: domainMode,
      }),
    });
    const data = await response.json().catch(() => ({})) as { redirect_url?: string; error_messages?: unknown };
    if (!response.ok || !data.redirect_url) {
      return deps.json({ success: false, mock: true, processor: paymentProcessor, checkoutUrl: "", adminNotifyUrl, error: data.error_messages || `Midtrans returned HTTP ${response.status}`, message: "Midtrans checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending." }, 502);
    }
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: data.redirect_url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing });
  }

  if (paymentProcessor === "doku") {
    if (!dokuClientId || !dokuSecretKey) return mockResponse("DOKU belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["DOKU_CLIENT_ID", "DOKU_SECRET_KEY"]);
    const requestTarget = "/checkout/v1/payment";
    const endpoint = dokuProductionSetting === "true" ? `https://api.doku.com${requestTarget}` : `https://api-sandbox.doku.com${requestTarget}`;
    const requestId = crypto.randomUUID();
    const requestTimestamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
    const dokuBody = {
      order: {
        amount: amountIdr,
        invoice_number: orderId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 30),
        currency: "IDR",
        callback_url: `${origin}/admin/leads`,
        callback_url_result: `${origin}/admin/leads`,
        language: "EN",
        auto_redirect: true,
        line_items: [{ id: "webviewsetup", name: packageName.slice(0, 80), quantity: 1, price: amountIdr, category: "services" }],
      },
      payment: { payment_due_date: 1440, type: "SALE" },
      customer: { id: businessId.slice(0, 50), name: businessName.slice(0, 80), email: customerEmail || undefined, country: "US" },
    };
    const bodyText = JSON.stringify(dokuBody);
    const digest = await sha256Base64(bodyText);
    const signaturePayload = [`Client-Id:${dokuClientId}`, `Request-Id:${requestId}`, `Request-Timestamp:${requestTimestamp}`, `Request-Target:${requestTarget}`, `Digest:${digest}`].join("\n");
    const signature = `HMACSHA256=${await hmacSha256Base64(dokuSecretKey, signaturePayload)}`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Client-Id": dokuClientId, "Request-Id": requestId, "Request-Timestamp": requestTimestamp, Signature: signature, "content-type": "application/json" },
      body: bodyText,
    });
    const data = await response.json().catch(() => ({})) as { response?: { payment?: { url?: string } }; error_messages?: unknown; message?: unknown };
    const checkoutUrl = data.response?.payment?.url || "";
    if (!response.ok || !checkoutUrl) {
      return deps.json({ success: false, mock: true, processor: paymentProcessor, checkoutUrl: "", adminNotifyUrl, error: data.error_messages || data.message || `DOKU returned HTTP ${response.status}`, message: "DOKU checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending." }, 502);
    }
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing });
  }

  if (paymentProcessor === "paypal") {
    if (activePaypalClientId && activePaypalClientSecret) {
      try {
        const baseUrl = paypalApiBase(paypalIsProduction);
        const accessToken = await paypalAccessToken(baseUrl, activePaypalClientId, activePaypalClientSecret);
        const paypalOrder = await createPaypalCheckoutOrder({
          baseUrl,
          accessToken,
          requestId: orderId,
          packageName,
          businessName,
          businessId,
          requestedDomain,
          domainMode,
          customerEmail,
          paymentReference,
          origin,
          pricing,
        });
        const approvalUrl = (paypalOrder.links || []).find((link) => link.rel === "payer-action" || link.rel === "approve")?.href || "";
        return deps.json({
          success: true,
          mock: false,
          processor: paymentProcessor,
          checkoutUrl: approvalUrl,
          adminNotifyUrl,
          amountUsd: paymentAmountUsd,
          amountIdr,
          pricing,
          paymentReference,
          paymentInstructions: "Review the package and approve payment in the PayPal window. The order is captured automatically after approval.",
          riskWarning: paypalRiskAcknowledged ? paypalRiskWarning : `${paypalRiskWarning} Admin has not acknowledged the PayPal risk checklist in Settings yet.`,
          requiresManualReview: false,
          manualConfirmationRequired: false,
          paypalInline: true,
          paypalClientId: activePaypalClientId,
          paypalMode: activePaypalMode,
          paypalOrderId: paypalOrder.id,
          paypalOrderStatus: paypalOrder.status,
        });
      } catch (error) {
        return deps.json({
          success: Boolean(paypalBusinessUrl),
          mock: false,
          processor: paymentProcessor,
          checkoutUrl: paypalBusinessUrl || "",
          adminNotifyUrl,
          error: error instanceof Error ? error.message : String(error),
          message: paypalBusinessUrl
            ? "PayPal API checkout failed. Falling back to the configured PayPal Business link for manual review."
            : "PayPal API checkout failed and no fallback PayPal Business link is configured. Request tetap dicatat sebagai checkout_pending.",
          amountUsd: paymentAmountUsd,
          amountIdr,
          pricing,
          paymentReference,
          paymentInstructions: `${paypalPaymentNote} Reference: ${paymentReference}`,
          requiresManualReview: Boolean(paypalBusinessUrl),
          manualConfirmationRequired: Boolean(paypalBusinessUrl),
        }, paypalBusinessUrl ? 200 : 502);
      }
    }

    if (!paypalBusinessUrl) return mockResponse(`PayPal ${activePaypalMode} API credentials atau PayPal Business link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.`, paypalIsProduction ? ["PAYPAL_LIVE_CLIENT_ID", "PAYPAL_LIVE_CLIENT_SECRET"] : ["PAYPAL_SANDBOX_CLIENT_ID", "PAYPAL_SANDBOX_CLIENT_SECRET"]);
    return deps.json({
      success: true,
      mock: false,
      processor: paymentProcessor,
      checkoutUrl: paypalBusinessUrl,
      adminNotifyUrl,
      amountUsd: paymentAmountUsd,
      amountIdr,
      pricing,
      paymentReference,
      paymentInstructions: `${paypalPaymentNote} Reference: ${paymentReference}`,
      riskWarning: paypalRiskAcknowledged ? paypalRiskWarning : `${paypalRiskWarning} Admin has not acknowledged the PayPal risk checklist in Settings yet.`,
      requiresManualReview: true,
      manualConfirmationRequired: true,
    });
  }

  if (paymentProcessor === "wise") {
    if (!wisePaymentUrl) return mockResponse("Wise payment/request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["WISE_PAYMENT_URL"]);
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: wisePaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, paymentReference, paymentInstructions: `Include this WebView.click payment reference in the payment memo: ${paymentReference}`, requiresManualReview: true, manualConfirmationRequired: true });
  }

  if (paymentProcessor === "payoneer") {
    if (!payoneerPaymentUrl) return mockResponse("Payoneer payment request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["PAYONEER_PAYMENT_URL"]);
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: payoneerPaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, paymentReference, paymentInstructions: `Include this WebView.click payment reference in the payment memo: ${paymentReference}`, requiresManualReview: true, manualConfirmationRequired: true });
  }

  if (paymentProcessor === "lemon_squeezy_legacy") {
    if (!lemonApiKey || !lemonStoreId || !lemonVariantId) {
      return mockResponse("Legacy Lemon Squeezy belum lengkap. Checkout disimpan sebagai mock checkout_pending.", ["LEMON_SQUEEZY_API_KEY", "LEMON_SQUEEZY_STORE_ID", "LEMON_SQUEEZY_VARIANT_ID"]);
    }
    const checkoutResponse = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: { accept: "application/vnd.api+json", authorization: `Bearer ${lemonApiKey}`, "content-type": "application/vnd.api+json" },
      body: JSON.stringify({
        data: {
          type: "checkouts",
          attributes: {
            custom_price: amountCents,
            product_options: { name: packageName, description: packageDescription, redirect_url: `${origin}/admin/leads` },
            checkout_data: { email: customerEmail || undefined, custom: { business_id: businessId, business_name: businessName, requested_domain: requestedDomain, domain_mode: domainMode, admin_whatsapp: adminWhatsApp } },
          },
          relationships: { store: { data: { type: "stores", id: lemonStoreId } }, variant: { data: { type: "variants", id: lemonVariantId } } },
        },
      }),
    });
    const checkoutData = await checkoutResponse.json() as { data?: { attributes?: { url?: string } }; errors?: unknown };
    if (!checkoutResponse.ok || !checkoutData.data?.attributes?.url) {
      return deps.json({ success: false, mock: true, processor: paymentProcessor, checkoutUrl: "", adminNotifyUrl, error: checkoutData.errors || `Lemon Squeezy returned HTTP ${checkoutResponse.status}`, message: "Legacy Lemon checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending." }, 502);
    }
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: checkoutData.data.attributes.url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing });
  }

  return mockResponse("Payment processor belum dipilih atau masih mock. Checkout disimpan sebagai checkout_pending.");
}
