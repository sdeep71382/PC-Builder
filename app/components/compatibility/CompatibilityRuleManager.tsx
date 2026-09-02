import { useState } from "react";
import { Form, useFetcher } from "react-router";
import type { Builder } from "../../domains/builder-admin/types";
import type { CompatibilityRule } from "../../domains/compatibility/types";
import {
  COMPATIBILITY_RULE_OPERATORS,
  COMPATIBILITY_RULE_SEVERITIES,
} from "../../domains/compatibility/compatibility-rule-validation";

interface RuleFieldOption {
  key: string;
  label: string;
  dataType: string;
}

interface CompatibilityRuleManagerProps {
  builder: Builder;
  rules: CompatibilityRule[];
  fieldOptions: Record<string, RuleFieldOption[]>;
  feedback?: {
    type: "success" | "validation" | "authorization";
    message: string;
  } | null;
}

export function CompatibilityRuleManager({
  builder,
  rules,
  fieldOptions,
  feedback,
}: CompatibilityRuleManagerProps) {
  const fetcher = useFetcher<{ feedback?: CompatibilityRuleManagerProps["feedback"] }>();
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const categories = Object.keys(fieldOptions).sort();
  const currentFeedback = fetcher.data?.feedback ?? feedback ?? null;
  const editingRule = rules.find((rule) => rule.id === editingRuleId) ?? null;

  return (
    <s-page heading="Compatibility rules">
      <div className="builder-admin">
        <div className="builder-admin__header">
          <div>
            <p className="builder-admin__eyebrow">Deterministic rules</p>
            <h1 className="builder-admin__title">{builder.name}</h1>
            <p className="builder-admin__subtitle">
              Define explainable compatibility checks from structured product
              specifications. These rules do not call AI and do not run storefront filtering yet.
            </p>
          </div>
          <div className="builder-admin__actions">
            <s-button href={`/app/builders/${builder.id}`}>Back to builder</s-button>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="create-defaults" />
              <s-button type="submit">Add default PC rules</s-button>
            </fetcher.Form>
          </div>
        </div>

        {currentFeedback && currentFeedback.type !== "success" && (
          <div className="builder-card">
            <s-banner tone={currentFeedback.type === "validation" ? "warning" : "critical"}>
              {currentFeedback.message}
            </s-banner>
          </div>
        )}

        <RuleForm
          categories={categories}
          fieldOptions={fieldOptions}
          rule={editingRule}
          onCancel={() => setEditingRuleId(null)}
        />

        <div className="builder-card">
          <h2 className="builder-card__title">Rules</h2>
          {rules.length === 0 ? (
            <div className="builder-empty-state">
              <strong>No compatibility rules yet</strong>
              <span>
                Add default PC rules or create a custom rule from available specification fields.
              </span>
            </div>
          ) : (
            <div className="builder-step-list">
              {rules.map((rule) => (
                <div className="builder-step builder-step--compact" key={rule.id}>
                  <div>
                    <h3 className="builder-step__title">
                      {rule.sourceCategory}.{rule.sourceField} {rule.operator}{" "}
                      {rule.targetCategory}.{rule.targetField}
                    </h3>
                    <p className="builder-step__description">{rule.message}</p>
                    <div className="builder-list__meta">
                      {rule.severity} / {rule.enabled ? "enabled" : "disabled"}
                    </div>
                  </div>
                  <div className="builder-step__controls">
                    <button
                      className="builder-button-link"
                      type="button"
                      onClick={() => setEditingRuleId(rule.id)}
                    >
                      Edit
                    </button>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <input type="hidden" name="enabled" value={String(!rule.enabled)} />
                      <s-button type="submit">
                        {rule.enabled ? "Disable" : "Enable"}
                      </s-button>
                    </fetcher.Form>
                    <fetcher.Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="ruleId" value={rule.id} />
                      <s-button type="submit" variant="secondary">Delete</s-button>
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

function RuleForm({
  categories,
  fieldOptions,
  rule,
  onCancel,
}: {
  categories: string[];
  fieldOptions: Record<string, RuleFieldOption[]>;
  rule: CompatibilityRule | null;
  onCancel: () => void;
}) {
  const [sourceCategory, setSourceCategory] = useState(rule?.sourceCategory ?? categories[0] ?? "");
  const [targetCategory, setTargetCategory] = useState(rule?.targetCategory ?? categories[0] ?? "");
  const sourceFields = fieldOptions[sourceCategory] ?? [];
  const targetFields = fieldOptions[targetCategory] ?? [];

  return (
    <div className="builder-card">
      <h2 className="builder-card__title">{rule ? "Edit rule" : "Create rule"}</h2>
      {categories.length === 0 ? (
        <p className="builder-card__text">
          Add product specification definitions before creating compatibility rules.
        </p>
      ) : (
        <Form method="post" className="builder-form">
          <input type="hidden" name="intent" value={rule ? "update" : "create"} />
          {rule && <input type="hidden" name="ruleId" value={rule.id} />}

          <div className="builder-admin__grid builder-admin__grid--two" style={{ marginBottom: 0 }}>
            <div className="builder-field">
              <label htmlFor="sourceCategory">Source category</label>
              <select
                id="sourceCategory"
                name="sourceCategory"
                value={sourceCategory}
                onChange={(event) => setSourceCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="builder-field">
              <label htmlFor="sourceField">Source field</label>
              <select id="sourceField" name="sourceField" defaultValue={rule?.sourceField}>
                {sourceFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label} ({field.dataType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="builder-admin__grid builder-admin__grid--two" style={{ marginBottom: 0 }}>
            <div className="builder-field">
              <label htmlFor="operator">Operator</label>
              <select id="operator" name="operator" defaultValue={rule?.operator ?? "EQUALS"}>
                {COMPATIBILITY_RULE_OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>{operator}</option>
                ))}
              </select>
            </div>
            <div className="builder-field">
              <label htmlFor="severity">Severity</label>
              <select id="severity" name="severity" defaultValue={rule?.severity ?? "error"}>
                {COMPATIBILITY_RULE_SEVERITIES.map((severity) => (
                  <option key={severity} value={severity}>{severity}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="builder-admin__grid builder-admin__grid--two" style={{ marginBottom: 0 }}>
            <div className="builder-field">
              <label htmlFor="targetCategory">Target category</label>
              <select
                id="targetCategory"
                name="targetCategory"
                value={targetCategory}
                onChange={(event) => setTargetCategory(event.target.value)}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
            <div className="builder-field">
              <label htmlFor="targetField">Target field</label>
              <select id="targetField" name="targetField" defaultValue={rule?.targetField}>
                {targetFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label} ({field.dataType})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="builder-field">
            <label htmlFor="message">Incompatibility message</label>
            <input
              id="message"
              name="message"
              required
              defaultValue={rule?.message ?? ""}
              placeholder="Explain why this selection is incompatible."
            />
          </div>

          <label className="builder-check">
            <input type="checkbox" name="enabled" defaultChecked={rule?.enabled ?? true} /> Enabled
          </label>

          <div className="builder-admin__actions">
            <s-button variant="primary" type="submit">{rule ? "Save rule" : "Create rule"}</s-button>
            {rule && (
              <button className="builder-button-link" type="button" onClick={onCancel}>
                Cancel edit
              </button>
            )}
          </div>
        </Form>
      )}
    </div>
  );
}
