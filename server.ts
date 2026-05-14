import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import Database from "better-sqlite3";
import fs from "fs";

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

  CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

function getSetting(key: string, envFallback?: string): string | undefined {
  try {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = ?").get(key) as { value: string };
    return row ? row.value : envFallback;
  } catch (e) {
    return envFallback;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cors());

  // --- API ROUTES ---

  // Settings API
  app.get("/api/settings", (req, res) => {
    try {
      const rows = db.prepare("SELECT key, value FROM system_settings").all() as {key: string, value: string}[];
      const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/settings", (req, res) => {
    const settings = req.body;
    try {
      const stmt = db.prepare("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP");
      const initMany = db.transaction((settingsObj) => {
        for (const [k, v] of Object.entries(settingsObj)) {
          if (v !== undefined && v !== null) {
            stmt.run(k, String(v));
          }
        }
      });
      initMany(settings);
      res.json({ success: true });
    } catch(e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/public-settings", (req, res) => {
    try {
      const rows = db.prepare("SELECT key, value FROM system_settings WHERE key IN ('PAYMENT_LINK_BASIC', 'PAYMENT_LINK_PREMIUM')").all() as {key: string, value: string}[];
      const settings = rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {});
      res.json(settings);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // JSON Schema File 
  app.get("/api/schema", (req, res) => {
    try {
      const templateStr = fs.readFileSync(path.join(process.cwd(), "JSON", "template-schema.json"), "utf8");
      res.json(JSON.parse(templateStr));
    } catch(e) {
      res.status(500).json({ error: "Could not read schema" });
    }
  });

  // Recent Activities
  app.get("/api/activities", (req, res) => {
    try {
      const activities = db.prepare(`
        SELECT c.*, l.business_name 
        FROM crm_activities c 
        JOIN leads l ON c.lead_id = l.id 
        ORDER BY c.created_at DESC LIMIT 10
      `).all();
      res.json(activities);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // 1. Dashboard Stats
  app.get("/api/stats", (req, res) => {
    try {
      const leadsCount = db.prepare("SELECT COUNT(*) as count FROM leads").get() as { count: number };
      const paidCount = db.prepare("SELECT COUNT(*) as count FROM leads WHERE status='won_paid'").get() as { count: number };
      
      // Revenue
      const revenueData = db.prepare("SELECT SUM(amount_paid) as total_revenue FROM subscriptions WHERE payment_status='paid'").get() as { total_revenue: number | null };
      
      res.json({
        totalLeads: leadsCount.count,
        conversionRate: leadsCount.count > 0 ? (paidCount.count / leadsCount.count) * 100 : 0,
        totalRevenue: revenueData.total_revenue || 0,
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
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
    const placesKey = getSetting("GOOGLE_PLACES_API_KEY", process.env.GOOGLE_PLACES_API_KEY);

    if (!placesKey || placesKey.length < 10) {
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
  app.post("/api/sites/generate", async (req, res) => {
    const { jsonContent, businessId, businessName, phone, originData, model, provider } = req.body;
    
    try {
      let finalJson = jsonContent;
      
      // AI generation
      if (model && provider) {
        try {
          const templateStr = fs.readFileSync(path.join(process.cwd(), "JSON", "template-schema.json"), "utf8");
          const systemMsg = `You are an expert web designer and copywriter. Generate a strictly typed JSON output formatted to this exact schema:\n${templateStr}\n\nUse the business info provided to fill in the text, adjust colors based on their niche, and provide engaging copywriting. ONLY output JSON, no markdown formatting.`;
          const userMsg = `Business Name: ${businessName}\nData: ${JSON.stringify(originData)}`;

          let responseContent = "";
          
          const orKey = getSetting("OPENROUTER_API_KEY", process.env.OPENROUTER_API_KEY);
          const oaKey = getSetting("OPENAI_API_KEY", process.env.OPENAI_API_KEY);
          const gmKey = getSetting("GEMINI_API_KEY", process.env.GEMINI_API_KEY);
          const ocKey = getSetting("OPENCODE_API_KEY", process.env.OPENCODE_API_KEY);
          const ocUrl = getSetting("OPENCODE_BASE_URL", process.env.OPENCODE_BASE_URL) || "https://api.opencode.example.com/v1/chat/completions";

          if (provider === "OpenRouter" && orKey) {
            const apiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${orKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: model, 
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemMsg },
                  { role: "user", content: userMsg }
                ]
              })
            });
            const aiJson = await apiRes.json();
            if (aiJson.choices && aiJson.choices[0].message.content) {
              responseContent = aiJson.choices[0].message.content;
            }
          } 
          else if (provider === "OpenAI" && oaKey) {
            const apiRes = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${oaKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: model,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemMsg },
                  { role: "user", content: userMsg }
                ]
              })
            });
            const aiJson = await apiRes.json();
            if (aiJson.choices && aiJson.choices[0].message.content) {
              responseContent = aiJson.choices[0].message.content;
            }
          }
          else if (provider === "Gemini" && gmKey) {
            const apiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gmKey}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemMsg }] },
                contents: [{ parts: [{ text: userMsg }] }],
                generationConfig: { responseMimeType: "application/json" }
              })
            });
            const aiJson = await apiRes.json();
            if (aiJson.candidates && aiJson.candidates[0].content.parts[0].text) {
              responseContent = aiJson.candidates[0].content.parts[0].text;
            }
          }
          else if (provider === "Opencode" && ocKey) {
            // Opencode as an openai-compatible endpoint
            const apiRes = await fetch(ocUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${ocKey}`,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                model: model,
                response_format: { type: "json_object" },
                messages: [
                  { role: "system", content: systemMsg },
                  { role: "user", content: userMsg }
                ]
              })
            });
            const aiJson = await apiRes.json();
            if (aiJson.choices && aiJson.choices[0].message.content) {
              responseContent = aiJson.choices[0].message.content;
            }
          }

          if (responseContent) {
            // strip markdown formatting if the model still provided it
            responseContent = responseContent.replace(/```json/g, "").replace(/```/g, "").trim();
            finalJson = JSON.parse(responseContent);
            if(finalJson.meta) finalJson.meta.businessId = businessId;
          } else {
             console.log("No valid AI response generated, continuing with mock");
          }

        } catch(aiErr) {
          console.error("AI generation failed, falling back to mock:", aiErr);
        }
      }

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
      `).run(businessId, JSON.stringify(finalJson));

      try {
        const leadRow = db.prepare("SELECT id FROM leads WHERE business_id = ?").get() as { id: string };
        if (leadRow) {
          db.prepare(`
            INSERT INTO crm_activities (id, lead_id, staff_id, activity_type, description)
            VALUES (?, ?, ?, ?, ?)
          `).run(crypto.randomUUID(), leadRow.id, "system", "note_added", `AI Website generated successfully using ${provider || 'mock'} (${model || 'mock-json'}).`);
        }
      } catch (actErr) {
        console.error("Activity log error:", actErr);
      }

      res.json({ success: true, businessId });
    } catch (e: any) {
      console.error(e);
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
