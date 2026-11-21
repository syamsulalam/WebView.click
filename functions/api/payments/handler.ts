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
  batch: (statements: D1PreparedStatement[]) => Promise<D1Result[]>;
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
  quoteNewDomain?: (db: D1DatabaseLike, env: unknown, domain: string, fee: number) => Promise<{ supportedForMvp: boolean }>;
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

type PaypalLedgerRow = {
  id: string;
  lead_id: string;
  business_id: string;
  amount_usd: number;
  payment_reference: string;
  payment_status: string;
  transaction_id?: string;
  payer_email?: string;
  raw_json?: string;
};

function ledgerMetadata(row: PaypalLedgerRow) {
  try {
    return objectValue(JSON.parse(row.raw_json || "{}"));
  } catch {
    return {};
  }
}

async function paypalLedgerOrder(db: D1DatabaseLike, reference: string, mode: string) {
  if (!reference || reference.length > 127) return null;
  const row = await db.prepare(
    "SELECT * FROM lead_payments WHERE processor = 'paypal' AND payment_reference = ? LIMIT 1",
  ).bind(reference).first<PaypalLedgerRow>();
  return row && ledgerMetadata(row).paypalMode === mode ? row : null;
}

function cents(value: unknown) {
  return Math.round(firstNumber(value) * 100);
}

async function settlePaypalOrder(db: D1DatabaseLike, order: PaypalLedgerRow, transactionId: string, amount: Record<string, unknown>, actor: string) {
  if (!transactionId || amount.currency_code !== "USD" || cents(amount.value) !== cents(order.amount_usd) || cents(amount.value) <= 0) return false;
  if (order.payment_status === "paid") return order.transaction_id === transactionId;
  if (order.payment_status !== "pending") return false;

  const now = new Date().toISOString();
  const proof = "Verified PayPal order settlement.";
  // Every downstream write depends on the same committed ledger row in this D1 transaction.
  const paid = "SELECT 1 FROM lead_payments WHERE id = ? AND transaction_id = ? AND payment_status = 'paid'";
  await db.batch([
    db.prepare(`UPDATE lead_payments SET payment_status = 'paid', transaction_id = ?, proof_notes = ?,
      verified_at = ?, verified_by = ?, updated_at = ? WHERE id = ? AND payment_status = 'pending'`)
      .bind(transactionId, proof, now, actor, now, order.id),
    db.prepare(`INSERT OR IGNORE INTO subscriptions
      (id, lead_id, package_type, amount_paid, payment_status, payment_method, payment_reference, subscription_start_date)
      SELECT ?, ?, 'managed_launch_support', ?, 'paid', 'paypal', ?, ? WHERE EXISTS (${paid})`)
      .bind("paypal-order-" + order.id, order.lead_id, order.amount_usd, transactionId, now, order.id, transactionId),
    db.prepare(`UPDATE leads SET status = 'won_paid', updated_at = ? WHERE id = ? AND EXISTS (${paid})`)
      .bind(now, order.lead_id, order.id, transactionId),
    db.prepare(`INSERT OR IGNORE INTO crm_activities (id, lead_id, staff_id, activity_type, description)
      SELECT ?, ?, ?, 'payment_verified', ? WHERE EXISTS (${paid})`)
      .bind("paypal-order-" + order.id, order.lead_id, actor, proof, order.id, transactionId),
  ]);
  const saved = await db.prepare("SELECT transaction_id, payment_status FROM lead_payments WHERE id = ?")
    .bind(order.id).first<PaypalLedgerRow>();
  return saved?.payment_status === "paid" && saved.transaction_id === transactionId;
}

