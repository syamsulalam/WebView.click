export type D1Result<T = unknown> = {
  results?: T[];
  success?: boolean;
  meta?: unknown;
  error?: string;
};

export type D1PreparedStatement<T = unknown> = {
  bind: (...values: unknown[]) => D1PreparedStatement<T>;
  all: <R = T>() => Promise<D1Result<R>>;
  first: <R = T>() => Promise<R | null>;
  run: () => Promise<D1Result<T>>;
};

export type D1Database = {
  prepare: <T = unknown>(query: string) => D1PreparedStatement<T>;
  batch: <T = unknown>(statements: D1PreparedStatement<T>[]) => Promise<D1Result<T>[]>;
  exec: (query: string) => Promise<D1Result>;
};

export type R2Bucket = {
  put: (key: string, value: ReadableStream | ArrayBuffer | ArrayBufferView | string, options?: { httpMetadata?: { contentType?: string } }) => Promise<unknown>;
  get?: (key: string) => Promise<{ text: () => Promise<string> } | null>;
};

export type Env = {
  DB?: D1Database;
  R2?: R2Bucket;
  R2_PUBLIC_BASE_URL?: string;
  GOOGLE_PLACES_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  KIE_API_KEY?: string;
  OPENCODE_API_KEY?: string;
  OPENCODE_BASE_URL?: string;
  LEMON_SQUEEZY_API_KEY?: string;
  LEMON_SQUEEZY_STORE_ID?: string;
  LEMON_SQUEEZY_VARIANT_ID?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_SANDBOX_CLIENT_ID?: string;
  PAYPAL_SANDBOX_CLIENT_SECRET?: string;
  PAYPAL_SANDBOX_WEBHOOK_ID?: string;
  PAYPAL_LIVE_CLIENT_ID?: string;
  PAYPAL_LIVE_CLIENT_SECRET?: string;
  PAYPAL_LIVE_WEBHOOK_ID?: string;
  PAYPAL_WEBHOOK_ID?: string;
  PAYPAL_IS_PRODUCTION?: string;
  ADMIN_WHATSAPP_NUMBER?: string;
};

export type PagesContext = {
  request: Request;
  env: Env & Record<string, unknown>;
};

export type LeadRow = {
  id: string;
  business_id: string;
  business_name: string;
  status: string;
  view_count?: number;
};

export type SettingRow = {
  key: string;
  value: string;
};
