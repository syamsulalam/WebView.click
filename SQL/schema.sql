-- Cloudflare D1 schema for WebView.click.
-- Run with:
-- npx wrangler d1 execute webview-db --file=./SQL/schema.sql --remote

CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    business_id TEXT UNIQUE NOT NULL,
    business_name TEXT NOT NULL,
    niche TEXT,
    email TEXT,
    phone TEXT,
    gmb_url TEXT,
    website_url TEXT,
    rating REAL,
    reviews INTEGER,
    address TEXT,
    status TEXT DEFAULT 'scraped',
    view_count INTEGER DEFAULT 0,
    last_viewed_at DATETIME,
    last_contacted DATETIME,
    staff_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    package_type TEXT NOT NULL,
    amount_paid REAL DEFAULT 0.00,
    payment_status TEXT DEFAULT 'unpaid',
    payment_method TEXT,
    payment_reference TEXT,
    subscription_start_date DATETIME,
    subscription_end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS crm_activities (
    id TEXT PRIMARY KEY,
    lead_id TEXT NOT NULL,
    staff_id TEXT,
    activity_type TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS json_sites (
    id TEXT PRIMARY KEY,
    business_id TEXT UNIQUE NOT NULL,
    json_content TEXT NOT NULL,
    r2_json_key TEXT,
    r2_json_url TEXT,
    json_summary TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS places_search_cache (
    query_key TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    results_json TEXT NOT NULL,
    provider_status TEXT,
    result_count INTEGER DEFAULT 0,
    hit_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);

CREATE TABLE IF NOT EXISTS places_prospects (
    place_id TEXT PRIMARY KEY,
    query_key TEXT,
    query TEXT,
    business_name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    website_url TEXT,
    maps_url TEXT,
    rating REAL,
    reviews INTEGER,
    niche TEXT,
    status TEXT DEFAULT 'new',
    result_json TEXT NOT NULL,
    details_json TEXT,
    selected_photo_json TEXT,
    selected_palette_json TEXT,
    palette_options_json TEXT,
    website_check_status TEXT,
    website_checked_at DATETIME,
    generated_business_id TEXT,
    last_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    generated_at DATETIME,
    details_loaded_at DATETIME
);

CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    business_id TEXT,
    place_id TEXT,
    provider TEXT,
    model TEXT,
    status TEXT NOT NULL,
    error TEXT,
    metadata_json TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
