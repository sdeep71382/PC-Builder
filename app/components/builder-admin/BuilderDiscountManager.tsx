import { useEffect } from "react";
import { useFetcher } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import type { Builder, BuilderDiscount } from "../../domains/builder-admin/types";

interface BuilderDiscountManagerProps {
  builder: Builder;
  discount: BuilderDiscount | null;
  feedback?: {
    type: "success" | "validation" | "authorization";
    message: string;
  } | null;
}

export function BuilderDiscountManager({ builder, discount, feedback }: BuilderDiscountManagerProps) {
  const fetcher = useFetcher<{ feedback?: BuilderDiscountManagerProps["feedback"] }>();
  const shopify = useAppBridge();
  const currentFeedback = fetcher.data?.feedback ?? feedback ?? null;
  const isLoading = ["loading", "submitting"].includes(fetcher.state);

  useEffect(() => {
    if (currentFeedback?.type === "success") {
      shopify.toast.show(currentFeedback.message);
    }
  }, [currentFeedback, shopify]);

  return (
    <s-page heading="Spend discount">
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">Storefront incentive</p>
            <h1 className="builder-admin__title">{builder.name}</h1>
            <p className="builder-admin__subtitle">
              Reward shoppers who spend past a threshold with an automatic percentage discount
              on their build. A progress bar in the storefront widget shows how close they are.
            </p>
          </div>
          <div className="builder-admin__actions">
            <s-button href={`/app/builders/${builder.id}`}>Back to builder</s-button>
          </div>
        </div>

        {currentFeedback && currentFeedback.type !== "success" && (
          <div className="builder-card">
            <s-banner tone={currentFeedback.type === "validation" ? "warning" : "critical"}>
              {currentFeedback.message}
            </s-banner>
          </div>
        )}

        <div className="builder-card">
          <h2 className="builder-card__title">Discount rule</h2>
          <fetcher.Form method="post" className="builder-form">
            <div className="builder-check">
              <input
                id="discount-enabled"
                name="enabled"
                type="checkbox"
                defaultChecked={discount?.enabled ?? true}
              />
              <label htmlFor="discount-enabled">Enable this discount</label>
            </div>
            <div className="builder-admin__grid builder-admin__grid--two" style={{ marginBottom: 0 }}>
              <div className="builder-field">
                <label htmlFor="discount-threshold">Spend threshold *</label>
                <input
                  id="discount-threshold"
                  name="thresholdAmount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  defaultValue={discount?.thresholdAmount ?? ""}
                  required
                />
              </div>
              <div className="builder-field">
                <label htmlFor="discount-percentage">Discount percentage *</label>
                <input
                  id="discount-percentage"
                  name="discountPercentage"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  defaultValue={discount?.discountPercentage ?? ""}
                  required
                />
              </div>
            </div>
            <div className="builder-field">
              <label htmlFor="discount-label">Label (optional)</label>
              <input
                id="discount-label"
                name="label"
                defaultValue={discount?.label ?? ""}
                placeholder="e.g. Free upgrade bundle"
                autoComplete="off"
              />
            </div>
            <s-button variant="primary" type="submit" disabled={isLoading}>
              Save discount
            </s-button>
          </fetcher.Form>
        </div>

        <div className="builder-card">
          <h2 className="builder-card__title">How it applies</h2>
          <p className="builder-card__text">
            Once a shopper&apos;s build total reaches the spend threshold, the storefront widget
            unlocks the discount percentage and shows it applied when the build is added to cart.
            The discount is applied to the bundled build price at checkout.
          </p>
        </div>
      </div>
    </s-page>
  );
}
