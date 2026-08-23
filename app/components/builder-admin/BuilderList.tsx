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
      {builders.length === 0 ? (
        <s-section heading="No builders yet">
          <s-paragraph>
            Create your first builder to start configuring a PC-building experience.
          </s-paragraph>
          <s-button variant="primary" href="/app/builders/new">
            Create builder
          </s-button>
        </s-section>
      ) : (
        <s-section heading="Your builders">
          <s-button variant="primary" href="/app/builders/new">
            Create builder
          </s-button>
          <s-stack direction="block" gap="base">
            {builders.map((builder) => (
              <s-box
                key={builder.id}
                padding="base"
                borderWidth="base"
                borderRadius="base"
              >
                <s-stack direction="inline" gap="base" justifyContent="space-between">
                <s-link href={`/app/builders/${builder.id}`}>
                  {builder.name || "Untitled builder"}
                </s-link>
                <s-text tone="neutral">
                  Updated {formatUpdatedAt(builder.updatedAt)}
                </s-text>
                <s-badge tone={builder.status === "published" ? "success" : "auto"}>
                  {builder.status}
                </s-badge>
                </s-stack>
              </s-box>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}
