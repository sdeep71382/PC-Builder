import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { BuilderStatus, BuilderWithSteps } from "../../domains/builder-admin/types";

interface BuilderFormProps {
  builder?: BuilderWithSteps;
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
  const enabledStepCount = builder?.steps.filter((step) => step.enabled).length ?? 0;
  const totalStepCount = builder?.steps.length ?? 0;
  const canPublish = enabledStepCount > 0;

  return (
    <s-page heading={isEditing ? "Edit builder" : "Create builder"}>
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">
              {isEditing ? "Builder setup" : "New builder"}
            </p>
            <h1 className="builder-admin__title">
              {isEditing ? builder?.name || "Untitled builder" : "Create a product builder"}
            </h1>
            <p className="builder-admin__subtitle">
              Name the experience, define the steps customers will follow, then
              assign Shopify collections to each step.
            </p>
          </div>
          <div className="builder-admin__actions">
            {isEditing && <s-button href="/app/builders">Back to builders</s-button>}
            {isEditing && (
              <s-button variant="primary" href={`/app/builders/${builder?.id}/steps`}>
                Manage steps
              </s-button>
            )}
          </div>
        </div>

        {isEditing && status && (
          <div className="builder-admin__grid builder-admin__grid--equal">
            <div className="builder-card builder-card--metric">
              <p className="builder-card__title">Status</p>
              <s-badge tone={status === "published" ? "success" : status === "archived" ? "info" : "auto"}>
                {status}
              </s-badge>
            </div>
            <div className="builder-card builder-card--metric">
              <p className="builder-card__title">Steps</p>
              <div className="builder-stat">{totalStepCount}</div>
              <p className="builder-card__text">{enabledStepCount} enabled</p>
            </div>
            <div className="builder-card builder-card--metric">
              <p className="builder-card__title">Collection assignment</p>
              <p className="builder-card__text">
                Open steps to connect Shopify collections for each choice.
              </p>
            </div>
          </div>
        )}

        <div className="builder-card">
          <h2 className="builder-card__title">Builder details</h2>
          <fetcher.Form method="post" className="builder-form">
            <div className="builder-field">
              <label htmlFor="builder-name">Name *</label>
              <input
                id="builder-name"
                name="name"
                defaultValue={builder?.name ?? ""}
                required
                autoComplete="off"
              />
            </div>
            <div className="builder-field">
              <label htmlFor="builder-description">Description</label>
              <textarea
                id="builder-description"
                name="description"
                defaultValue={builder?.description ?? ""}
              />
            </div>
          {builder && <input type="hidden" name="builderId" value={builder.id} />}
          <input type="hidden" name="version" value={builder?.version ?? 1} />
          <input type="hidden" name="statusAction" value="" />

          <s-button variant="primary" type="submit" disabled={isLoading}>
            {isEditing ? "Save" : "Create"}
          </s-button>
          </fetcher.Form>
        </div>

      {isEditing && (
        <div className="builder-card">
          <h2 className="builder-card__title">Publish controls</h2>
          <p className="builder-card__text">
            {canPublish
              ? `${enabledStepCount} enabled step${enabledStepCount === 1 ? "" : "s"} ready for publishing.`
              : "Add at least one enabled step before publishing this builder."}
          </p>
          <div className="builder-admin__actions" style={{ marginTop: "14px" }}>
            <s-button href={`/app/builders/${builder?.id}/steps`}>
              Manage steps
            </s-button>
          {status === "draft" && (
            <fetcher.Form method="post">
              <input type="hidden" name="statusAction" value="publish" />
              <input type="hidden" name="version" value={builder?.version ?? 1} />
              <s-button variant="primary" type="submit" disabled={isLoading || !canPublish}>
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
              <s-button variant="primary" type="submit" disabled={isLoading || !canPublish}>
                Republish
              </s-button>
            </fetcher.Form>
          )}
          </div>
        </div>
      )}

      {currentFeedback && currentFeedback.type !== "success" && (
        <div className="builder-card">
          <div role="status" aria-live="polite">
            <s-banner tone={currentFeedback.type === "validation" ? "warning" : "critical"}>
              {currentFeedback.message}
            </s-banner>
          </div>
        </div>
      )}
      </div>
    </s-page>
  );
}
