import prisma from "../../db.server";

export type AnalyticsRange = "7d" | "30d" | "all";

export type BuildAnalytics = Awaited<ReturnType<typeof getBuildAnalytics>>;

export async function getBuildAnalytics(shopId: string, range: AnalyticsRange = "30d") {
  const since = range === "all" ? undefined : new Date(Date.now() - (range === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000);
  const where = { shopId, ...(since ? { createdAt: { gte: since } } : {}) };
  const [validated, addedToCart, attributions] = await Promise.all([
    prisma.buildSession.count({ where: { ...where, validatedAt: { not: null } } }),
    prisma.buildSession.count({ where: { ...where, cartAddedAt: { not: null } } }),
    prisma.orderAttribution.findMany({ where, orderBy: { createdAt: "desc" }, select: { attributedValue: true, currency: true, builderId: true, buildSessionId: true, shopifyOrderId: true, shopifyOrderName: true, createdAt: true, builder: { select: { name: true } } } }),
  ]);
  const revenue = attributions.reduce((sum, row) => sum + Number(row.attributedValue ?? 0), 0);
  const orderIds = new Set(attributions.map((row) => row.shopifyOrderId));
  const breakdown = new Map<string, { builderId: string; builderName: string; validated: number; addedToCart: number; purchasedBuilds: number; attributedOrders: number; revenue: number }>();
  const builderIds = [...new Set(attributions.map((row) => row.builderId))];
  const builderSessionWhere = { ...where, ...(builderIds.length ? { builderId: { in: builderIds } } : {}) };
  const builderSessions = await prisma.buildSession.findMany({ where: builderSessionWhere, select: { builderId: true, validatedAt: true, cartAddedAt: true } });
  for (const session of builderSessions) {
    const current = breakdown.get(session.builderId) ?? { builderId: session.builderId, builderName: "Unknown builder", validated: 0, addedToCart: 0, purchasedBuilds: 0, attributedOrders: 0, revenue: 0 };
    if (session.validatedAt) current.validated += 1;
    if (session.cartAddedAt) current.addedToCart += 1;
    breakdown.set(session.builderId, current);
  }
  for (const row of attributions) {
    const current = breakdown.get(row.builderId) ?? { builderId: row.builderId, builderName: row.builder.name, validated: 0, addedToCart: 0, purchasedBuilds: 0, attributedOrders: 0, revenue: 0 };
    current.builderName = row.builder.name;
    current.purchasedBuilds += 1;
    current.attributedOrders = new Set(attributions.filter((item) => item.builderId === row.builderId).map((item) => item.shopifyOrderId)).size;
    current.revenue += Number(row.attributedValue ?? 0);
    breakdown.set(row.builderId, current);
  }
  return { range, validated, addedToCart, purchasedBuilds: attributions.length, attributedOrders: orderIds.size, attributedRevenue: revenue, averageBuildValue: attributions.length ? revenue / attributions.length : 0, breakdown: [...breakdown.values()], recentOrders: attributions.slice(0, 20) };
}
