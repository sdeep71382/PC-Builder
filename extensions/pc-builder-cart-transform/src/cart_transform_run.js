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
    if (!parentVariantId || line.merchandise?.__typename !== "ProductVariant") {
      skippedLines += 1;
      continue;
    }
    const group = groups.get(parentVariantId) || { parentVariantId, sessionIds: new Set(), cartLines: [], components: [] };
    if (sessionId) group.sessionIds.add(sessionId);
    group.cartLines.push({ cartLineId: line.id, quantity: line.quantity });
    group.components.push({
      name: line.component?.value || "Component",
      title: line.merchandise.product?.title || line.merchandise.title || "Selected component",
    });
    groups.set(parentVariantId, group);
  }

  const operations = [];
  for (const group of groups.values()) {
    if (group.cartLines.length >= 2) {
      operations.push({
        linesMerge: {
          cartLines: group.cartLines,
          parentVariantId: group.parentVariantId,
          title: "PC Builder Bundle",
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
      parentVariantId: group.parentVariantId,
      sessionCount: group.sessionIds.size,
      componentLineCount: group.cartLines.length,
    })),
    mergeCount: operations.length,
  }));
  return operations.length ? { operations } : NO_CHANGES;
};
