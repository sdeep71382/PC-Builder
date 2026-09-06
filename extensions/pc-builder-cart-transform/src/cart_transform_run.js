// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 */

/**
 * @type {CartTransformRunResult}
 */
const NO_CHANGES = {
  operations: [],
};

/**
 * @param {CartTransformRunInput} input
 * @returns {CartTransformRunResult}
 */
export function cartTransformRun(input) {
  const groups = new Map();
  let skippedLines = 0;
  for (const line of input.cart.lines) {
    const sessionId = line.session?.value || null;
    const parentVariantId = line.parent?.value || null;
    if (!sessionId || !parentVariantId || line.merchandise?.__typename !== "ProductVariant") {
      skippedLines += 1;
      continue;
    }
    const groupKey = `${sessionId}:${parentVariantId}`;
    const group = groups.get(groupKey) || { sessionId, parentVariantId, cartLines: [], components: [] };
    group.cartLines.push({ cartLineId: line.id, quantity: line.quantity });
    group.components.push({
      name: line.component?.value || "Component",
      title: line.merchandise.product?.title || line.merchandise.title || "Selected component",
    });
    groups.set(groupKey, group);
  }

  const operations = [];
  for (const group of groups.values()) {
    if (group.cartLines.length >= 2) {
      operations.push({
        linesMerge: {
          cartLines: group.cartLines,
          parentVariantId: group.parentVariantId,
          attributes: group.components.map((component) => ({
            key: component.name,
            value: component.title,
          })),
        },
      });
    }
  }
  console.log("PC Builder Cart Transform", JSON.stringify({
    lineCount: input.cart.lines.length,
    skippedLines,
    groupCount: groups.size,
    groups: [...groups.values()].map((group) => ({
      sessionId: group.sessionId,
      parentVariantId: group.parentVariantId,
      componentLineCount: group.cartLines.length,
    })),
    mergeCount: operations.length,
  }));
  return operations.length ? { operations } : NO_CHANGES;
};
