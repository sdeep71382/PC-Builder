import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import type {
  ShopifyCatalogResult,
  ShopifyProductNode,
  ShopifyVariantNode,
  StepCatalogAssignment,
} from "../../domains/builder-admin/types";

interface CatalogAssignmentPickerProps {
  assignments: StepCatalogAssignment[];
  catalog: ShopifyCatalogResult;
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  } | null;
}

function matchesSearch(title: string, search: string): boolean {
  return title.toLowerCase().includes(search.trim().toLowerCase());
}

export function CatalogAssignmentPicker({
  assignments,
  catalog,
  feedback,
}: CatalogAssignmentPickerProps) {
  const assignFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const [productSearch, setProductSearch] = useState("");
  const [variantSearch, setVariantSearch] = useState("");

  const isAssigning =
    ["loading", "submitting"].includes(assignFetcher.state) &&
    assignFetcher.formMethod === "POST";
  const isRemoving =
    ["loading", "submitting"].includes(removeFetcher.state) &&
    removeFetcher.formMethod === "POST";

  const assignedProductIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.referenceType === "product")
          .map((assignment) => assignment.shopifyProductId)
      ),
    [assignments]
  );
  const assignedVariantIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.referenceType === "variant")
          .map((assignment) => assignment.shopifyVariantId)
      ),
    [assignments]
  );

  const filteredProducts: ShopifyProductNode[] =
    catalog.type === "success"
      ? catalog.products.filter(
          (product) =>
            !assignedProductIds.has(product.id) && matchesSearch(product.title, productSearch)
        )
      : [];
  const filteredVariants: ShopifyVariantNode[] =
    catalog.type === "success"
      ? catalog.variants.filter(
          (variant) =>
            !assignedVariantIds.has(variant.id) && matchesSearch(variant.title, variantSearch)
        )
      : [];

  return (
    <s-section heading="Catalog assignments">
      {feedback && feedback.type !== "success" && (
        <div role="status" aria-live="polite">
          <s-banner tone={feedback.type === "validation" ? "warning" : "critical"}>
            {feedback.message}
          </s-banner>
        </div>
      )}

      <s-paragraph>
        Assign existing Shopify products or variants to this step. Shopify remains
        the source of truth for product and variant details.
      </s-paragraph>

      {assignments.length === 0 ? (
        <s-paragraph>No catalog items assigned to this step.</s-paragraph>
      ) : (
        <s-unordered-list>
          {assignments.map((assignment) => (
            <s-list-item key={assignment.id}>
              {assignment.referenceType === "product"
                ? `Product: ${assignment.shopifyProductId}`
                : `Variant: ${assignment.shopifyVariantId}`}
              <s-badge tone={assignment.referenceType === "product" ? "success" : "info"}>
                {assignment.referenceType}
              </s-badge>
              <removeFetcher.Form method="post">
                <input type="hidden" name="assignmentId" value={assignment.id} />
                <s-button variant="secondary" type="submit" disabled={isRemoving}>
                  Remove
                </s-button>
              </removeFetcher.Form>
            </s-list-item>
          ))}
        </s-unordered-list>
      )}

      {catalog.type === "failure" ? (
        <s-banner tone="critical">
          Unable to load the Shopify catalog: {catalog.message}
        </s-banner>
      ) : (
        <>
          <s-section heading="Assign a product">
            <input
              type="text"
              aria-label="Search products by title"
              placeholder="Search products by title"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            {filteredProducts.length === 0 ? (
              <s-paragraph>No matching products available to assign.</s-paragraph>
            ) : (
              <s-unordered-list>
                {filteredProducts.slice(0, 20).map((product) => (
                  <s-list-item key={product.id}>
                    {product.title}
                    <assignFetcher.Form method="post">
                      <input type="hidden" name="referenceType" value="product" />
                      <input type="hidden" name="shopifyProductId" value={product.id} />
                      <s-button variant="primary" type="submit" disabled={isAssigning}>
                        Assign
                      </s-button>
                    </assignFetcher.Form>
                  </s-list-item>
                ))}
              </s-unordered-list>
            )}
          </s-section>

          <s-section heading="Assign a variant">
            <input
              type="text"
              aria-label="Search variants by title"
              placeholder="Search variants by title"
              value={variantSearch}
              onChange={(event) => setVariantSearch(event.target.value)}
            />
            {filteredVariants.length === 0 ? (
              <s-paragraph>No matching variants available to assign.</s-paragraph>
            ) : (
              <s-unordered-list>
                {filteredVariants.slice(0, 20).map((variant) => (
                  <s-list-item key={variant.id}>
                    {variant.product.title} — {variant.title}
                    <assignFetcher.Form method="post">
                      <input type="hidden" name="referenceType" value="variant" />
                      <input type="hidden" name="shopifyVariantId" value={variant.id} />
                      <s-button variant="primary" type="submit" disabled={isAssigning}>
                        Assign
                      </s-button>
                    </assignFetcher.Form>
                  </s-list-item>
                ))}
              </s-unordered-list>
            )}
          </s-section>
        </>
      )}
    </s-section>
  );
}