async function handlePaypalWebhook(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown) {
  if (!["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id", "paypal-transmission-sig", "paypal-transmission-time"]
    .every((header) => request.headers.get(header))) return deps.errorJson("PayPal signature headers are required.", 400);
  const event = await deps.readJsonBody(request);
  const credentials = await getPaypalApiCredentials(deps, db, env);
  if (!credentials.clientId || !credentials.clientSecret || !credentials.webhookId) {
    return deps.errorJson("PayPal webhook verification is unavailable.", 503);
  }

  const base = paypalApiBase(credentials.isProduction);
  const token = await paypalAccessToken(base, credentials.clientId, credentials.clientSecret);
  if (!await verifyPaypalWebhookSignature(base, token, credentials.webhookId, request, event)) {
    return deps.errorJson("PayPal webhook signature verification failed.", 400);
  }

  const eventType = deps.asString(event.event_type);
  const resource = objectValue(event.resource);
  let settled = true;
  if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
    settled = await bindPaypalSubscription(db, resource, credentials.mode);
  } else if (eventType === "PAYMENT.SALE.COMPLETED" && firstString(resource.billing_agreement_id)) {
    settled = await recordPaypalSubscriptionSale(db, resource, credentials.mode);
  } else if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
    const providerOrderId = firstString(objectValue(objectValue(resource.supplementary_data).related_ids).order_id);
    const order = await paypalBoundOrder(db, credentials.mode, "paypalOrderId", providerOrderId);
    settled = Boolean(order && (!resource.invoice_id || resource.invoice_id === order.payment_reference) &&
      resource.status === "COMPLETED" &&
      await settlePaypalOrder(db, order, firstString(resource.id), objectValue(resource.amount), "paypal_webhook"));
  }
  if (!settled) return deps.errorJson("PayPal event requires reconciliation. Retry later.", 503);
  return deps.json({ success: true, verified: true, eventType });
}

async function handlePaypalCaptureOrder(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown) {
  const body = await deps.readJsonBody(request);
  const orderId = deps.asString(body.orderId || body.orderID).trim();
  const paymentReference = deps.asString(body.paymentReference).trim();
  if (!/^[A-Z0-9]{1,36}$/.test(orderId)) return deps.errorJson("Invalid PayPal order ID.", 400);

  const credentials = await getPaypalApiCredentials(deps, db, env);
  const order = await paypalLedgerOrder(db, paymentReference, credentials.mode);
  if (!order || ledgerMetadata(order).paypalOrderId !== orderId) {
    return deps.errorJson("No matching checkout order.", 404);
  }
  if (order.payment_status === "paid") return deps.json({ success: true, status: "paid", paymentReference });
  if (order.payment_status !== "pending") return deps.errorJson("Checkout order is unavailable.", 409);
  if (!credentials.clientId || !credentials.clientSecret) return deps.errorJson("PayPal capture is unavailable.", 503);

  const base = paypalApiBase(credentials.isProduction);
  const token = await paypalAccessToken(base, credentials.clientId, credentials.clientSecret);
  const url = `${base}/v2/checkout/orders/${orderId}`;
  const response = await fetch(url + "/capture", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", "paypal-request-id": `${orderId}-capture`, prefer: "return=representation" },
    body: "{}",
  });
  // PayPal can report an already-captured order after a timeout or an interrupted local save.
  const details = response.ok ? response : await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!details.ok) return deps.errorJson("PayPal has not confirmed the payment.", 502);
  const result = objectValue(await details.json());
  const units = Array.isArray(result.purchase_units) ? result.purchase_units : [];
  const unit = objectValue(units[0]);
  const payments = objectValue(unit.payments);
  const captures = Array.isArray(payments.captures) ? payments.captures : [];
  const capture = objectValue(captures[0]);
  if (result.id !== orderId || units.length !== 1 || unit.invoice_id !== paymentReference ||
      captures.length !== 1 || capture.status !== "COMPLETED" ||
      !await settlePaypalOrder(db, order, firstString(capture.id), objectValue(capture.amount), "paypal_checkout")) {
    return deps.errorJson("PayPal payment could not be reconciled. Contact WebView with the checkout reference.", 409);
  }
  return deps.json({ success: true, status: "paid", paymentReference });
}

