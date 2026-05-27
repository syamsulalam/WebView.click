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

function parseJsonObject(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return {};
  try {
    const parsed = JSON.parse(value);
    return objectValue(parsed);
  } catch {
    return {};
  }
}

function mergedPaymentRawJson(existingRawJson: unknown, update: Record<string, unknown>) {
  const existing = parseJsonObject(existingRawJson);
  return JSON.stringify({
    ...existing,
    ...update,
    previousSource: existing.source && existing.source !== update.source ? existing.source : undefined,
  });
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

function clampTermYears(value: unknown) {
  const number = Math.floor(Number(value) || 1);
  if (!Number.isFinite(number) || number < 1) return 1;
  return Math.min(number, 10);
}

function termDiscountRate(years: number) {
  if (years >= 10) return 0.5;
  if (years >= 2) return Math.min(0.4, (years - 1) * 0.05);
  return 0;
}

function checkoutPricing(baseAmountUsd: number, domainFeeUsd: number, addOnPageUsd: number, domainMode: string, addOnsRaw: unknown, billingPlanRaw: unknown) {
  const addOns = objectValue(addOnsRaw);
  const billingPlan = objectValue(billingPlanRaw);
  const termYears = clampTermYears(billingPlan.termYears);
  const billingCadence = firstString(billingPlan.billingCadence) === "annual_recurring" ? "annual_recurring" : "upfront";
  const packageDiscountRate = termDiscountRate(termYears);
  const newPages = clampCount(addOns.newPages);
  const editedPages = clampCount(addOns.editedPages);
  const totalPageActions = newPages + editedPages;
  const discountRate = totalPageActions >= 10 ? 0.2 : totalPageActions >= 5 ? 0.1 : 0;
  const domainFeeCents = domainMode === "new" ? Math.max(0, Math.round(domainFeeUsd * 100)) : 0;
  const baseCents = Math.max(100, Math.round(baseAmountUsd * 100));
  const hostingCents = Math.max(100, baseCents - Math.max(0, Math.round(domainFeeUsd * 100)));
  const hostingDiscountedCents = Math.max(100, Math.round(hostingCents * (1 - packageDiscountRate)));
  const annualDiscountedCents = hostingDiscountedCents + domainFeeCents;
  const packageTermTotalCents = annualDiscountedCents * termYears;
  const packageDueTodayCents = billingCadence === "annual_recurring" ? annualDiscountedCents : packageTermTotalCents;
  const packageSavingsCents = Math.max(0, (hostingCents * termYears) - (hostingDiscountedCents * termYears));
  const addOnUnitCents = Math.max(0, Math.round(addOnPageUsd * 100));
  const grossAddOnCents = totalPageActions * addOnUnitCents;
  const discountCents = Math.round(grossAddOnCents * discountRate);
  const addOnCents = Math.max(0, grossAddOnCents - discountCents);
  const totalCents = packageDueTodayCents + addOnCents;
  return {
    baseUsd: baseCents / 100,
    hostingAnnualUsd: hostingCents / 100,
    hostingAfterDiscountUsd: hostingDiscountedCents / 100,
    domainAnnualUsd: domainFeeCents / 100,
    packageDueTodayUsd: packageDueTodayCents / 100,
    packageTermTotalUsd: packageTermTotalCents / 100,
    packageSavingsUsd: packageSavingsCents / 100,
    annualDiscountedUsd: annualDiscountedCents / 100,
    termYears,
    billingCadence,
    termDiscountRate: packageDiscountRate,
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

function checkoutSetupRequest(pricing: ReturnType<typeof checkoutPricing>, setupRaw: unknown) {
  const setup = objectValue(setupRaw);
  const rawNewPages = Array.isArray(setup.newPageRequests) ? setup.newPageRequests : [];
  const rawEditPages = Array.isArray(setup.editPageRequests) ? setup.editPageRequests : [];
  const newPageRequests = rawNewPages.slice(0, pricing.newPages).map((item, index) => {
    const value = objectValue(item);
    return {
      index: index + 1,
      title: firstString(value.title, item).slice(0, 160),
    };
  }).filter((item) => item.title);
  const editPageRequests = rawEditPages.slice(0, pricing.editedPages).map((item, index) => {
    const value = objectValue(item);
    return {
      index: index + 1,
      pageId: firstString(value.pageId).slice(0, 120),
      pageLabel: firstString(value.pageLabel, value.pageId).slice(0, 160),
      notes: firstString(value.notes).slice(0, 600),
    };
  }).filter((item) => item.pageId || item.notes);
  const lines = [
    pricing.newPages > 0 ? `Pages to add (${pricing.newPages}): ${newPageRequests.map((item) => `#${item.index} ${item.title}`).join("; ") || "details not provided"}` : "",
    pricing.editedPages > 0 ? `Pages to edit (${pricing.editedPages}): ${editPageRequests.map((item) => `#${item.index} ${item.pageLabel || item.pageId}: ${item.notes || "details not provided"}`).join("; ") || "details not provided"}` : "",
  ].filter(Boolean);
  const setupNote = lines.length
    ? lines.join("\n")
    : "No requested page additions or existing-page edits.";
  return {
    mode: pricing.totalPageActions > 0 ? "page_work_requested" : "base_setup_only",
    newPages: pricing.newPages,
    editedPages: pricing.editedPages,
    newPageRequests,
    editPageRequests,
    setupNote,
  };
}

function checkoutDomainQuote(domainMode: string, requestedDomain: string, quoteRaw: unknown) {
  if (domainMode !== "new") return null;
  const quote = objectValue(quoteRaw);
  const domain = firstString(quote.domain);
  if (!domain || domain !== requestedDomain) return null;
  const raw = quote.raw;
  return {
    provider: firstString(quote.provider),
    domain,
    registrable: quote.registrable === true,
    currency: firstString(quote.currency, "USD"),
    registrationUsd: firstNumber(quote.registrationUsd),
    renewalUsd: firstNumber(quote.renewalUsd),
    premium: quote.premium === true,
    reason: firstString(quote.reason),
    checkedAt: firstString(quote.checkedAt),
    expiresAt: firstString(quote.expiresAt),
    withinMaxPrice: quote.withinMaxPrice !== false,
    maxRegistrationUsd: firstNumber(quote.maxRegistrationUsd),
    supportedForMvp: quote.supportedForMvp !== false,
    tld: firstString(quote.tld),
    raw: raw === undefined ? undefined : raw,
  };
}

function paypalCheckoutDescription(pricing: ReturnType<typeof checkoutPricing>, requestedDomain: string, domainMode: string) {
  const includedDomain = domainMode === "owned"
    ? "customer-owned domain connection with no domain fee"
    : `$17/year domain fee for ${requestedDomain || "selected domain"}`;
  const billing = pricing.billingCadence === "annual_recurring"
    ? `${pricing.termYears}-year yearly billing at $${money(pricing.annualDiscountedUsd)}/year`
    : `${pricing.termYears}-year prepaid term`;
  const addOns = pricing.totalPageActions > 0
    ? ` Includes ${pricing.totalPageActions} additional page/edit action${pricing.totalPageActions === 1 ? "" : "s"}${pricing.discountRate ? ` with ${Math.round(pricing.discountRate * 100)}% bulk discount` : ""}.`
    : "";
  return `$${money(pricing.hostingAnnualUsd)}/year managed hosting${domainMode === "owned" ? "" : " plus domain fee"} includes ${includedDomain}, SSL, DNS/upload, generated site launch, and free setup. Selected billing: ${billing}.${addOns}`;
}

async function createPaypalSubscriptionPlan(options: {
  baseUrl: string;
  accessToken: string;
  requestId: string;
  packageName: string;
  businessName: string;
  requestedDomain: string;
  domainMode: string;
  pricing: ReturnType<typeof checkoutPricing>;
}) {
  const productResponse = await fetch(`${options.baseUrl}/v1/catalogs/products`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      "content-type": "application/json",
      "paypal-request-id": `${options.requestId}-product`,
      prefer: "return=representation",
    },
    body: JSON.stringify({
      name: "WebView.click Managed Website",
      description: `Managed website setup and yearly hosting for ${options.businessName}`.slice(0, 256),
      type: "SERVICE",
      category: "SOFTWARE",
    }),
  });
  const product = await productResponse.json().catch(() => ({})) as { id?: string; message?: string; details?: unknown };
  if (!productResponse.ok || !product.id) {
    throw new Error(product.message || JSON.stringify(product.details || product) || `PayPal create product failed with HTTP ${productResponse.status}`);
  }

  const planResponse = await fetch(`${options.baseUrl}/v1/billing/plans`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${options.accessToken}`,
      accept: "application/json",
      "content-type": "application/json",
      "paypal-request-id": `${options.requestId}-plan`,
      prefer: "return=representation",
    },
    body: JSON.stringify({
      product_id: product.id,
      name: `${options.packageName} - ${money(options.pricing.annualDiscountedUsd)}/year`.slice(0, 127),
      description: paypalCheckoutDescription(options.pricing, options.requestedDomain, options.domainMode).slice(0, 127),
      billing_cycles: [{
        frequency: { interval_unit: "YEAR", interval_count: 1 },
        tenure_type: "REGULAR",
        sequence: 1,
        total_cycles: options.pricing.termYears,
        pricing_scheme: {
          fixed_price: { value: money(options.pricing.annualDiscountedUsd), currency_code: "USD" },
        },
      }],
      payment_preferences: {
        auto_bill_outstanding: true,
        ...(options.pricing.addOnUsd > 0 ? {
          setup_fee: { value: money(options.pricing.addOnUsd), currency_code: "USD" },
          setup_fee_failure_action: "CANCEL",
        } : {}),
        payment_failure_threshold: 3,
      },
      taxes: { percentage: "0", inclusive: false },
    }),
  });
  const plan = await planResponse.json().catch(() => ({})) as { id?: string; status?: string; links?: unknown; message?: string; details?: unknown };
  if (!planResponse.ok || !plan.id) {
    throw new Error(plan.message || JSON.stringify(plan.details || plan) || `PayPal create subscription plan failed with HTTP ${planResponse.status}`);
  }
  return { product, plan };
}

function paypalSubscriptionPlanCacheKey(mode: string, pricing: ReturnType<typeof checkoutPricing>, domainMode: string) {
  return [
    "PAYPAL_SUBSCRIPTION_PLAN",
    mode,
    domainMode,
    `term_${pricing.termYears}`,
    `annual_${money(pricing.annualDiscountedUsd)}`,
    `hosting_${money(pricing.hostingAfterDiscountUsd)}`,
    `domain_${money(pricing.domainAnnualUsd)}`,
    `setup_${money(pricing.addOnUsd)}`,
  ].join("__");
}

function usableCachedPaypalPlan(value: unknown, pricing: ReturnType<typeof checkoutPricing>, domainMode: string) {
  const cached = parseJsonObject(value);
  const planId = firstString(cached.planId);
  if (!planId) return null;
  const annual = firstNumber(cached.annualUsd);
  const setup = firstNumber(cached.setupFeeUsd);
  const termYears = Math.floor(firstNumber(cached.termYears));
  if (Math.abs(annual - pricing.annualDiscountedUsd) > 0.001) return null;
  if (Math.abs(setup - pricing.addOnUsd) > 0.001) return null;
  if (termYears !== pricing.termYears) return null;
  if (firstString(cached.domainMode) !== domainMode) return null;
  return {
    product: { id: firstString(cached.productId) },
    plan: { id: planId, status: firstString(cached.planStatus, "ACTIVE"), cached: true },
    cached,
  };
}

async function getCachedPaypalSubscriptionPlan(db: D1DatabaseLike, key: string, pricing: ReturnType<typeof checkoutPricing>, domainMode: string) {
  try {
    const row = await db.prepare("SELECT value FROM system_settings WHERE key = ?").bind(key).first<{ value?: string }>();
    return usableCachedPaypalPlan(row?.value, pricing, domainMode);
  } catch (error) {
    console.error("PayPal subscription plan cache read failed, continuing without cache:", error);
    return null;
  }
}

async function saveCachedPaypalSubscriptionPlan(db: D1DatabaseLike, key: string, mode: string, pricing: ReturnType<typeof checkoutPricing>, domainMode: string, paypalSubscription: { product: { id?: string }; plan: { id?: string; status?: string } }) {
  if (!paypalSubscription.plan.id) return;
  const value = JSON.stringify({
    provider: "paypal",
    mode,
    domainMode,
    termYears: pricing.termYears,
    annualUsd: pricing.annualDiscountedUsd,
    hostingAnnualUsd: pricing.hostingAnnualUsd,
    hostingAfterDiscountUsd: pricing.hostingAfterDiscountUsd,
    domainAnnualUsd: pricing.domainAnnualUsd,
    setupFeeUsd: pricing.addOnUsd,
    productId: paypalSubscription.product.id || "",
    planId: paypalSubscription.plan.id,
    planStatus: paypalSubscription.plan.status || "ACTIVE",
    updatedAt: new Date().toISOString(),
  });
  try {
    await db
      .prepare(
        `INSERT INTO system_settings (key, value, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      )
      .bind(key, value, new Date().toISOString())
      .run();
  } catch (error) {
    console.error("PayPal subscription plan cache write failed, continuing:", error);
  }
}

async function getOrCreatePaypalSubscriptionPlan(options: {
  db: D1DatabaseLike;
  baseUrl: string;
  accessToken: string;
  requestId: string;
  packageName: string;
  businessName: string;
  requestedDomain: string;
  domainMode: string;
  paypalMode: string;
  pricing: ReturnType<typeof checkoutPricing>;
}) {
  const cacheKey = paypalSubscriptionPlanCacheKey(options.paypalMode, options.pricing, options.domainMode);
  const cached = await getCachedPaypalSubscriptionPlan(options.db, cacheKey, options.pricing, options.domainMode);
  if (cached) return { ...cached, cacheKey };
  const created = await createPaypalSubscriptionPlan(options);
  await saveCachedPaypalSubscriptionPlan(options.db, cacheKey, options.paypalMode, options.pricing, options.domainMode, created);
  return { ...created, cacheKey };
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
      unit_amount: { currency_code: "USD", value: money(options.pricing.packageDueTodayUsd) },
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
        `SELECT id, raw_json FROM lead_payments
         WHERE lead_id = ? AND payment_status = 'pending' AND payment_reference = ?
         ORDER BY datetime(created_at) DESC
         LIMIT 1`,
      )
      .bind(lead.id, payment.paymentReference)
      .first<{ id: string; raw_json?: string }>()
    : null;
  const paymentId = pendingPayment?.id || crypto.randomUUID();
  const rawJson = mergedPaymentRawJson(pendingPayment?.raw_json, { source: "paypal_webhook", event });
  if (pendingPayment?.id) {
    await db
      .prepare(
        `UPDATE lead_payments
         SET processor = 'paypal', payment_status = 'paid', amount_usd = ?, amount_idr = 0, transaction_id = ?, payer_email = ?,
             proof_notes = ?, raw_json = ?, verified_at = ?, verified_by = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(payment.amountUsd, payment.transactionId, payment.payerEmail, `Verified PayPal webhook event ${payment.eventType || "unknown"}.`, rawJson, now, verifiedBy, now, paymentId)
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
  const resource = objectValue(event.resource);
  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
    const result = await recordPaypalApprovedSubscription(deps, db, resource, firstString(resource.custom_id), "paypal_webhook");
    return deps.json({ success: true, configured: true, verified: true, eventType, ...result });
  }
  if (eventType === "PAYMENT.SALE.COMPLETED" && firstString(resource.billing_agreement_id)) {
    const result = await recordPaypalSubscriptionSale(deps, db, event, "paypal_webhook");
    return deps.json({ success: true, configured: true, verified: true, eventType, ...result });
  }

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
        `SELECT id, raw_json FROM lead_payments
         WHERE lead_id = ? AND payment_status = 'pending' AND payment_reference = ?
         ORDER BY datetime(created_at) DESC
         LIMIT 1`,
      )
      .bind(lead.id, payment.paymentReference)
      .first<{ id: string; raw_json?: string }>()
    : null;
  const paymentId = pendingPayment?.id || crypto.randomUUID();
  const rawJson = mergedPaymentRawJson(pendingPayment?.raw_json, { source: "paypal_checkout_capture", order });
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

function extractPaypalSubscription(value: Record<string, unknown>, fallbackReference = "") {
  const subscriber = objectValue(value.subscriber);
  const billingInfo = objectValue(value.billing_info);
  const lastPayment = objectValue(billingInfo.last_payment);
  const lastAmount = objectValue(lastPayment.amount);
  return {
    subscriptionId: firstString(value.id),
    status: firstString(value.status),
    planId: firstString(value.plan_id),
    payerEmail: firstString(subscriber.email_address),
    paymentReference: firstString(value.custom_id, fallbackReference),
    amountUsd: firstNumber(lastAmount.value),
  };
}

async function recordPaypalApprovedSubscription(
  deps: PaymentsDeps,
  db: D1DatabaseLike,
  subscription: Record<string, unknown>,
  paymentReference: string,
  verifiedBy: string,
) {
  await deps.ensureRequiredColumns(db, deps.paymentLedgerRequiredColumns);
  const payment = extractPaypalSubscription(subscription, paymentReference);
  if (!payment.subscriptionId) {
    return { recorded: false, reason: "missing_subscription_id", payment };
  }
  if (paymentReference && payment.paymentReference && payment.paymentReference !== paymentReference) {
    return { recorded: false, reason: "payment_reference_mismatch", payment };
  }

  const businessId = payment.paymentReference.includes("|") ? payment.paymentReference.split("|")[0].trim() : "";
  const lead = businessId
    ? await db.prepare("SELECT id, business_id, business_name FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string; business_id: string; business_name: string }>()
    : null;
  if (!lead?.id) {
    return { recorded: false, reason: "lead_not_matched", payment };
  }

  const now = new Date().toISOString();
  const pendingPayment = await db
    .prepare(
      `SELECT id, amount_usd, raw_json FROM lead_payments
       WHERE lead_id = ? AND payment_status = 'pending' AND payment_reference = ?
       ORDER BY datetime(created_at) DESC
       LIMIT 1`,
    )
    .bind(lead.id, payment.paymentReference)
    .first<{ id: string; amount_usd?: number; raw_json?: string }>();
  const existing = await db.prepare("SELECT id FROM lead_payments WHERE transaction_id = ? LIMIT 1").bind(payment.subscriptionId).first<{ id: string }>();
  if (existing?.id && existing.id !== pendingPayment?.id) {
    return { recorded: false, duplicate: true, paymentId: existing.id, payment };
  }

  const active = ["ACTIVE", "APPROVED"].includes(payment.status);
  const paymentStatus = active ? "paid" : "pending";
  const amountUsd = firstNumber(payment.amountUsd, pendingPayment?.amount_usd);
  const rawJson = mergedPaymentRawJson(pendingPayment?.raw_json, { source: "paypal_subscription_approved", paypalSubscription: subscription });
  if (pendingPayment?.id) {
    await db
      .prepare(
        `UPDATE lead_payments
         SET processor = 'paypal', payment_status = ?, amount_usd = ?, amount_idr = 0, transaction_id = ?, payer_email = ?,
             proof_notes = ?, raw_json = ?, verified_at = ?, verified_by = ?, updated_at = ?
         WHERE id = ?`,
      )
      .bind(paymentStatus, amountUsd, payment.subscriptionId, payment.payerEmail, `PayPal subscription ${payment.status || "approved"} for yearly billing.`, rawJson, active ? now : null, verifiedBy, now, pendingPayment.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO lead_payments (
          id, lead_id, business_id, processor, payment_status, amount_usd, amount_idr,
          transaction_id, payer_email, payment_reference, proof_notes, raw_json, verified_at, verified_by, updated_at
        ) VALUES (?, ?, ?, 'paypal', ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), lead.id, lead.business_id, paymentStatus, amountUsd, payment.subscriptionId, payment.payerEmail, payment.paymentReference, `PayPal subscription ${payment.status || "approved"} for yearly billing.`, rawJson, active ? now : null, verifiedBy, now)
      .run();
  }

  const existingSubscription = await db.prepare("SELECT id FROM subscriptions WHERE lead_id = ? ORDER BY datetime(created_at) DESC LIMIT 1").bind(lead.id).first<{ id: string }>();
  if (existingSubscription?.id) {
    await db
      .prepare(
        `UPDATE subscriptions
         SET package_type = ?, amount_paid = ?, payment_status = ?, payment_method = 'paypal_subscription', payment_reference = ?, subscription_start_date = COALESCE(subscription_start_date, ?), updated_at = ?
         WHERE id = ?`,
      )
      .bind("managed_launch_subscription", amountUsd, paymentStatus, payment.subscriptionId, now, now, existingSubscription.id)
      .run();
  } else {
    await db
      .prepare(
        `INSERT INTO subscriptions (id, lead_id, package_type, amount_paid, payment_status, payment_method, payment_reference, subscription_start_date, created_at, updated_at)
         VALUES (?, ?, 'managed_launch_subscription', ?, ?, 'paypal_subscription', ?, ?, ?, ?)`,
      )
      .bind(crypto.randomUUID(), lead.id, amountUsd, paymentStatus, payment.subscriptionId, now, now, now)
      .run();
  }

  if (active) {
    await db.prepare("UPDATE leads SET status = 'won_paid', email = COALESCE(NULLIF(?, ''), email), updated_at = ? WHERE id = ?").bind(payment.payerEmail, now, lead.id).run();
  }
  await deps.insertCrmActivitySafe(db, {
    id: crypto.randomUUID(),
    lead_id: lead.id,
    staff_id: verifiedBy,
    activity_type: active ? "payment_verified" : "checkout_pending",
    description: `PayPal subscription ${payment.status || "approved"}. Subscription: ${payment.subscriptionId}. Plan: ${payment.planId || "not recorded"}. Payer: ${payment.payerEmail || "not recorded"}. Reference: ${payment.paymentReference || "not recorded"}.`,
  });

  return { recorded: true, paymentId: pendingPayment?.id, payment };
}

async function recordPaypalSubscriptionSale(deps: PaymentsDeps, db: D1DatabaseLike, event: Record<string, unknown>, verifiedBy: string) {
  await deps.ensureRequiredColumns(db, deps.paymentLedgerRequiredColumns);
  const resource = objectValue(event.resource);
  const amount = objectValue(resource.amount);
  const transactionId = firstString(resource.id);
  const subscriptionId = firstString(resource.billing_agreement_id);
  const amountUsd = firstNumber(amount.total, amount.value);
  if (!transactionId || !subscriptionId || !amountUsd) {
    return { recorded: false, reason: "missing_subscription_sale_fields", subscriptionId, transactionId, amountUsd };
  }
  const existing = await db.prepare("SELECT id FROM lead_payments WHERE transaction_id = ? LIMIT 1").bind(transactionId).first<{ id: string }>();
  if (existing?.id) {
    return { recorded: false, duplicate: true, paymentId: existing.id, subscriptionId, transactionId };
  }
  const parentPayment = await db
    .prepare("SELECT lead_id, business_id, payer_email, created_at FROM lead_payments WHERE transaction_id = ? ORDER BY datetime(updated_at) DESC LIMIT 1")
    .bind(subscriptionId)
    .first<{ lead_id: string; business_id?: string; payer_email?: string; created_at?: string }>();
  if (!parentPayment?.lead_id) {
    return { recorded: false, reason: "subscription_parent_not_matched", subscriptionId, transactionId };
  }

  const now = new Date().toISOString();
  const saleTime = Date.parse(firstString(resource.create_time, event.create_time, now));
  const parentTime = Date.parse(firstString(parentPayment.created_at, now));
  const looksLikeInitialSale = Number.isFinite(saleTime) && Number.isFinite(parentTime) && Math.abs(saleTime - parentTime) < 7 * 24 * 60 * 60 * 1000;
  await db
    .prepare(
      `INSERT INTO lead_payments (
        id, lead_id, business_id, processor, payment_status, amount_usd, amount_idr,
        transaction_id, payer_email, payment_reference, proof_notes, raw_json, verified_at, verified_by, updated_at
      ) VALUES (?, ?, ?, 'paypal', 'paid', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      parentPayment.lead_id,
      parentPayment.business_id || "",
      amountUsd,
      transactionId,
      parentPayment.payer_email || "",
      subscriptionId,
      "Verified PayPal subscription billing payment.",
      JSON.stringify({ source: "paypal_subscription_sale", event }),
      now,
      verifiedBy,
      now,
    )
    .run();
  await db
    .prepare(`UPDATE subscriptions SET amount_paid = ${looksLikeInitialSale ? "amount_paid" : "COALESCE(amount_paid, 0) + ?"}, payment_status = 'paid', updated_at = ? WHERE lead_id = ? AND payment_reference = ?`)
    .bind(...(looksLikeInitialSale ? [now, parentPayment.lead_id, subscriptionId] : [amountUsd, now, parentPayment.lead_id, subscriptionId]))
    .run();
  await deps.insertCrmActivitySafe(db, {
    id: crypto.randomUUID(),
    lead_id: parentPayment.lead_id,
    staff_id: verifiedBy,
    activity_type: "payment_verified",
    description: `PayPal subscription billing payment verified. Amount: $${amountUsd}. Sale: ${transactionId}. Subscription: ${subscriptionId}.`,
  });
  return { recorded: true, subscriptionId, transactionId, amountUsd, initialSaleAlreadyCounted: looksLikeInitialSale };
}

async function handlePaypalSubscriptionApproved(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown) {
  const body = await deps.readJsonBody(request);
  const subscriptionId = deps.asString(body.subscriptionId).trim();
  const paymentReference = deps.asString(body.paymentReference).trim();
  if (!/^I-[A-Z0-9]+$/.test(subscriptionId)) {
    return deps.errorJson("Invalid PayPal subscription ID.", 400);
  }

  const credentials = await getPaypalApiCredentials(deps, db, env);
  if (!credentials.clientId || !credentials.clientSecret) {
    return deps.errorJson(`PayPal ${credentials.mode} API credentials are not configured.`, 400, credentials.isProduction ? ["PAYPAL_LIVE_CLIENT_ID", "PAYPAL_LIVE_CLIENT_SECRET"] : ["PAYPAL_SANDBOX_CLIENT_ID", "PAYPAL_SANDBOX_CLIENT_SECRET"]);
  }

  const baseUrl = paypalApiBase(credentials.isProduction);
  const accessToken = await paypalAccessToken(baseUrl, credentials.clientId, credentials.clientSecret);
  const response = await fetch(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}`, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    return deps.errorJson(firstString(data.message, `PayPal subscription lookup failed with HTTP ${response.status}`), 502, data);
  }

  const result = await recordPaypalApprovedSubscription(deps, db, data, paymentReference, "paypal_subscription");
  if (!result.recorded && result.reason) {
    return deps.errorJson(`PayPal subscription approved, but CRM recording failed: ${result.reason}`, 409, result);
  }
  return deps.json({ success: true, processor: "paypal", subscription: data, ...result });
}

export async function handlePayments(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown, segments: string[]): Promise<Response> {
  if (request.method === "POST" && segments[1] === "paypal-webhook") {
    return handlePaypalWebhook(deps, request, db, env);
  }

  if (request.method === "POST" && segments[1] === "paypal-capture-order") {
    return handlePaypalCaptureOrder(deps, request, db, env);
  }

  if (request.method === "POST" && segments[1] === "paypal-subscription-approved") {
    return handlePaypalSubscriptionApproved(deps, request, db, env);
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
    paymentDomainFeeUsdSetting,
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
    deps.getSetting(db, env, "PAYMENT_DOMAIN_FEE_USD"),
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
  const domainFeeUsd = Math.max(0, Number(paymentDomainFeeUsdSetting || 17) || 17);
  const addOnPageUsd = Math.max(0, Number(paymentAddOnPageUsdSetting || 10) || 10);
  const pricing = checkoutPricing(basePaymentAmountUsd, domainFeeUsd, addOnPageUsd, domainMode, body.addOns, body.billingPlan);
  const setupRequest = checkoutSetupRequest(pricing, body.setupRequest);
  const domainQuote = checkoutDomainQuote(domainMode, requestedDomain, body.domainQuote);
  const paymentAmountUsd = pricing.totalUsd;
  const usdToIdrRate = Math.max(1, Number(usdToIdrRateSetting || 16000) || 16000);
  const amountIdr = Math.max(1000, Math.round(paymentAmountUsd * usdToIdrRate));
  const amountCents = Math.round(paymentAmountUsd * 100);
  const packageName = packageNameSetting || "WebView.click Done-for-you Website Setup";
  const packageDescription = packageDescriptionSetting || `$${money(pricing.hostingAnnualUsd)}/year hosting${domainMode === "new" ? ` + $${money(pricing.domainAnnualUsd)}/year domain fee` : ""}: done-for-you website setup.`;
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
    `WebView.click checkout request\nBusiness: ${businessName}\nDomain: ${requestedDomain || "-"}\nDomain mode: ${domainMode === "owned" ? "customer-owned domain (no domain fee)" : "new domain registration"}\nProcessor: ${paymentProcessor}\nPackage: $${paymentAmountUsd} due today for ${pricing.termYears}-year ${pricing.billingCadence === "annual_recurring" ? "PayPal yearly billing" : "prepaid"} setup\nOrder note: ${setupRequest.setupNote}`,
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
          JSON.stringify({ source: "checkout_request", businessId, businessName, requestedDomain, domainMode, domainQuote, paymentProcessor, paymentReference, pricing, billingPlan: { termYears: pricing.termYears, billingCadence: pricing.billingCadence, termDiscountRate: pricing.termDiscountRate, hostingAnnualUsd: pricing.hostingAnnualUsd, hostingAfterDiscountUsd: pricing.hostingAfterDiscountUsd, domainAnnualUsd: pricing.domainAnnualUsd, annualDiscountedUsd: pricing.annualDiscountedUsd, packageTermTotalUsd: pricing.packageTermTotalUsd, packageDueTodayUsd: pricing.packageDueTodayUsd }, setupRequest, setupNote: setupRequest.setupNote }),
          new Date().toISOString(),
        )
        .run();
    }
    await deps.insertCrmActivitySafe(db, {
      id: crypto.randomUUID(),
      lead_id: row.id,
      staff_id: "system",
      activity_type: "checkout_pending",
      description: `Payment processor: ${paymentProcessor}. Domain request: ${requestedDomain || "not provided"} (${domainMode}). Amount: $${paymentAmountUsd} / approx IDR ${amountIdr}. Payment reference: ${paymentReference}. Order note: ${setupRequest.setupNote}. Admin WA: ${adminNotifyUrl}`,
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
    billingPlan: { termYears: pricing.termYears, billingCadence: pricing.billingCadence, termDiscountRate: pricing.termDiscountRate, hostingAnnualUsd: pricing.hostingAnnualUsd, hostingAfterDiscountUsd: pricing.hostingAfterDiscountUsd, domainAnnualUsd: pricing.domainAnnualUsd },
    setupRequest,
    domainQuote,
    setupNote: setupRequest.setupNote,
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
        metadata: { businessId, businessName, requestedDomain, domainMode, amountUsd: paymentAmountUsd, billingPlan: { termYears: pricing.termYears, billingCadence: pricing.billingCadence, termDiscountRate: pricing.termDiscountRate }, setupRequest },
      }),
    });
    const data = await response.json().catch(() => ({})) as { invoice_url?: string; error_code?: string; message?: string };
    if (!response.ok || !data.invoice_url) {
      return deps.json({ success: false, mock: true, processor: paymentProcessor, checkoutUrl: "", adminNotifyUrl, error: data.message || data.error_code || `Xendit returned HTTP ${response.status}`, message: "Xendit checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending." }, 502);
    }
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: data.invoice_url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, setupRequest, setupNote: setupRequest.setupNote });
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
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: data.redirect_url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, setupRequest, setupNote: setupRequest.setupNote });
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
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, setupRequest, setupNote: setupRequest.setupNote });
  }

  if (paymentProcessor === "paypal") {
    if (activePaypalClientId && activePaypalClientSecret) {
      try {
        const baseUrl = paypalApiBase(paypalIsProduction);
        const accessToken = await paypalAccessToken(baseUrl, activePaypalClientId, activePaypalClientSecret);
        if (pricing.billingCadence === "annual_recurring") {
          const paypalSubscription = await getOrCreatePaypalSubscriptionPlan({
            db,
            baseUrl,
            accessToken,
            requestId: orderId,
            packageName,
            businessName,
            requestedDomain,
            domainMode,
            paypalMode: activePaypalMode,
            pricing,
          });
          if (row?.id) {
            const pending = await db.prepare("SELECT id, raw_json FROM lead_payments WHERE lead_id = ? AND payment_reference = ? AND payment_status = 'pending' LIMIT 1").bind(row.id, paymentReference).first<{ id: string; raw_json?: string }>();
            if (pending?.id) {
              await db
                .prepare("UPDATE lead_payments SET raw_json = ?, updated_at = ? WHERE id = ?")
                .bind(mergedPaymentRawJson(pending.raw_json, { paypalSubscriptionProductId: paypalSubscription.product.id, paypalSubscriptionPlanId: paypalSubscription.plan.id, paypalSubscriptionPlanStatus: paypalSubscription.plan.status, paypalSubscriptionPlanCacheKey: paypalSubscription.cacheKey, paypalSubscriptionPlanCached: paypalSubscription.plan.cached === true }), new Date().toISOString(), pending.id)
                .run();
            }
          }
          return deps.json({
            success: true,
            mock: false,
            processor: paymentProcessor,
            checkoutUrl: "",
            adminNotifyUrl,
            amountUsd: paymentAmountUsd,
            amountIdr,
            pricing,
            setupRequest,
            setupNote: setupRequest.setupNote,
            paymentReference,
            paymentInstructions: "Review the package and approve PayPal yearly billing. PayPal will auto-bill the yearly amount for the selected term.",
            riskWarning: paypalRiskAcknowledged ? paypalRiskWarning : `${paypalRiskWarning} Admin has not acknowledged the PayPal risk checklist in Settings yet.`,
            requiresManualReview: false,
            manualConfirmationRequired: false,
            paypalInline: true,
            paypalClientId: activePaypalClientId,
            paypalMode: activePaypalMode,
            paypalSubscriptionPlanId: paypalSubscription.plan.id,
            paypalSubscriptionPlanStatus: paypalSubscription.plan.status,
            paypalSubscriptionProductId: paypalSubscription.product.id,
            paypalSubscriptionPlanCached: paypalSubscription.plan.cached === true,
          });
        }
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
          setupRequest,
          setupNote: setupRequest.setupNote,
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
          setupRequest,
          setupNote: setupRequest.setupNote,
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
      setupRequest,
      setupNote: setupRequest.setupNote,
      paymentReference,
      paymentInstructions: `${paypalPaymentNote} Reference: ${paymentReference}`,
      riskWarning: paypalRiskAcknowledged ? paypalRiskWarning : `${paypalRiskWarning} Admin has not acknowledged the PayPal risk checklist in Settings yet.`,
      requiresManualReview: true,
      manualConfirmationRequired: true,
    });
  }

  if (paymentProcessor === "wise") {
    if (!wisePaymentUrl) return mockResponse("Wise payment/request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["WISE_PAYMENT_URL"]);
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: wisePaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, setupRequest, setupNote: setupRequest.setupNote, paymentReference, paymentInstructions: `Include this WebView.click payment reference in the payment memo: ${paymentReference}`, requiresManualReview: true, manualConfirmationRequired: true });
  }

  if (paymentProcessor === "payoneer") {
    if (!payoneerPaymentUrl) return mockResponse("Payoneer payment request link belum dikonfigurasi. Checkout disimpan sebagai mock checkout_pending.", ["PAYONEER_PAYMENT_URL"]);
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: payoneerPaymentUrl, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, setupRequest, setupNote: setupRequest.setupNote, paymentReference, paymentInstructions: `Include this WebView.click payment reference in the payment memo: ${paymentReference}`, requiresManualReview: true, manualConfirmationRequired: true });
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
            checkout_data: { email: customerEmail || undefined, custom: { business_id: businessId, business_name: businessName, requested_domain: requestedDomain, domain_mode: domainMode, admin_whatsapp: adminWhatsApp, setup_note: setupRequest.setupNote } },
          },
          relationships: { store: { data: { type: "stores", id: lemonStoreId } }, variant: { data: { type: "variants", id: lemonVariantId } } },
        },
      }),
    });
    const checkoutData = await checkoutResponse.json() as { data?: { attributes?: { url?: string } }; errors?: unknown };
    if (!checkoutResponse.ok || !checkoutData.data?.attributes?.url) {
      return deps.json({ success: false, mock: true, processor: paymentProcessor, checkoutUrl: "", adminNotifyUrl, error: checkoutData.errors || `Lemon Squeezy returned HTTP ${checkoutResponse.status}`, message: "Legacy Lemon checkout belum berhasil dibuat. Request tetap dicatat sebagai checkout_pending." }, 502);
    }
    return deps.json({ success: true, mock: false, processor: paymentProcessor, checkoutUrl: checkoutData.data.attributes.url, adminNotifyUrl, amountUsd: paymentAmountUsd, amountIdr, pricing, setupRequest, setupNote: setupRequest.setupNote });
  }

  return mockResponse("Payment processor belum dipilih atau masih mock. Checkout disimpan sebagai checkout_pending.");
}
