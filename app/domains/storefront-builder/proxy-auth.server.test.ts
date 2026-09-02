import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../shopify.server", () => ({
  authenticate: {
    public: {
      appProxy: vi.fn(),
    },
  },
  unauthenticated: {
    admin: vi.fn(),
  },
}));

import { authenticate, unauthenticated } from "../../shopify.server";
import { authenticatePcBuilderStorefront } from "./proxy-auth.server";

describe("authenticatePcBuilderStorefront", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the signed app proxy context when Shopify authentication succeeds", async () => {
    const admin = { graphql: vi.fn() };
    (authenticate.public.appProxy as any).mockResolvedValue({
      session: { shop: "pc-builder-app.myshopify.com" },
      admin,
    });

    const result = await authenticatePcBuilderStorefront(
      new Request("https://example.trycloudflare.com/apps/pc-builder?shop=pc-builder-app.myshopify.com")
    );

    expect(result).toEqual({ shop: "pc-builder-app.myshopify.com", admin });
    expect(unauthenticated.admin).not.toHaveBeenCalled();
  });

  it("falls back to the installed offline session when app proxy signature validation fails", async () => {
    const admin = { graphql: vi.fn() };
    (authenticate.public.appProxy as any).mockRejectedValue(new Response(null, { status: 400 }));
    (unauthenticated.admin as any).mockResolvedValue({
      session: { shop: "pc-builder-app.myshopify.com" },
      admin,
    });

    const result = await authenticatePcBuilderStorefront(
      new Request("https://example.trycloudflare.com/apps/pc-builder?shop=pc-builder-app.myshopify.com")
    );

    expect(unauthenticated.admin).toHaveBeenCalledWith("pc-builder-app.myshopify.com");
    expect(result).toEqual({ shop: "pc-builder-app.myshopify.com", admin });
  });

  it("rejects fallback requests without a valid myshopify shop", async () => {
    (authenticate.public.appProxy as any).mockRejectedValue(new Response(null, { status: 400 }));

    const result = await authenticatePcBuilderStorefront(
      new Request("https://example.trycloudflare.com/apps/pc-builder?shop=not-shop.example.com")
    );

    expect(result).toBeNull();
    expect(unauthenticated.admin).not.toHaveBeenCalled();
  });
});
