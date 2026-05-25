import type { D1Database } from "../_shared/types";

export type StatsDeps = {
  json: (data: unknown, status?: number) => Response;
  getDailyUsage: (db: D1Database) => Promise<unknown>;
};

export async function handleActivities(deps: Pick<StatsDeps, "json">, db: D1Database): Promise<Response> {
  try {
    const activities = await db
      .prepare(
        `SELECT c.*, l.business_name
         FROM crm_activities c
         LEFT JOIN leads l ON c.lead_id = l.id
         ORDER BY c.created_at DESC
         LIMIT 10`,
      )
      .all();
    return deps.json(activities.results || []);
  } catch (error) {
    console.error("Activities fallback:", error);
    return deps.json([]);
  }
}

export async function handleStats(deps: StatsDeps, db: D1Database): Promise<Response> {
  try {
    const leadsCount = await db.prepare("SELECT COUNT(*) as count FROM leads").first<{ count: number }>();
    const paidCount = await db.prepare("SELECT COUNT(*) as count FROM leads WHERE status='won_paid'").first<{ count: number }>();
    const revenueData = await db
      .prepare("SELECT SUM(amount_paid) as total_revenue FROM subscriptions WHERE payment_status='paid'")
      .first<{ total_revenue: number | null }>();

    const totalLeads = Number(leadsCount?.count || 0);
    const paidLeads = Number(paidCount?.count || 0);
    return deps.json({
      totalLeads,
      conversionRate: totalLeads > 0 ? (paidLeads / totalLeads) * 100 : 0,
      totalRevenue: Number(revenueData?.total_revenue || 0),
      dailyUsage: await deps.getDailyUsage(db),
    });
  } catch (error) {
    console.error("Stats fallback:", error);
    return deps.json({
      totalLeads: 0,
      conversionRate: 0,
      totalRevenue: 0,
      dailyUsage: await deps.getDailyUsage(db),
    });
  }
}
