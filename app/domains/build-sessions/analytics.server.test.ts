import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  buildSession: { count: vi.fn(), findMany: vi.fn() },
  orderAttribution: { findMany: vi.fn() },
}));
vi.mock("../../db.server", () => ({ default: db }));
import { getBuildAnalytics } from "./analytics.server";

describe("build analytics", () => {
  beforeEach(() => vi.clearAllMocks());
  it("aggregates shop-scoped persisted metrics", async () => {
    db.buildSession.count.mockResolvedValueOnce(4).mockResolvedValueOnce(3);
    db.buildSession.findMany.mockResolvedValue([{ builderId: "b1", validatedAt: new Date(), cartAddedAt: new Date() }]);
    db.orderAttribution.findMany.mockResolvedValue([{ builderId: "b1", buildSessionId: "s1", shopifyOrderId: "o1", shopifyOrderName: "#1", createdAt: new Date(), builder: { name: "Gaming" }, attributedValue: 100, currency: "USD" }, { builderId: "b1", buildSessionId: "s2", shopifyOrderId: "o1", shopifyOrderName: "#1", createdAt: new Date(), builder: { name: "Gaming" }, attributedValue: 50, currency: "USD" }]);
    const result = await getBuildAnalytics("shop-a", "all");
    expect(result.validated).toBe(4);
    expect(result.addedToCart).toBe(3);
    expect(result.purchasedBuilds).toBe(2);
    expect(result.attributedOrders).toBe(1);
    expect(result.attributedRevenue).toBe(150);
    expect(result.breakdown[0]).toMatchObject({ builderId: "b1", purchasedBuilds: 2, attributedOrders: 1, revenue: 150 });
    expect(db.buildSession.count.mock.calls[0][0].where.shopId).toBe("shop-a");
  });
});
