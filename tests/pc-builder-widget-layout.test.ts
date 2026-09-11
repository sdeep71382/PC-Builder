import { readFileSync } from "node:fs";

import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const css = readFileSync(
  "extensions/pc-builder-widget/assets/pc-builder.css",
  "utf8",
);
const widgetScriptPath =
  "../extensions/pc-builder-widget/assets/pc-builder.js";

const builderResponse = {
  builder: {
    publicId: "starter-builder",
    name: "Starter PC Builder",
    description: "Build a balanced starter PC.",
    steps: [
      {
        publicId: "processor-step",
        key: "processor",
        name: "Processor",
        position: 1,
        required: true,
        state: "available",
        products: [
          {
            productId: "gid://shopify/Product/1",
            variantId: "gid://shopify/ProductVariant/1",
            productTitle: "Ryzen 7 Builder CPU",
            variantTitle: "Default Title",
            vendor: "PC Builder Demo",
            available: true,
            purchasable: true,
            price: { amount: "249.00", currencyCode: "USD" },
            specifications: {},
            image: null,
          },
        ],
      },
    ],
  },
  compatibilityRules: [],
};

describe("PC builder responsive layout", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    document.head.innerHTML = `<style>${css}</style>`;
    document.body.innerHTML = `
      <div
        class="pc-builder-widget"
        data-pc-builder-root
        data-proxy-path="/apps/pc-builder-1"
      ></div>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => builderResponse,
      }),
    );

    await import(widgetScriptPath);
    await waitFor(() => {
      expect(document.querySelector(".pc-builder-workspace")).not.toBeNull();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  test("places the preview, divider, and catalog in separate desktop grid areas", () => {
    const workspace = document.querySelector<HTMLElement>(
      ".pc-builder-workspace",
    );
    const preview = document.querySelector<HTMLElement>(
      ".pc-builder-visual-panel",
    );
    const divider = document.querySelector<HTMLElement>(".pc-builder-collapse");
    const catalog = document.querySelector<HTMLElement>(".pc-builder-catalog");

    expect(getComputedStyle(workspace!).gridTemplateAreas).toBe(
      '"preview divider catalog"',
    );
    expect(getComputedStyle(preview!).gridArea).toBe("preview");
    expect(getComputedStyle(divider!).gridArea).toBe("divider");
    expect(getComputedStyle(catalog!).gridArea).toBe("catalog");
  });

  test("announces whether the desktop product catalog is expanded", () => {
    const toggle = document.querySelector<HTMLButtonElement>(
      "[data-toggle-products]",
    );

    expect(toggle).toHaveAttribute("aria-controls", "pc-builder-catalog");
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle!);

    expect(document.querySelector("[data-toggle-products]")).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(document.querySelector(".pc-builder-shell")).toHaveClass(
      "is-catalog-collapsed",
    );
  });
});
