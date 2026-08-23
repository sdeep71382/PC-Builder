import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { Builder, BuilderStatus } from "../../domains/builder-admin/types";

interface BuilderFormProps {
  builder?: Builder;
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  } | null;
}

export function BuilderForm({ builder, feedback }: BuilderFormProps) {
  const fetcher = useFetcher<{
    feedback?: {
      type: "success" | "validation" | "authorization" | "stale" | "temporary";
      message: string;
    };
  }>();
  const shopify = useAppBridge();
  const currentFeedback = fetcher.data?.feedback ?? feedback ?? null;
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (currentFeedback?.type === "success") {
      shopify.toast.show(currentFeedback.message);
    }
  }, [currentFeedback, shopify]);

  const isEditing = Boolean(builder);
  const status = builder?.status as BuilderStatus | undefined;

  return (
    <s-page heading={isEditing ? "Edit builder" : "Create builder"}>
      {isEditing && status && (
        <s-section heading="Status">
          <s-badge tone={status === "published" ? "success" : status === "archived" ? "info" : "auto"}>
            {status}
          </s-badge>
        </s-section>
      )}

      <fetcher.Form method="post">
        <s-section heading="Details">
          <s-text-field
            name="name"
            label="Name"
            value={builder?.name ?? ""}
            required
            autocomplete="off"
          />
          <s-text-area
            name="description"
            label="Description"
            value={builder?.description ?? ""}
          />
          {builder && <input type="hidden" name="builderId" value={builder.id} />}
          <input type="hidden" name="version" value={builder?.version ?? 1} />
          <input type="hidden" name="statusAction" value="" />

          <s-button variant="primary" type="submit" disabled={isLoading}>
            {isEditing ? "Save" : "Create"}
          </s-button>
        </s-section>
      </fetcher.Form>

      {isEditing && (
        <s-section heading="Lifecycle">
          {status === "draft" && (
            <fetcher.Form method="post">
              <input type="hidden" name="statusAction" value="publish" />
              <input type="hidden" name="version" value={builder?.version ?? 1} />
              <s-button variant="primary" type="submit" disabled={isLoading}>
                Publish
              </s-button>
            </fetcher.Form>
          )}
          {status === "published" && (
            <fetcher.Form method="post">
              <input type="hidden" name="statusAction" value="archive" />
              <input type="hidden" name="version" value={builder?.version ?? 1} />
              <s-button variant="secondary" type="submit" disabled={isLoading}>
                Archive
              </s-button>
            </fetcher.Form>
          )}
          {status === "archived" && (
            <fetcher.Form method="post">
              <input type="hidden" name="statusAction" value="publish" />
              <input type="hidden" name="version" value={builder?.version ?? 1} />
              <s-button variant="primary" type="submit" disabled={isLoading}>
                Republish
              </s-button>
            </fetcher.Form>
          )}
        </s-section>
      )}

      {currentFeedback && currentFeedback.type !== "success" && (
        <s-section>
          <div role="status" aria-live="polite">
            <s-banner tone={currentFeedback.type === "validation" ? "warning" : "critical"}>
              {currentFeedback.message}
            </s-banner>
          </div>
        </s-section>
      )}
    </s-page>
  );
}
