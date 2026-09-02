import { useMemo, useState } from "react";
import { useFetcher } from "react-router";
import type {
  ShopifyCatalogResult,
  ShopifyCollectionNode,
  StepCatalogAssignment,
} from "../../domains/builder-admin/types";

interface CatalogAssignmentPickerProps {
  assignments: StepCatalogAssignment[];
  builderId: string;
  stepId: string;
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

function collectionProductCount(collection: ShopifyCollectionNode): string {
  if (collection.productCount === null) {
    return "Product count unavailable";
  }

  return `${collection.productCount} product${collection.productCount === 1 ? "" : "s"}`;
}

function CollectionImage({ collection }: { collection: ShopifyCollectionNode }) {
  if (!collection.image?.url) {
    return <div className="builder-collection-image builder-collection-image--empty" aria-hidden="true" />;
  }

  return (
    <img
      className="builder-collection-image"
      src={collection.image.url}
      alt={collection.image.altText ?? ""}
    />
  );
}

export function CatalogAssignmentPicker({
  assignments,
  builderId,
  stepId,
  stepName,
  catalog,
  feedback,
}: CatalogAssignmentPickerProps) {
  const assignFetcher = useFetcher();
  const removeFetcher = useFetcher();
  const [collectionSearch, setCollectionSearch] = useState("");

  const isAssigning =
    ["loading", "submitting"].includes(assignFetcher.state) &&
    assignFetcher.formMethod === "POST";
  const isRemoving =
    ["loading", "submitting"].includes(removeFetcher.state) &&
    removeFetcher.formMethod === "POST";

  const collectionAssignment = assignments.find(
    (assignment) => assignment.referenceType === "collection"
  );
  const assignedCollectionId = collectionAssignment?.shopifyCollectionId ?? null;

  const collectionById = useMemo(() => {
    const map = new Map<string, ShopifyCollectionNode>();
    if (catalog.type === "success") {
      for (const collection of catalog.collections) {
        map.set(collection.id, collection);
      }
    }
    return map;
  }, [catalog]);

  const assignedCollection =
    assignedCollectionId && catalog.type === "success"
      ? collectionById.get(assignedCollectionId) ?? null
      : null;

  const filteredCollections: ShopifyCollectionNode[] =
    catalog.type === "success"
      ? catalog.collections.filter((collection) =>
          matchesSearch(collection.title, collectionSearch)
        )
      : [];

  return (
    <s-page heading="Configure collection">
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">Catalog assignment</p>
            <h1 className="builder-admin__title">{stepName}</h1>
            <p className="builder-admin__subtitle">
              Assign one Shopify collection to this step. The storefront will later
              load real Shopify products and variants from that collection.
            </p>
          </div>
          <div className="builder-admin__actions">
            <s-button href={`/app/builders/${builderId}/steps`}>Back to steps</s-button>
            <s-button href={`/app/specifications?builderId=${builderId}&stepId=${stepId}`}>
              Product specifications
            </s-button>
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
          <h2 className="builder-card__title">Current collection</h2>

          {!collectionAssignment ? (
            <div className="builder-empty-state">
              <strong>No collection assigned</strong>
              <p className="builder-card__text">
                Choose a Shopify collection below so customers have catalog items
                to select for this step.
              </p>
            </div>
          ) : assignedCollection ? (
            <div className="builder-assigned-collection">
              <CollectionImage collection={assignedCollection} />
              <div>
                <strong>{assignedCollection.title}</strong>
                <div className="builder-list__meta">
                  /{assignedCollection.handle} / {collectionProductCount(assignedCollection)}
                </div>
              </div>
              <removeFetcher.Form method="post">
                <input type="hidden" name="assignmentId" value={collectionAssignment.id} />
                <s-button variant="secondary" type="submit" disabled={isRemoving}>
                  Remove
                </s-button>
              </removeFetcher.Form>
            </div>
          ) : (
            <div className="builder-empty-state builder-empty-state--warning">
              <strong>Assigned collection is unavailable</strong>
              <p className="builder-card__text">
                The saved collection could not be loaded from Shopify. It may have
                been deleted or may no longer be accessible to this app.
              </p>
              <div className="builder-list__meta">{assignedCollectionId}</div>
              <removeFetcher.Form method="post" style={{ marginTop: "12px" }}>
                <input type="hidden" name="assignmentId" value={collectionAssignment.id} />
                <s-button variant="secondary" type="submit" disabled={isRemoving}>
                  Remove unavailable collection
                </s-button>
              </removeFetcher.Form>
            </div>
          )}
        </div>

        {catalog.type === "failure" ? (
          <div className="builder-card">
            <s-banner tone="critical">
              Unable to load Shopify collections: {catalog.message}
            </s-banner>
          </div>
        ) : (
          <div className="builder-card">
            <h2 className="builder-card__title">
              {collectionAssignment ? "Replace collection" : "Choose collection"}
            </h2>
            <p className="builder-card__text">
              Collection IDs are validated on the server against the authenticated
              Shopify store before they are saved.
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
                {filteredCollections.slice(0, 50).map((collection) => {
                  const isAssigned = collection.id === assignedCollectionId;
                  return (
                    <div className="builder-catalog-item builder-catalog-item--media" key={collection.id}>
                      <CollectionImage collection={collection} />
                      <div>
                        <strong>{collection.title}</strong>
                        <div className="builder-list__meta">
                          /{collection.handle} / {collectionProductCount(collection)}
                        </div>
                      </div>
                      <assignFetcher.Form method="post">
                        <input type="hidden" name="referenceType" value="collection" />
                        <input type="hidden" name="shopifyCollectionId" value={collection.id} />
                        <s-button
                          variant={isAssigned ? "secondary" : "primary"}
                          type="submit"
                          disabled={isAssigning || isAssigned}
                        >
                          {isAssigned ? "Assigned" : collectionAssignment ? "Replace" : "Assign"}
                        </s-button>
                      </assignFetcher.Form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </s-page>
  );
}
