import { describe, expect, it, vi } from "vitest";
import { ensureCartTransform } from "./cart-transform.server";

function response(data: unknown) {
  return { json: async () => ({ data }) };
}

describe("ensureCartTransform", () => {
  it("activates the PC Builder cart transform by its stable function handle", async () => {
    const admin = {
      graphql: vi.fn().mockResolvedValue(
        response({
          cartTransformCreate: {
            cartTransform: { id: "gid://shopify/CartTransform/1" },
            userErrors: [],
          },
        })
      ),
    };

    await expect(ensureCartTransform(admin as never)).resolves.toBeUndefined();
    expect(admin.graphql).toHaveBeenCalledWith(
      expect.stringContaining("cartTransformCreate"),
      expect.objectContaining({ variables: { functionHandle: "pc-builder-cart-transform" } })
    );
  });

  it("treats an existing transform as already ready", async () => {
    const admin = {
      graphql: vi.fn().mockResolvedValue(
        response({
          cartTransformCreate: {
            cartTransform: null,
            userErrors: [{ code: "FUNCTION_ALREADY_REGISTERED", message: "Already registered." }],
          },
        })
      ),
    };

    await expect(ensureCartTransform(admin as never)).resolves.toBeUndefined();
  });

  it("surfaces activation failures without exposing credentials", async () => {
    const admin = {
      graphql: vi.fn().mockResolvedValue(
        response({
          cartTransformCreate: {
            cartTransform: null,
            userErrors: [{ code: "CUSTOM_APP_FUNCTION_NOT_ELIGIBLE", message: "The shop is not eligible." }],
          },
        })
      ),
    };

    await expect(ensureCartTransform(admin as never)).rejects.toThrow("The shop is not eligible.");
  });
});
