import type { Builder } from "../../domains/builder-admin/types.ts";

interface BuilderListProps {
  builders: Builder[];
}

function formatUpdatedAt(updatedAt: Date | string): string {
  const date = updatedAt instanceof Date ? updatedAt : new Date(updatedAt);
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function BuilderList({ builders }: BuilderListProps) {
  return (
    <s-page heading="Builders">
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">Builder library</p>
            <h1 className="builder-admin__title">Manage customer configuration flows</h1>
            <p className="builder-admin__subtitle">
              Create builders, define the order of choices, and connect each step to
              real Shopify collections.
            </p>
          </div>
          <div className="builder-admin__actions">
          <s-button variant="primary" href="/app/builders/new">
            Create builder
          </s-button>
          </div>
        </div>

        {builders.length === 0 ? (
          <div className="builder-card">
            <h2 className="builder-card__title">No builders yet</h2>
            <p className="builder-card__text">
              Start with one builder, add ordered steps, then assign Shopify
              collections to each step.
            </p>
          </div>
        ) : (
          <div className="builder-card">
            <h2 className="builder-card__title">Your builders</h2>
            <div className="builder-list">
            {builders.map((builder) => (
              <div
                key={builder.id}
                className="builder-list__row"
              >
                <div>
                  <s-link href={`/app/builders/${builder.id}`}>
                    <span className="builder-list__name">
                      {builder.name || "Untitled builder"}
                    </span>
                  </s-link>
                  <div className="builder-list__meta">
                    Updated {formatUpdatedAt(builder.updatedAt)}
                  </div>
                </div>
                <s-badge tone={builder.status === "published" ? "success" : "auto"}>
                  {builder.status}
                </s-badge>
                <s-button href={`/app/builders/${builder.id}`}>Open</s-button>
              </div>
            ))}
            </div>
          </div>
        )}
      </div>
    </s-page>
  );
}
