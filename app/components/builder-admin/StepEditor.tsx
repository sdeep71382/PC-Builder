import type { BuilderStep } from "../../domains/builder-admin/types";
import { useFetcher } from "react-router";

interface StepEditorProps {
  steps: BuilderStep[];
  builderId: string;
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  } | null;
}

export function StepEditor({ steps, builderId, feedback }: StepEditorProps) {
  const fetcher = useFetcher<{
    feedback?: {
      type: "success" | "validation" | "authorization" | "stale" | "temporary";
      message: string;
    };
  }>();
  const currentFeedback = fetcher.data?.feedback ?? feedback ?? null;
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  return (
    <s-page heading="Steps">
      <s-section heading="Add step">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="create" />
          <s-text-field
            name="name"
            label="Step name"
            required
            autocomplete="off"
          />
          <label>
            <input type="checkbox" name="enabled" defaultChecked /> Enabled
          </label>
          <label>
            <input type="checkbox" name="required" defaultChecked /> Required
          </label>
          <s-button variant="primary" type="submit" disabled={isLoading}>
            Add step
          </s-button>
        </fetcher.Form>
      </s-section>

      {currentFeedback && currentFeedback.type !== "success" && (
        <s-section>
          <div role="status" aria-live="polite">
            <s-banner tone={currentFeedback.type === "validation" ? "warning" : "critical"}>
              {currentFeedback.message}
            </s-banner>
          </div>
        </s-section>
      )}

      {steps.length === 0 ? (
        <s-section heading="No steps yet">
          <s-paragraph>
            Add steps to define the flow customers will follow when selecting products.
          </s-paragraph>
        </s-section>
      ) : (
        <s-section heading="Your steps">
          {steps.map((step, index) => (
            <s-section key={step.id} heading={`${index + 1}. ${step.name || "Untitled step"}`}>
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="update" />
                <input type="hidden" name="stepId" value={step.id} />
                <input type="hidden" name="version" value={step.version} />
                <s-text-field
                  name="name"
                  label="Step name"
                  value={step.name}
                  required
                  autocomplete="off"
                />
                <label>
                  <input type="checkbox" name="enabled" defaultChecked={step.enabled} /> Enabled
                </label>
                <label>
                  <input type="checkbox" name="required" defaultChecked={step.required} /> Required
                </label>
                <s-button type="submit" disabled={isLoading}>Save step</s-button>
              </fetcher.Form>

              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="move-up" />
                <input type="hidden" name="stepId" value={step.id} />
                <s-button type="submit" disabled={index === 0 || isLoading}>Move up</s-button>
              </fetcher.Form>

              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="move-down" />
                <input type="hidden" name="stepId" value={step.id} />
                <s-button type="submit" disabled={index === steps.length - 1 || isLoading}>Move down</s-button>
              </fetcher.Form>

              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="stepId" value={step.id} />
                <s-button type="submit" variant="secondary" disabled={isLoading}>Delete step</s-button>
              </fetcher.Form>

              <s-link href={`/app/builders/${builderId}/steps/${step.id}/catalog`}>
                Catalog assignments
              </s-link>
            </s-section>
          ))}
        </s-section>
      )}
    </s-page>
  );
}
