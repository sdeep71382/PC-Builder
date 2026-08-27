import { useFetcher } from "react-router";
import type { StepCatalogAssignment } from "../../domains/builder-admin/types";
import type { CompatibilityTag, TagValueAssignment } from "../../domains/compatibility/types";

interface TagValueAssignmentGridProps {
  assignments: StepCatalogAssignment[];
  tags: CompatibilityTag[];
  values: TagValueAssignment[];
}

function assignmentLabel(assignment: StepCatalogAssignment): string {
  return assignment.referenceType === "product"
    ? `Product: ${assignment.shopifyProductId}`
    : `Variant: ${assignment.shopifyVariantId}`;
}

export function TagValueAssignmentGrid({ assignments, tags, values }: TagValueAssignmentGridProps) {
  const fetcher = useFetcher();
  const isSaving =
    ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  function valueFor(tagId: string, assignmentId: string): string {
    const match = values.find((v) => v.tagId === tagId && v.assignmentId === assignmentId);
    return match?.value ?? "";
  }

  if (tags.length === 0 || assignments.length === 0) {
    return (
      <s-section heading="Tag values">
        <s-paragraph>
          Add a compatibility tag and assign products or variants to this step before
          setting values.
        </s-paragraph>
      </s-section>
    );
  }

  return (
    <s-section heading="Tag values">
      <table>
        <thead>
          <tr>
            <th scope="col">Item</th>
            {tags.map((tag) => (
              <th scope="col" key={tag.id}>
                {tag.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {assignments.map((assignment) => (
            <tr key={assignment.id}>
              <th scope="row">{assignmentLabel(assignment)}</th>
              {tags.map((tag) => (
                <td key={tag.id}>
                  <fetcher.Form method="post">
                    <input type="hidden" name="intent" value="set-value" />
                    <input type="hidden" name="tagId" value={tag.id} />
                    <input type="hidden" name="assignmentId" value={assignment.id} />
                    <input
                      type="text"
                      name="value"
                      defaultValue={valueFor(tag.id, assignment.id)}
                      aria-label={`${tag.name} value for ${assignmentLabel(assignment)}`}
                    />
                    <s-button type="submit" disabled={isSaving}>
                      Save
                    </s-button>
                  </fetcher.Form>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </s-section>
  );
}
