// @ts-check

/**
 * Groups cart lines sharing a `_buildId` attribute and merges each group of
 * two or more lines into a single checkout-facing line. Lines are otherwise
 * left untouched. See specs/002-storefront-compatibility-widget/contracts/
 * cart-transform-function.md for the full contract this implements.
 *
 * Kept dependency-free (no `generated/api` import) so it can be unit tested
 * without a live Shopify CLI codegen step.
 *
 * @param {import("../generated/api").RunInput} input
 * @returns {import("../generated/api").FunctionRunResult}
 */
export function mergeBuildLines(input) {
  const groups = new Map();

  for (const line of input.cart.lines) {
    const buildId = line.attribute?.value;
    if (!buildId) {
      continue;
    }
    const group = groups.get(buildId) ?? [];
    group.push(line);
    groups.set(buildId, group);
  }

  const operations = [];

  for (const groupLines of groups.values()) {
    if (groupLines.length < 2) {
      // A single component with a _buildId has nothing to merge into.
      continue;
    }

    const parentLine = groupLines[0];
    if (parentLine.merchandise.__typename !== "ProductVariant") {
      // Fail safe: leave the group unmerged rather than error the cart.
      continue;
    }

    operations.push({
      merge: {
        cartLines: groupLines.map((line) => ({
          cartLineId: line.id,
          quantity: line.quantity,
        })),
        parentVariantId: parentLine.merchandise.id,
        title: parentLine.buildTitle?.value ?? "Custom PC Build",
      },
    });
  }

  return { operations };
}