async function paypalBoundOrder(db: D1DatabaseLike, mode: string, field: "paypalOrderId" | "paypalSubscriptionId", value: string) {
  if (!value || value.length > 64) return null;
  return db.prepare(`SELECT * FROM lead_payments WHERE processor = 'paypal'
    AND json_extract(CASE WHEN json_valid(raw_json) THEN raw_json ELSE '{}' END, '$.paypalMode') = ?
    AND json_extract(CASE WHEN json_valid(raw_json) THEN raw_json ELSE '{}' END, ?) = ? LIMIT 1`)
    .bind(mode, "$." + field, value).first<PaypalLedgerRow>();
}

async function bindPaypalSubscription(db: D1DatabaseLike, subscription: Record<string, unknown>, mode: string) {
  const id = firstString(subscription.id);
  const reference = firstString(subscription.custom_id);
  const row = await paypalLedgerOrder(db, reference, mode);
  if (!row || !/^I-[A-Z0-9]{1,36}$/.test(id) || !["APPROVED", "ACTIVE"].includes(firstString(subscription.status))) return false;
  const metadata = ledgerMetadata(row);
  if (!metadata.paypalSubscriptionPlanId || metadata.paypalSubscriptionPlanId !== subscription.plan_id) return false;
  if (metadata.paypalSubscriptionId) return metadata.paypalSubscriptionId === id;
  if (row.payment_status !== "pending") return false;
  await db.prepare(`UPDATE lead_payments SET raw_json = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND payment_status = 'pending' AND raw_json = ?`)
    .bind(JSON.stringify({ ...metadata, paypalSubscriptionId: id }), row.id, row.raw_json).run();
  const saved = await paypalLedgerOrder(db, reference, mode);
  return Boolean(saved && ledgerMetadata(saved).paypalSubscriptionId === id);
}

