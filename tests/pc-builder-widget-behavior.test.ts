import { readFileSync } from "node:fs";

import { fireEvent, waitFor } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const css = readFileSync(
  "extensions/pc-builder-widget/assets/pc-builder.css",
  "utf8",
);
const widgetScriptPath =
  "../extensions/pc-builder-widget/assets/pc-builder.js";

function cpuStep(overrides: Record<string, unknown> = {}) {
  return {
    publicId: "processor-step",
    key: "processor",
    name: "Processor",
    position: 1,
    required: true,
    state: "ready",
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
    ...overrides,
  };
}

function memoryStep(overrides: Record<string, unknown> = {}) {
  return {
    publicId: "memory-step",
    key: "memory",
    name: "Memory",
    position: 2,
    required: false,
    state: "ready",
    products: [],
    ...overrides,
  };
}

function compatCallsMatching(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, options]) => {
    if (!options || typeof options.body !== "string") return false;
    try {
      return JSON.parse(options.body).action === "compatible_products";
    } catch {
      return false;
    }
  });
}

function setupWidget(builderResponse: unknown, extraHandler?: (body: any) => unknown) {
  const fetchMock = vi.fn((url: string, options?: RequestInit) => {
    if (!options || !options.method || options.method === "GET") {
      return Promise.resolve({ ok: true, status: 200, json: async () => builderResponse });
    }
    const body = JSON.parse(String(options.body));
    if (body.action === "compatible_products") {
      const products = extraHandler ? extraHandler(body) : [];
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ products }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("PC builder next-step prefetching", () => {
  const memoryProducts = [
    {
      productId: "gid://shopify/Product/2",
      variantId: "gid://shopify/ProductVariant/2",
      productTitle: "16GB Builder RAM",
      variantTitle: "Default Title",
      vendor: "PC Builder Demo",
      available: true,
      purchasable: true,
      price: { amount: "89.00", currencyCode: "USD" },
      specifications: {},
      image: null,
    },
  ];

  const twoStepBuilderResponse = {
    builder: {
      publicId: "starter-builder",
      name: "Starter PC Builder",
      description: "Build a balanced starter PC.",
      steps: [cpuStep(), memoryStep()],
      discount: null,
    },
    compatibilityRules: [],
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    document.head.innerHTML = `<style>${css}</style>`;
    document.body.innerHTML = `
      <div class="pc-builder-widget" data-pc-builder-root data-proxy-path="/apps/pc-builder-1"></div>
    `;
    fetchMock = setupWidget(twoStepBuilderResponse, () => memoryProducts);

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

  test("fetches the next step's compatible products silently as soon as a component is selected", async () => {
    const cpuButton = document.querySelector<HTMLButtonElement>(
      '[data-variant-id="gid://shopify/ProductVariant/1"]',
    );
    fireEvent.click(cpuButton!);

    // The Next button must not enter a loading state from the background prefetch.
    expect(document.querySelector("[data-next]")?.textContent).toBe("NEXT");

    await waitFor(() => {
      expect(compatCallsMatching(fetchMock)).toHaveLength(1);
    });
  });

  test("renders the next step instantly from cache on Next, without firing another request", async () => {
    const cpuButton = document.querySelector<HTMLButtonElement>(
      '[data-variant-id="gid://shopify/ProductVariant/1"]',
    );
    fireEvent.click(cpuButton!);

    await waitFor(() => {
      expect(compatCallsMatching(fetchMock)).toHaveLength(1);
    });
    // Flush the microtasks that store the prefetch result into the cache
    // (the fetch call is recorded before its response-handling chain settles).
    await new Promise((resolve) => setTimeout(resolve, 0));

    fireEvent.click(document.querySelector<HTMLButtonElement>("[data-next]")!);

    await waitFor(() => {
      expect(
        document.querySelector(".pc-builder-current-step strong")?.textContent,
      ).toBe("Memory");
    });

    expect(compatCallsMatching(fetchMock)).toHaveLength(1);
  });
});

describe("PC builder spend discount bar", () => {
  const builderResponseWithDiscount = {
    builder: {
      publicId: "starter-builder",
      name: "Starter PC Builder",
      description: "Build a balanced starter PC.",
      steps: [cpuStep()],
      discount: { thresholdAmount: "200", discountPercentage: "10", label: "Builder bonus" },
    },
    compatibilityRules: [],
  };

  beforeEach(async () => {
    vi.resetModules();
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    document.head.innerHTML = `<style>${css}</style>`;
    document.body.innerHTML = `
      <div class="pc-builder-widget" data-pc-builder-root data-proxy-path="/apps/pc-builder-1"></div>
    `;
    setupWidget(builderResponseWithDiscount);

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

  test("shows how much more is needed to unlock the discount before it is reached", () => {
    const bar = document.querySelector(".pc-builder-discount-bar");
    expect(bar).not.toBeNull();
    expect(bar).not.toHaveClass("is-reached");
    expect(bar?.textContent).toContain("10% off");
  });

  test("marks the discount as unlocked once the running total reaches the threshold", async () => {
    const cpuButton = document.querySelector<HTMLButtonElement>(
      '[data-variant-id="gid://shopify/ProductVariant/1"]',
    );
    fireEvent.click(cpuButton!);

    await waitFor(() => {
      expect(document.querySelector(".pc-builder-discount-bar")).toHaveClass("is-reached");
    });
    expect(document.querySelector(".pc-builder-discount-bar")?.textContent).toContain(
      "Builder bonus unlocked",
    );
  });
});
