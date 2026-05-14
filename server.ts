import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import Database from "better-sqlite3";

// Initialize SQLite DB matching PRD
const db = new Database("webviewcrm.sqlite", { verbose: console.log });
db.pragma("journal_mode = WAL");

// Setup Tables
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      business_id TEXT UNIQUE NOT NULL,
      business_name TEXT NOT NULL,
      niche TEXT,
      email TEXT,
      phone TEXT,
      gmb_url TEXT,
      website_url TEXT,
      status TEXT DEFAULT 'scraped',
      view_count INTEGER DEFAULT 0,
      last_viewed_at DATETIME,
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
      staff_id TEXT NOT NULL,
      activity_type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS json_sites (
      business_id TEXT PRIMARY KEY,
      json_content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // --- API ROUTES ---

  // 1. Dashboard Stats
  app.get("/api/stats", (req, res) => {
    const leadsCount = db.prepare("SELECT COUNT(*) as count FROM leads").get() as { count: number };
    const paidCount = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status='won_paid'").get() as { count: number };
    
    // Revenue
    const revenueData = db.prepare("SELECT SUM(amount_paid) as total_revenue FROM subscriptions WHERE payment_status='paid'").get() as { total_revenue: number | null };
    
    res.json({
      totalLeads: leadsCount.count,
      conversionRate: leadsCount.count > 0 ? (paidCount.count / leadsCount.count) * 100 : 0,
      totalRevenue: revenueData.total_revenue || 0,
    });
  });

  // 2. Fetch Leads
  app.get("/api/leads", (req, res) => {
    const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
    res.json(leads);
  });

  // 3. Update Lead Status
  app.put("/api/leads/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, staffId } = req.body;
    
    db.prepare("UPDATE leads SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(status, id);
    
    // Log activity
    db.prepare("INSERT INTO crm_activities (id, lead_id, staff_id, activity_type, description) VALUES (?, ?, ?, ?, ?)").run(
      crypto.randomUUID(), id, staffId || 'system', 'status_changed', `Status updated to \${status}`
    );

    res.json({ success: true });
  });

  // 4. Track Viewer Ping
  app.post("/api/leads/:business_id/ping", (req, res) => {
    const { business_id } = req.params;
    
    db.prepare(`
      UPDATE leads 
      SET view_count = view_count + 1, 
          last_viewed_at = CURRENT_TIMESTAMP, 
          status = CASE WHEN status = 'contacted' THEN 'viewed' ELSE status END
      WHERE business_id = ?
    `).run(business_id);
    
    res.json({ success: true });
  });

  // 5. Google Places Proxy (Mock or Real)
  app.get("/api/places/search", async (req, res) => {
    const { query } = req.query;
    if (!process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_PLACES_API_KEY.length < 10) {
      // Mock data if no API key
      return res.json({
        mock: true,
        results: [
          {
             place_id: "ChIJ123",
             name: "Kedai Kopi Senja " + query,
             formatted_address: "Jl. Sudirman No 123",
             rating: 4.8,
             user_ratings_total: 120,
             business_status: "OPERATIONAL"
          }
        ]
      });
    }

    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=\${encodeURIComponent(query as string)}&key=\${process.env.GOOGLE_PLACES_API_KEY}`);
      const data = await response.json();
      res.json(data);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 6. Save JSON Site & Lead
  app.post("/api/sites/generate", (req, res) => {
    const { jsonContent, businessId, businessName, phone, originData } = req.body;
    
    try {
      const leadId = crypto.randomUUID();
      
      db.prepare(`
        INSERT INTO leads (id, business_id, business_name, phone, status)
        VALUES (?, ?, ?, ?, 'scraped')
        ON CONFLICT(business_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
      `).run(leadId, businessId, businessName, phone);

      db.prepare(`
        INSERT INTO json_sites (business_id, json_content)
        VALUES (?, ?)
        ON CONFLICT(business_id) DO UPDATE SET json_content = excluded.json_content, updated_at = CURRENT_TIMESTAMP
      `).run(businessId, JSON.stringify(jsonContent));

      res.json({ success: true, businessId });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 7. Get JSON Site
  app.get("/api/sites/:business_id", (req, res) => {
    const { business_id } = req.params;
    const row = db.prepare("SELECT json_content FROM json_sites WHERE business_id = ?").get() as { json_content: string };
    
    if (row && row.json_content) {
      res.json(JSON.parse(row.json_content));
    } else {
      res.status(404).json({ error: "Site not found" });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:\${PORT}`);
  });
}

startServer();
