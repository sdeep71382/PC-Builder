import { useState } from "react";
import { Link, useFetcher } from "react-router";
import type {
  ProductSpecification,
  ShopifyCollectionProduct,
  SpecificationDefinition,
} from "../../domains/product-specifications/types";
import { formatSpecificationValue } from "../../domains/product-specifications/product-specification-validation";
import type { Builder, BuilderStep, StepCatalogAssignment } from "../../domains/builder-admin/types";

interface SpecificationWorkspaceProps {
  builders: Array<Builder & { steps: BuilderStep[] }>;
  selectedBuilderId: string | null;
  selectedStepId: string | null;
  selectedProductId: string | null;
  selectedVariantId: string | null;
  selectedStep: BuilderStep | null;
  assignment: StepCatalogAssignment | null;
  definitions: SpecificationDefinition[];
  products: ShopifyCollectionProduct[];
  values: ProductSpecification[];
  completion: Record<string, { completed: number; requiredMissing: number; total: number }>;
  lookupError: string | null;
  feedback?: {
    type: "success" | "validation" | "authorization" | "temporary";
    message: string;
  } | null;
}

export function SpecificationWorkspace({
  builders,
  selectedBuilderId,
  selectedStepId,
  selectedProductId,
  selectedVariantId,
  selectedStep,
  assignment,
  definitions,
  products,
  values,
  completion,
  lookupError,
  feedback,
}: SpecificationWorkspaceProps) {
  const fetcher = useFetcher();
  const [builderPickerValue, setBuilderPickerValue] = useState(selectedBuilderId ?? "");
  const [stepPickerValue, setStepPickerValue] = useState(selectedStepId ?? "");
  const selectedBuilder =
    builders.find((builder) => builder.id === selectedBuilderId) ?? null;
  const pickerBuilder =
    builders.find((builder) => builder.id === builderPickerValue) ?? null;
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? null;
  const selectedVariant =
    selectedProduct?.variants.find((variant) => variant.id === selectedVariantId) ?? null;
  const valueByDefinition = new Map(
    values.map((value) => [value.specificationDefinitionId, value])
  );

  return (
    <s-page heading="Product specifications">
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">Product metadata</p>
            <h1 className="builder-admin__title">Add technical specifications</h1>
            <p className="builder-admin__subtitle">
              Choose a builder step, review products from its assigned Shopify
              collection, then enter structured values for each selectable variant.
            </p>
          </div>
          <div className="builder-admin__actions">
            <s-button href="/app/builders">Builders</s-button>
          </div>
        </div>

        {feedback && feedback.type !== "success" && (
          <div className="builder-card">
            <s-banner tone={feedback.type === "validation" ? "warning" : "critical"}>
              {feedback.message}
            </s-banner>
          </div>
        )}

        <div className="builder-card">
          <h2 className="builder-card__title">Choose catalog step</h2>
          <form method="get" className="builder-form">
            <div className="builder-admin__grid builder-admin__grid--two" style={{ marginBottom: 0 }}>
              <div className="builder-field">
                <label htmlFor="builderId">Builder</label>
                <select
                  id="builderId"
                  name="builderId"
                  value={builderPickerValue}
                  onChange={(event) => {
                    setBuilderPickerValue(event.target.value);
                    setStepPickerValue("");
                  }}
                >
                  <option value="">Select a builder</option>
                  {builders.map((builder) => (
                    <option key={builder.id} value={builder.id}>
                      {builder.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="builder-field">
                <label htmlFor="stepId">Step</label>
                <select
                  id="stepId"
                  name="stepId"
                  value={stepPickerValue}
                  onChange={(event) => setStepPickerValue(event.target.value)}
                  disabled={!pickerBuilder}
                >
                  <option value="">Select a step</option>
                  {pickerBuilder
                    ?.steps.map((step) => (
                      <option key={step.id} value={step.id}>
                        {step.position}. {step.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="builder-admin__actions">
              <s-button type="submit" variant="primary">Load products</s-button>
              {selectedBuilderId && (
              <Link
                className="builder-button-link"
                to={`/app/builders/${selectedBuilderId}/steps`}
              >
                Add or edit steps
              </Link>
              )}
            </div>
          </form>
        </div>

        {selectedBuilder && !selectedStep && (
          <div className="builder-card">
            <div className="builder-step__header">
              <div>
                <h2 className="builder-card__title">Steps in {selectedBuilder.name}</h2>
                <p className="builder-card__text">
                  Open a step to assign its Shopify collection, then return here
                  to enter product and variant specifications.
                </p>
              </div>
              <Link
                className="builder-button-link builder-button-link--primary"
                to={`/app/builders/${selectedBuilder.id}/steps`}
              >
                Add or edit steps
              </Link>
            </div>
            {selectedBuilder.steps.length === 0 ? (
              <div className="builder-empty-state">
                <strong>No steps yet</strong>
                <span>Create steps such as Processor, Motherboard, Memory, or any custom choice.</span>
              </div>
            ) : (
              <div className="builder-step-list" style={{ marginTop: "16px" }}>
                {selectedBuilder.steps.map((step) => (
                  <div className="builder-step builder-step--compact" key={step.id}>
                    <div>
                      <h3 className="builder-step__title">
                        {step.position}. {step.name}
                      </h3>
                      <p className="builder-step__description">
                        {step.enabled ? "Enabled" : "Disabled"} / {step.required ? "Required" : "Optional"}
                      </p>
                    </div>
                    <div className="builder-step__controls">
                      <Link
                        className="builder-button-link"
                        to={`/app/builders/${selectedBuilder.id}/steps/${step.id}/catalog`}
                      >
                        Configure collection
                      </Link>
                      <Link
                        className="builder-button-link builder-button-link--primary"
                        to={`/app/specifications?builderId=${selectedBuilder.id}&stepId=${step.id}`}
                      >
                        Open specifications
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedStep && !assignment && (
          <div className="builder-empty-state builder-empty-state--warning">
            <strong>No collection assigned</strong>
            <span>
              Assign a Shopify collection to {selectedStep.name} before entering specifications.
            </span>
            <div className="builder-admin__actions">
              <Link
                className="builder-button-link builder-button-link--primary"
                to={`/app/builders/${selectedStep.builderId}/steps/${selectedStep.id}/catalog`}
              >
                Assign collection
              </Link>
              <Link
                className="builder-button-link"
                to={`/app/builders/${selectedStep.builderId}/steps`}
              >
                Add or edit steps
              </Link>
            </div>
          </div>
        )}

        {lookupError && (
          <div className="builder-empty-state builder-empty-state--warning">
            <strong>Shopify catalog unavailable</strong>
            <span>{lookupError}</span>
          </div>
        )}

        {assignment && (
          <div className="builder-admin__grid builder-admin__grid--two builder-admin__grid--top">
            <div className="builder-card">
              <h2 className="builder-card__title">Products in assigned collection</h2>
              {products.length === 0 ? (
                <p className="builder-card__text">
                  This Shopify collection has no products yet.
                </p>
              ) : (
                <div className="builder-spec-product-list">
                  {products.map((product) => (
                    <div className="builder-spec-product" key={product.id}>
                      {product.featuredImage ? (
                        <img
                          className="builder-collection-image"
                          src={product.featuredImage.url}
                          alt={product.featuredImage.altText ?? ""}
                        />
                      ) : (
                        <div className="builder-collection-image builder-collection-image--empty" />
                      )}
                      <div>
                        <strong>{product.title}</strong>
                        <p className="builder-card__text">{product.handle}</p>
                        <div className="builder-spec-variants">
                          {product.variants.map((variant) => {
                            const state = completion[variant.id];
                            const label = state
                              ? `${state.completed}/${state.total} saved${
                                  state.requiredMissing > 0
                                    ? `, ${state.requiredMissing} required missing`
                                    : ""
                                }`
                              : "No definitions";
                            return (
                              <Link
                                className="builder-button-link"
                                key={variant.id}
                                to={`/app/specifications?builderId=${encodeURIComponent(
                                  selectedBuilderId ?? ""
                                )}&stepId=${encodeURIComponent(selectedStepId ?? "")}&productId=${encodeURIComponent(
                                  product.id
                                )}&variantId=${encodeURIComponent(variant.id)}`}
                              >
                                {variant.title === "Default Title" ? "Open variant" : variant.title} - {label}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="builder-card">
              <h2 className="builder-card__title">Specifications</h2>
              {!selectedProduct || !selectedVariant ? (
                <p className="builder-card__text">
                  Open a product variant to enter its technical specifications.
                </p>
              ) : definitions.length === 0 ? (
                <p className="builder-card__text">
                  No specification definitions exist for this step category yet.
                </p>
              ) : (
                <fetcher.Form method="post" className="builder-form">
                  <input type="hidden" name="shopifyProductId" value={selectedProduct.id} />
                  <input type="hidden" name="shopifyVariantId" value={selectedVariant.id} />
                  <p className="builder-card__text">
                    {selectedProduct.title} / {selectedVariant.title}
                  </p>
                  {definitions.map((definition) => {
                    const existing = valueByDefinition.get(definition.id);
                    const fieldName = `spec_${definition.id}`;
                    return (
                      <div className="builder-field" key={definition.id}>
                        <label htmlFor={fieldName}>
                          {definition.label}
                          {definition.required ? " *" : ""}
                          {definition.unit ? ` (${definition.unit})` : ""}
                        </label>
                        {definition.dataType === "BOOLEAN" ? (
                          <select
                            id={fieldName}
                            name={fieldName}
                            defaultValue={formatSpecificationValue(existing?.value)}
                          >
                            <option value="">Not set</option>
                            <option value="true">Yes</option>
                            <option value="false">No</option>
                          </select>
                        ) : (
                          <input
                            id={fieldName}
                            name={fieldName}
                            inputMode={definition.dataType === "NUMBER" ? "decimal" : "text"}
                            defaultValue={formatSpecificationValue(existing?.value)}
                            placeholder={
                              definition.dataType === "STRING_ARRAY"
                                ? "Comma-separated values"
                                : undefined
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                  <s-button variant="primary" type="submit">Save specifications</s-button>
                </fetcher.Form>
              )}
            </div>
          </div>
        )}
      </div>
    </s-page>
  );
}
