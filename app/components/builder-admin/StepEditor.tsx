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
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">Builder steps</p>
            <h1 className="builder-admin__title">Define the customer choices</h1>
            <p className="builder-admin__subtitle">
              Steps are the ordered decisions a customer makes in the builder.
              Each step can be required or optional, and each step gets its own
              Shopify collection assignments.
            </p>
          </div>
          <div className="builder-admin__actions">
            <s-button href={`/app/builders/${builderId}`}>Back to builder</s-button>
          </div>
        </div>

      {currentFeedback && currentFeedback.type !== "success" && (
        <div className="builder-card">
          <div role="status" aria-live="polite">
            <s-banner tone={currentFeedback.type === "validation" ? "warning" : "critical"}>
              {currentFeedback.message}
            </s-banner>
          </div>
        </div>
      )}

        <div className="builder-card">
          <h2 className="builder-card__title">Add a step</h2>
          <p className="builder-card__text">
            Use a merchant-friendly label like Processor, Warranty, Monitor, or
            Installation service. The label controls how this choice is described later.
          </p>
          <fetcher.Form method="post" className="builder-form" style={{ marginTop: "14px" }}>
            <input type="hidden" name="intent" value="create" />
            <div className="builder-field">
              <label htmlFor="new-step-name">Step name *</label>
              <input id="new-step-name" name="name" required autoComplete="off" />
            </div>
            <div className="builder-checks">
              <label className="builder-check">
                <input type="checkbox" name="enabled" defaultChecked /> Enabled
              </label>
              <label className="builder-check">
                <input type="checkbox" name="required" defaultChecked /> Required
              </label>
              <s-button variant="primary" type="submit" disabled={isLoading}>
                Add step
              </s-button>
            </div>
          </fetcher.Form>
          {steps.length === 0 && (
            <fetcher.Form method="post" style={{ marginTop: "10px" }}>
              <input type="hidden" name="intent" value="create-defaults" />
              <s-button type="submit" disabled={isLoading}>
                Add default PC steps
              </s-button>
            </fetcher.Form>
          )}
        </div>

        <div className="builder-card">
          <h2 className="builder-card__title">Your steps</h2>
          {steps.length === 0 ? (
            <p className="builder-card__text">
              No steps yet. Add a custom step or use the default PC steps to start faster.
            </p>
          ) : (
            <div className="builder-step-list">
              {steps.map((step, index) => (
                <div className="builder-step" key={step.id}>
                  <div className="builder-step__header">
                    <div>
                      <h3 className="builder-step__title">
                        {index + 1}. {step.name || "Untitled step"}
                      </h3>
                      <p className="builder-step__description">
                        {step.enabled ? "Enabled" : "Disabled"} / {step.required ? "Required" : "Optional"}
                      </p>
                    </div>
                    <s-button variant="primary" href={`/app/builders/${builderId}/steps/${step.id}/catalog`}>
                      Configure collections
                    </s-button>
                  </div>

                  <fetcher.Form method="post" className="builder-form">
                    <input type="hidden" name="intent" value="update" />
                    <input type="hidden" name="stepId" value={step.id} />
                    <input type="hidden" name="version" value={step.version} />
                    <div className="builder-field">
                      <label htmlFor={`step-name-${step.id}`}>Step name *</label>
                      <input
                        id={`step-name-${step.id}`}
                        name="name"
                        defaultValue={step.name}
                        required
                        autoComplete="off"
                      />
                    </div>
                    <div className="builder-checks">
                      <label className="builder-check">
                        <input type="checkbox" name="enabled" defaultChecked={step.enabled} /> Enabled
                      </label>
                      <label className="builder-check">
                        <input type="checkbox" name="required" defaultChecked={step.required} /> Required
                      </label>
                      <s-button type="submit" disabled={isLoading}>Save step</s-button>
                    </div>
                  </fetcher.Form>

                  <div className="builder-step__controls">
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </s-page>
  );
}