async function recordPaypalSubscriptionSale(db: D1DatabaseLike, resource: Record<string, unknown>, mode: string) {
  const id = firstString(resource.id);
  const subscriptionId = firstString(resource.billing_agreement_id);
  const amount = objectValue(resource.amount);
  const value = cents(amount.total ?? amount.value);
  if (!/^[A-Za-z0-9-]{1,64}$/.test(id) || firstString(amount.currency, amount.currency_code) !== "USD" ||
      value <= 0 || firstString(resource.state, resource.status).toLowerCase() !== "completed") return false;
  const parent = await paypalBoundOrder(db, mode, "paypalSubscriptionId", subscriptionId);
  if (!parent || !["pending", "settled"].includes(parent.payment_status)) return false;
  const pricing = objectValue(ledgerMetadata(parent).pricing);
  const entryId = `paypal-sale-${mode}-${id}`;
  const prior = await db.prepare("SELECT payment_reference, amount_usd FROM lead_payments WHERE id = ?")
    .bind(entryId).first<PaypalLedgerRow>();
  if (prior) return prior.payment_reference === parent.id && cents(prior.amount_usd) === value;

  const amounts = parent.payment_status === "pending"
    ? [cents(parent.amount_usd), cents(pricing.addOnUsd), cents(pricing.annualDiscountedUsd)]
    : [cents(pricing.annualDiscountedUsd)];
  if (!amounts.includes(value)) return false;

  const now = new Date().toISOString();
  const settledCents = `SELECT ROUND(COALESCE(SUM(amount_usd), 0) * 100) FROM lead_payments
    WHERE processor = 'paypal' AND payment_status = 'paid' AND payment_reference = ?`;
  const completed = "SELECT 1 FROM lead_payments WHERE id = ? AND payment_status = 'settled'";
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO lead_payments
      (id, lead_id, business_id, processor, payment_status, amount_usd, amount_idr, transaction_id,
       payment_reference, payer_email, proof_notes, verified_at, verified_by)
      VALUES (?, ?, ?, 'paypal', 'paid', ?, 0, ?, ?, ?, 'Verified PayPal subscription sale.', ?, 'paypal_webhook')`)
      .bind(entryId, parent.lead_id, parent.business_id, value / 100, id, parent.id, parent.payer_email || "", now),
    db.prepare(`UPDATE lead_payments SET payment_status = 'settled', updated_at = ?
      WHERE id = ? AND payment_status = 'pending' AND (${settledCents}) >= ?`)
      .bind(now, parent.id, parent.id, cents(parent.amount_usd)),
    db.prepare(`INSERT INTO subscriptions (id, lead_id, package_type, amount_paid, payment_status, payment_method,
      payment_reference, subscription_start_date, updated_at)
      SELECT ?, ?, 'managed_launch_subscription', (${settledCents}) / 100.0, 'paid', 'paypal_subscription', ?, ?, ?
      WHERE EXISTS (${completed})
      ON CONFLICT(id) DO UPDATE SET amount_paid = excluded.amount_paid, updated_at = excluded.updated_at`)
      .bind("paypal-subscription-" + parent.id, parent.lead_id, parent.id, subscriptionId, now, now, parent.id),
    db.prepare(`UPDATE leads SET status = 'won_paid', updated_at = ? WHERE id = ? AND EXISTS (${completed})`)
      .bind(now, parent.lead_id, parent.id),
    db.prepare(`INSERT OR IGNORE INTO crm_activities (id, lead_id, staff_id, activity_type, description)
      VALUES (?, ?, 'paypal_webhook', 'payment_verified', 'Verified PayPal subscription sale.')`).bind(entryId, parent.lead_id),
  ]);
  return true;
}

async function handlePaypalSubscriptionApproved(deps: PaymentsDeps, request: Request, db: D1DatabaseLike, env: unknown) {
  const body = await deps.readJsonBody(request);
  const id = deps.asString(body.subscriptionId).trim();
  const reference = deps.asString(body.paymentReference).trim();
  if (!/^I-[A-Z0-9]{1,36}$/.test(id)) return deps.errorJson("Invalid PayPal subscription ID.", 400);

  const credentials = await getPaypalApiCredentials(deps, db, env);
  const order = await paypalLedgerOrder(db, reference, credentials.mode);
  if (!order || !ledgerMetadata(order).paypalSubscriptionPlanId) return deps.errorJson("No matching checkout order.", 404);
  if (!credentials.clientId || !credentials.clientSecret) return deps.errorJson("PayPal subscriptions are unavailable.", 503);

  const base = paypalApiBase(credentials.isProduction);
  const token = await paypalAccessToken(base, credentials.clientId, credentials.clientSecret);
  const response = await fetch(`${base}/v1/billing/subscriptions/${id}`, { headers: { authorization: `Bearer ${token}` } });
  const subscription = response.ok ? objectValue(await response.json()) : {};
  if (subscription.id !== id || subscription.custom_id !== reference ||
      !await bindPaypalSubscription(db, subscription, credentials.mode)) {
    return deps.errorJson("PayPal subscription could not be reconciled. Contact WebView with the checkout reference.", 409);
  }
  return deps.json({ success: true, status: "awaiting_settlement", paymentReference: reference });
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
  const requestedDomain = deps.asString(body.domain).trim().toLowerCase();
  const domainMode = deps.asString(body.domainMode, "new") === "owned" ? "owned" : "new";
  const customerEmail = deps.asString(body.email);
  if (requestedDomain.length > 253 ||
      !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z](?:[a-z0-9-]{0,61}[a-z0-9])$/i.test(requestedDomain)) {
    return deps.errorJson("Enter a valid domain name.", 400);
  }
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
  const addOnPageUsd = Math.max(50, Number(paymentAddOnPageUsdSetting || 50) || 50);
  const pricing = checkoutPricing(basePaymentAmountUsd, domainFeeUsd, addOnPageUsd, domainMode, body.addOns, body.billingPlan);
  if (pricing.billingCadence === "annual_recurring" && paymentProcessor !== "paypal") {
    return deps.errorJson("Annual billing is unavailable for this payment method. Select prepaid billing.", 409);
  }
  const setupRequest = checkoutSetupRequest(pricing, body.setupRequest);
  let domainQuote = null;
  if (domainMode === "new") {
    const quote = await deps.quoteNewDomain?.(db, env, requestedDomain, domainFeeUsd).catch(() => null);
    if (!quote?.supportedForMvp) {
      return deps.errorJson("We could not confirm this domain at the listed price. Choose another domain or contact WebView for a quote.", 409);
    }
    domainQuote = checkoutDomainQuote(domainMode, requestedDomain, quote);
  }
  const paymentAmountUsd = pricing.totalUsd;
  const usdToIdrRate = Math.max(1, Number(usdToIdrRateSetting || 16000) || 16000);
  const amountIdr = Math.max(1000, Math.round(paymentAmountUsd * usdToIdrRate));
  const amountCents = Math.round(paymentAmountUsd * 100);
  const packageName = packageNameSetting || "WebView.click Done-for-you Website Setup";
  const packageDescription = packageDescriptionSetting || `$${money(pricing.hostingAnnualUsd)}/year hosting${domainMode === "new" ? ` + $${money(pricing.domainAnnualUsd)}/year domain fee` : ""}: done-for-you website setup.`;
  const adminWhatsApp = adminWhatsAppSetting || "081233838173";
  const orderId = crypto.randomUUID().replaceAll("-", "");
  const paymentReference = `${businessId.slice(0, 80)} | ${orderId}`;
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

  let row = body.staticPackage === true ? null : await db.prepare(
    "SELECT id FROM leads WHERE business_id = ? AND EXISTS (SELECT 1 FROM json_sites WHERE business_id = leads.business_id)",
  ).bind(businessId).first<{ id: string }>();
  if (body.staticPackage === true && businessId.length <= 63 && businessId === body.businessId) {
    const published = await fetch(`https://sites.webview.click/${businessId}/`, {
      method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(8000),
    }).catch(() => null);
    if (published?.ok && published.headers.has("X-WebView-Release")) {
      await db.prepare(
        "INSERT INTO leads (id, business_id, business_name, status) VALUES (?, ?, ?, 'checkout_pending') ON CONFLICT(business_id) DO NOTHING",
      ).bind(crypto.randomUUID(), businessId, businessName.trim().slice(0, 160)).run();
      row = await db.prepare("SELECT id FROM leads WHERE business_id = ?").bind(businessId).first<{ id: string }>();
    }
  }
  const crmOwnerSession = Boolean(row?.id);
  const pendingPaymentId = crypto.randomUUID();
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
          pendingPaymentId,
          row.id,
          businessId,
          paymentProcessor,
          paymentAmountUsd,
          amountIdr,
          customerEmail,
          paymentReference,
          "Checkout requested; waiting for manual payment verification.",
          JSON.stringify({ source: "checkout_request", crmOwnerSession, businessId, businessName, requestedDomain, domainMode, domainQuote, paymentProcessor, paymentReference, paypalMode: activePaypalMode, pricing, billingPlan: { termYears: pricing.termYears, billingCadence: pricing.billingCadence, annualDiscountedUsd: pricing.annualDiscountedUsd }, setupRequest, setupNote: setupRequest.setupNote }),
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
    crmTracked: crmOwnerSession,
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
  if (!row?.id) return mockResponse("Checkout requires a published WebView package.");
  async function bindPaypalCheckout(fields: Record<string, unknown>) {
    const update = await db.prepare(`UPDATE lead_payments SET raw_json = json_patch(raw_json, ?), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND payment_status = 'pending'`).bind(JSON.stringify(fields), pendingPaymentId).run();
    const current = await paypalLedgerOrder(db, paymentReference, activePaypalMode);
    if (update.success === false || !current || Object.entries(fields).some(([key, value]) => ledgerMetadata(current)[key] !== value)) {
      throw new Error("Could not bind PayPal checkout to its CRM order.");
    }
  }

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
          const planCached = "cached" in paypalSubscription.plan && paypalSubscription.plan.cached === true;
          if (!paypalSubscription.plan.id) throw new Error("PayPal plan is unavailable.");
          await bindPaypalCheckout({ paypalSubscriptionPlanId: paypalSubscription.plan.id });
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
            paypalSubscriptionPlanCached: planCached,
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
        if (!paypalOrder.id) throw new Error("PayPal order is unavailable.");
        await bindPaypalCheckout({ paypalOrderId: paypalOrder.id });
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
          error: "PayPal checkout could not be prepared.",
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
