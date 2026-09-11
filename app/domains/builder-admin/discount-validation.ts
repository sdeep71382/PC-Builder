import type { BuilderValidationError } from "./types";

export interface DiscountInput {
  enabled: boolean;
  thresholdAmount: string;
  discountPercentage: string;
  label?: string | null;
}

export function validateDiscountInput(data: DiscountInput): BuilderValidationError | null {
  const threshold = Number(data.thresholdAmount);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return {
      field: "thresholdAmount",
      message: "Spend threshold must be a positive number.",
    };
  }

  const percentage = Number(data.discountPercentage);
  if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
    return {
      field: "discountPercentage",
      message: "Discount percentage must be greater than 0 and no more than 100.",
    };
  }

  if (data.label && data.label.length > 120) {
    return {
      field: "label",
      message: "Discount label must be 120 characters or fewer.",
    };
  }

  return null;
}
