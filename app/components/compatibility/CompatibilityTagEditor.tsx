import { useFetcher } from "react-router";
import type { CompatibilityTag } from "../../domains/compatibility/types";

interface CompatibilityTagEditorProps {
  tags: CompatibilityTag[];
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  } | null;
}

export function CompatibilityTagEditor({ tags, feedback }: CompatibilityTagEditorProps) {
  const fetcher = useFetcher();
  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  return (
    <s-section heading="Compatibility tags">
      {feedback && feedback.type !== "success" && (
        <div role="status" aria-live="polite">
          <s-banner tone={feedback.type === "validation" ? "warning" : "critical"}>
            {feedback.message}
          </s-banner>
        </div>
      )}

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="create-tag" />
        <s-text-field name="name" label="Tag name" required autocomplete="off" />
        <label>
          Role
          <select name="role" defaultValue="standard">
            <option value="standard">Standard (exact-match)</option>
            <option value="powerDraw">Power Draw (numeric, summed)</option>
            <option value="outputWattage">Output Wattage (numeric, PSU threshold)</option>
          </select>
        </label>
        <s-button variant="primary" type="submit" disabled={isSaving}>
          Add tag
        </s-button>
      </fetcher.Form>

      {tags.length === 0 ? (
        <s-paragraph>No compatibility tags defined for this step yet.</s-paragraph>
      ) : (
        <s-unordered-list>
          {tags.map((tag) => (
            <s-list-item key={tag.id}>
              {tag.name}
              <s-badge tone={tag.role === "standard" ? "info" : "success"}>{tag.role}</s-badge>
            </s-list-item>
          ))}
        </s-unordered-list>
      )}
    </s-section>
  );
}
