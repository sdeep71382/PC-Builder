import type {
  StorefrontBuildSelection,
  StorefrontBuildState,
  StorefrontBuilderStepDto,
  StorefrontProductOptionDto,
} from "./types";

export function createBuildState(builderId: string, sessionId = "local"): StorefrontBuildState {
  return {
    builderId,
    sessionId,
    currentStep: 0,
    selections: {},
    skippedStepIds: [],
  };
}

export function selectStepProduct(
  state: StorefrontBuildState,
  stepPublicId: string,
  product: StorefrontProductOptionDto
): StorefrontBuildState {
  const selection: StorefrontBuildSelection = {
    productId: product.productId,
    variantId: product.variantId,
    price: product.price,
    specs: product.specifications,
  };
  return {
    ...state,
    selections: { ...state.selections, [stepPublicId]: selection },
    skippedStepIds: state.skippedStepIds.filter((id) => id !== stepPublicId),
  };
}

export function goBack(state: StorefrontBuildState): StorefrontBuildState {
  return { ...state, currentStep: Math.max(0, state.currentStep - 1) };
}

export function goNext(
  state: StorefrontBuildState,
  steps: StorefrontBuilderStepDto[]
): StorefrontBuildState {
  const current = steps[state.currentStep];
  if (!current || !canProgressFromStep(state, current)) {
    return state;
  }
  return { ...state, currentStep: Math.min(steps.length - 1, state.currentStep + 1) };
}

export function skipOptionalStep(
  state: StorefrontBuildState,
  step: StorefrontBuilderStepDto
): StorefrontBuildState {
  if (step.required) {
    return state;
  }
  const selections = { ...state.selections };
  delete selections[step.publicId];
  return {
    ...state,
    selections,
    skippedStepIds: Array.from(new Set([...state.skippedStepIds, step.publicId])),
  };
}

export function canProgressFromStep(
  state: StorefrontBuildState,
  step: StorefrontBuilderStepDto
): boolean {
  return !step.required || Boolean(state.selections[step.publicId]);
}

export function filterProductsForSearch(
  products: StorefrontProductOptionDto[],
  query: string
): StorefrontProductOptionDto[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return products;
  return products.filter((product) =>
    [
      product.productTitle,
      product.variantTitle ?? "",
      product.vendor ?? "",
      product.sku ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalized)
  );
}

export function calculateRunningTotal(
  selections: Record<string, StorefrontBuildSelection>
): { amount: string; currencyCode: string } | null {
  const values = Object.values(selections);
  if (values.length === 0) return null;

  const currencyCode = values[0].price.currencyCode;
  const total = values.reduce((sum, selection) => {
    if (selection.price.currencyCode !== currencyCode) return sum;
    return sum + Number(selection.price.amount);
  }, 0);

  return {
    amount: total.toFixed(2),
    currencyCode,
  };
}
