// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { action as importAction } from "./app.builders.$builderId.steps.$stepId.tags.import";

vi.mock("../shopify.server", () => ({
  authenticate: { admin: vi.fn() },
}));

vi.mock("../domains/compatibility/csv-import.server", () => ({
  importCompatibilityValuesCsv: vi.fn(),
}));

import { authenticate } from "../shopify.server";
import { importCompatibilityValuesCsv } from "../domains/compatibility/csv-import.server";

function csvRequest(fileContent: string, fileName = "values.csv") {
  const formData = new FormData();
  formData.set("csvFile", new File([fileContent], fileName, { type: "text/csv" }));
  return new Request("http://localhost/app/builders/builder-1/steps/step-1/tags/import", {
    method: "POST",
    body: formData,
  });
}

describe("app.builders.$builderId.steps.$stepId.tags.import route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("imports a CSV file and reports per-row results", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (importCompatibilityValuesCsv as any).mockResolvedValue([
      { row: 1, success: true, message: "Value saved." },
      { row: 2, success: false, message: "Unrecognized tag." },
    ]);

    const request = csvRequest("assignment-1,Socket Type,AM5\nassignment-1,Bogus,X");
    const response = await importAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.results).toHaveLength(2);
    expect(data.feedback.message).toContain("1 failed");
    expect(importCompatibilityValuesCsv).toHaveBeenCalledWith(
      "shop-1",
      "step-1",
      "assignment-1,Socket Type,AM5\nassignment-1,Bogus,X"
    );
  });

  it("rejects a request with no file", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });

    const formData = new FormData();
    const request = new Request("http://localhost/app/builders/builder-1/steps/step-1/tags/import", {
      method: "POST",
      body: formData,
    });

    const response = await importAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("validation");
  });

  it("returns an authorization error when the step doesn't belong to the shop", async () => {
    (authenticate.admin as any).mockResolvedValue({ session: { shop: "shop-1" } });
    (importCompatibilityValuesCsv as any).mockRejectedValue(new Error("Step not found."));

    const request = csvRequest("assignment-1,Socket Type,AM5");
    const response = await importAction({ request, params: { builderId: "builder-1", stepId: "step-1" } } as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.feedback.type).toBe("authorization");
  });
});
