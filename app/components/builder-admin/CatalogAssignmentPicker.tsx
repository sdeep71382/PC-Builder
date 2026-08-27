import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import type {
  ShopifyCatalogResult,
  ShopifyCollectionNode,
  ShopifyProductNode,
  ShopifyVariantNode,
  StepCatalogAssignment,
} from "../../domains/builder-admin/types";

interface CatalogAssignmentPickerProps {
  assignments: StepCatalogAssignment[];
  builderId: string;
  stepName: string;
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
  builderId,
  stepName,
  catalog,
  feedback,
}: CatalogAssignmentPickerProps) {
  const assignFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const [collectionSearch, setCollectionSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [variantSearch, setVariantSearch] = useState("");

  const isAssigning =
    ["loading", "submitting"].includes(assignFetcher.state) &&
    assignFetcher.formMethod === "POST";
  const isRemoving =
    ["loading", "submitting"].includes(removeFetcher.state) &&
    removeFetcher.formMethod === "POST";

  const assignedCollectionIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.referenceType === "collection")
          .map((assignment) => assignment.shopifyCollectionId)
      ),
    [assignments]
  );
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

  const filteredCollections: ShopifyCollectionNode[] =
    catalog.type === "success"
      ? catalog.collections.filter(
          (collection) =>
            !assignedCollectionIds.has(collection.id) &&
            matchesSearch(collection.title, collectionSearch)
        )
      : [];
  const filteredProducts: ShopifyProductNode[] =
    catalog.type === "success"
      ? catalog.products.filter(
          (product) =>
            !assignedProductIds.has(product.id) &&
            matchesSearch(product.title, productSearch)
        )
      : [];
  const filteredVariants: ShopifyVariantNode[] =
    catalog.type === "success"
      ? catalog.variants.filter(
          (variant) =>
            !assignedVariantIds.has(variant.id) &&
            (matchesSearch(variant.title, variantSearch) ||
              matchesSearch(variant.product.title, variantSearch))
        )
      : [];

  return (
    <s-page heading="Configure collections">
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">Catalog assignment</p>
            <h1 className="builder-admin__title">{stepName}</h1>
            <p className="builder-admin__subtitle">
              Choose the Shopify collection customers should browse during this step.
              Collections keep this setup easy for merchants: update the collection in
              Shopify and the builder follows the same catalog source.
            </p>
          </div>
          <div className="builder-admin__actions">
            <s-button href={`/app/builders/${builderId}/steps`}>Back to steps</s-button>
          </div>
        </div>

        {feedback && feedback.type !== "success" && (
          <div className="builder-card" role="status" aria-live="polite">
            <s-banner tone={feedback.type === "validation" ? "warning" : "critical"}>
              {feedback.message}
            </s-banner>
          </div>
        )}

        <div className="builder-card">
          <h2 className="builder-card__title">Assigned items</h2>
          <p className="builder-card__text">
            Assigned collections define the customer choices for this step. Product and
            variant assignments are still supported for precise exceptions.
          </p>

          {assignments.length === 0 ? (
            <p className="builder-card__text" style={{ marginTop: "12px" }}>
              No collection assigned yet.
            </p>
          ) : (
            <div className="builder-catalog-list">
              {assignments.map((assignment) => (
                <div className="builder-catalog-item" key={assignment.id}>
                  <div>
                    <strong>
                      {assignment.referenceType === "collection"
                        ? "Collection"
                        : assignment.referenceType === "product"
                          ? "Product"
                          : "Variant"}
                    </strong>
                    <div className="builder-list__meta">
                      {assignment.referenceType === "collection"
                        ? assignment.shopifyCollectionId
                        : assignment.referenceType === "product"
                        ? assignment.shopifyProductId
                        : assignment.shopifyVariantId}
                    </div>
                  </div>
                  <removeFetcher.Form method="post">
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <s-button variant="secondary" type="submit" disabled={isRemoving}>
                      Remove
                    </s-button>
                  </removeFetcher.Form>
                </div>
              ))}
            </div>
          )}
        </div>

        {catalog.type === "failure" ? (
          <div className="builder-card">
            <s-banner tone="critical">
              Unable to load the Shopify catalog: {catalog.message}
            </s-banner>
          </div>
        ) : (
          <>
            <div className="builder-card">
              <h2 className="builder-card__title">Assign collections</h2>
              <p className="builder-card__text">
                Pick one or more Shopify collections for this step. This is the normal
                setup path for a PC builder because collections can be maintained in
                Shopify without editing the builder every time a product changes.
              </p>
              <input
                className="builder-search"
                type="text"
                aria-label="Search collections by title"
                placeholder="Search collections by title"
                value={collectionSearch}
                onChange={(event) => setCollectionSearch(event.target.value)}
              />
              {filteredCollections.length === 0 ? (
                <p className="builder-card__text">No matching collections available.</p>
              ) : (
                <div className="builder-catalog-list">
                  {filteredCollections.slice(0, 20).map((collection) => (
                    <div className="builder-catalog-item" key={collection.id}>
                      <div>
                        <strong>{collection.title}</strong>
                        <div className="builder-list__meta">/{collection.handle}</div>
                      </div>
                      <assignFetcher.Form method="post">
                        <input type="hidden" name="referenceType" value="collection" />
                        <input type="hidden" name="shopifyCollectionId" value={collection.id} />
                        <s-button variant="primary" type="submit" disabled={isAssigning}>
                          Assign
                        </s-button>
                      </assignFetcher.Form>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="builder-catalog-grid builder-catalog-grid--secondary">
              <div className="builder-card">
                <h2 className="builder-card__title">Optional product assignment</h2>
                <p className="builder-card__text">
                  Use this only when a single product should be available outside a
                  collection.
                </p>
                <input
                  className="builder-search"
                  type="text"
                  aria-label="Search products by title"
                  placeholder="Search products by title"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                />
                {filteredProducts.length === 0 ? (
                  <p className="builder-card__text">No matching products available.</p>
                ) : (
                  <div className="builder-catalog-list">
                    {filteredProducts.slice(0, 20).map((product) => (
                      <div className="builder-catalog-item" key={product.id}>
                        <strong>{product.title}</strong>
                        <assignFetcher.Form method="post">
                          <input type="hidden" name="referenceType" value="product" />
                          <input type="hidden" name="shopifyProductId" value={product.id} />
                          <s-button variant="secondary" type="submit" disabled={isAssigning}>
                            Assign
                          </s-button>
                        </assignFetcher.Form>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            <div className="builder-card">
              <h2 className="builder-card__title">Optional variant assignment</h2>
              <p className="builder-card__text">
                Use this only when a specific variant should be available outside a
                collection.
              </p>
              <input
                className="builder-search"
                type="text"
                aria-label="Search variants by title"
                placeholder="Search variants by title"
                value={variantSearch}
                onChange={(event) => setVariantSearch(event.target.value)}
              />
              {filteredVariants.length === 0 ? (
                <p className="builder-card__text">No matching variants available.</p>
              ) : (
                <div className="builder-catalog-list">
                  {filteredVariants.slice(0, 20).map((variant) => (
                    <div className="builder-catalog-item" key={variant.id}>
                      <div>
                        <strong>{variant.product.title}</strong>
                        <div className="builder-list__meta">{variant.title}</div>
                      </div>
                      <assignFetcher.Form method="post">
                        <input type="hidden" name="referenceType" value="variant" />
                        <input type="hidden" name="shopifyVariantId" value={variant.id} />
                        <s-button variant="secondary" type="submit" disabled={isAssigning}>
                          Assign
                        </s-button>
                      </assignFetcher.Form>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </div>
          </>
        )}
      </div>
    </s-page>
  );
}
