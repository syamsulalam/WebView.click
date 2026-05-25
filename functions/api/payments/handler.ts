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

export async function handlePayments(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown, segments: string[]): Promise<Response> {
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
    wisePaymentUrl,
    payoneerPaymentUrl,
    lemonApiKey,
    lemonStoreId,
    lemonVariantId,
  ] = await Promise.all([
    deps.getSetting(db, env, "PAYMENT_PROCESSOR"),
    deps.getSetting(db, env, "ADMIN_WHATSAPP_NUMBER"),
    deps.getSetting(db, env, "PAYMENT_USD_AMOUNT"),
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
  const paymentAmountUsd = Math.max(1, Number(paymentAmountUsdSetting || 197) || 197);
  const usdToIdrRate = Math.max(1, Number(usdToIdrRateSetting || 16000) || 16000);
  const amountIdr = Math.max(1000, Math.round(paymentAmountUsd * usdToIdrRate));
  const amountCents = Math.round(paymentAmountUsd * 100);
  const packageName = packageNameSetting || "WebView.click Done-for-you Website Setup";
  const packageDescription = packageDescriptionSetting || `$${paymentAmountUsd} total: domain/hosting coordination and done-for-you website setup.`;
  const adminWhatsApp = adminWhatsAppSetting || "081233838173";
  const orderId = `wv-${Date.now()}-${businessId}`.replace(/[^a-zA-Z0-9._~-]+/g, "-").slice(0, 50);

  const notifyText = encodeURIComponent(
    `WebView.click checkout request\nBusiness: ${businessName}\nDomain: ${requestedDomain || "-"}\nDomain mode: ${domainMode === "owned" ? "customer-owned domain" : "new domain registration"}\nProcessor: ${paymentProcessor}\nPackage: $${paymentAmountUsd} done-for-you website setup`,
  );
  const adminNotifyUrl = `https://wa.me/${normalizeWhatsAppNumber(adminWhatsApp)}?text=${notifyText}`;

  await deps.ensureRequiredColumns(db, deps.checkoutRequiredColumns);
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
    await deps.insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: row.id,
      staff_id: "system",
      activity_type: "checkout_pending",
      description: `Payment processor: ${paymentProcessor}. Domain request: ${requestedDomain || "not provided"} (${domainMode}). Amount: $${paymentAmountUsd} / approx IDR ${amountIdr}. Admin WA: ${adminNotifyUrl}`,
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
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: data.invoice_url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
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
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: data.redirect_url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
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
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
  }

  if (paymentProcessor === "paypal") {
    if (!paypalBusinessUrl) return mockResponse("PayPal Business link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["PAYPAL_BUSINESS_URL"]);
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: paypalBusinessUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
  }

  if (paymentProcessor === "wise") {
    if (!wisePaymentUrl) return mockResponse("Wise payment/request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["WISE_PAYMENT_URL"]);
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: wisePaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
  }

  if (paymentProcessor === "payoneer") {
    if (!payoneerPaymentUrl) return mockResponse("Payoneer payment request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["PAYONEER_PAYMENT_URL"]);
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: payoneerPaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
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
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: checkoutData.data.attributes.url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr });
  }

  return mockResponse("Payment processor belum dipilih atau masih mock. Checkout disimpan sebagai checkout_pending.");
}
