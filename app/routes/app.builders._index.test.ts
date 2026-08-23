import { describe, it, expect, vi, beforeEach } from "vitest";
import { loader as buildersIndexLoader } from "./app.builders._index";

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../domains/builder-admin/builder.server", () => ({
  listBuilders: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import { listBuilders } from "../domains/builder-admin/builder.server";

describe("app.builders._index route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns builders for the authenticated shop", async () => {
    const mockBuilders = [
      { id: "1", shopId: "shop-1", name: "Builder 1", status: "draft" as const, version: 1, createdAt: new Date(), updatedAt: new Date() },
    ];
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (listBuilders as any).mockResolvedValue(mockBuilders);

    const request = new Request("http://localhost/app/builders");
    const result = await buildersIndexLoader({ request } as any);
    expect(result).toEqual({ builders: mockBuilders });
  });

  it("denies cross-shop access by scoping by session shop", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-2" } });
    (listBuilders as any).mockResolvedValue([]);

    const request = new Request("http://localhost/app/builders");
    const result = await buildersIndexLoader({ request } as any);
    expect(result.builders).toEqual([]);
  });
});
