import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  $transaction: vi.fn(),
  builder: { findFirst: vi.fn() },
  buildSession: { upsert: vi.fn(), updateMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  buildSelection: { deleteMany: vi.fn(), createMany: vi.fn() },
  orderAttribution: { upsert: vi.fn() },
}));
vi.mock("../../db.server", () => ({ default: db }));

import { attributeOrder, markBuildSessionCartAdded, upsertValidatedBuild } from "./build-session.server";

describe("build session persistence", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists a validated build and replaces selections on retry", async () => {
    const session = { id: "session-1", shopId: "shop-a", builderId: "builder-1" };
    db.builder.findFirst.mockResolvedValue({ id: "builder-1" });
    db.buildSession.upsert.mockResolvedValue(session);
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
    await upsertValidatedBuild({ shopId: "shop-a", builderId: "builder-1", publicSessionId: "pcb_123456789012", currency: "USD", selections: [{ stepId: "step-1", productId: "gid://shopify/Product/1", variantId: "gid://shopify/ProductVariant/1", price: "100.00" }] });
    expect(db.buildSession.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { publicSessionId: "pcb_123456789012" } }));
    expect(db.buildSelection.deleteMany).toHaveBeenCalledWith({ where: { buildSessionId: "session-1" } });
    expect(db.buildSelection.createMany).toHaveBeenCalledTimes(1);
  });

  it("rejects a session reused by another shop", async () => {
    db.builder.findFirst.mockResolvedValue({ id: "builder-1" });
    db.buildSession.upsert.mockResolvedValue({ id: "session-1", shopId: "shop-b", builderId: "builder-1" });
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
    await expect(upsertValidatedBuild({ shopId: "shop-a", builderId: "builder-1", publicSessionId: "pcb_123456789012", currency: "USD", selections: [] })).rejects.toThrow("ownership mismatch");
  });

  it("marks only the current shop session as added to cart", async () => {
    await markBuildSessionCartAdded("shop-a", "pcb_123456789012");
    expect(db.buildSession.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { shopId: "shop-a", publicSessionId: "pcb_123456789012" } }));
  });

  it("attributes only matching lines and is idempotent through upsert", async () => {
    db.buildSession.findFirst.mockResolvedValue({ id: "session-1", builderId: "builder-1" });
    db.$transaction.mockResolvedValue([]);
    const result = await attributeOrder({ shopId: "shop-a", orderId: "gid://shopify/Order/10", lines: [{ sessionId: "pcb_123456789012", value: 100 }, { sessionId: "pcb_123456789012", value: 20 }] });
    expect(result).toEqual({ sessions: 1, attributedValue: 120 });
    expect(db.orderAttribution.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { shopId_shopifyOrderId_buildSessionId: { shopId: "shop-a", shopifyOrderId: "gid://shopify/Order/10", buildSessionId: "session-1" } } }));
  });

  it("skips an unknown session without failing the webhook", async () => {
    db.buildSession.findFirst.mockResolvedValue(null);
    await expect(attributeOrder({ shopId: "shop-a", orderId: "gid://shopify/Order/10", lines: [{ sessionId: "unknown", value: 100 }] })).resolves.toEqual({ sessions: 1, attributedValue: 0 });
    expect(db.orderAttribution.upsert).not.toHaveBeenCalled();
  });
});
