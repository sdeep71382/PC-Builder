export interface DiscountRule {
  enabled: boolean;
  thresholdAmount: unknown;
  discountPercentage: unknown;
}

export interface AppliedDiscount {
  percentage: string;
  thresholdAmount: string;
}

/**
 * Applies once the given spend total meets the rule's threshold.
 * Returns null when the rule is disabled, malformed, or not yet reached.
 */
export function evaluateSpendDiscount(
  rule: DiscountRule | null | undefined,
  totalAmount: number
): AppliedDiscount | null {
  if (!rule || !rule.enabled) return null;
  const threshold = Number(rule.thresholdAmount);
  if (!Number.isFinite(threshold) || threshold <= 0) return null;
  if (!Number.isFinite(totalAmount) || totalAmount < threshold) return null;
  return { percentage: String(rule.discountPercentage), thresholdAmount: String(rule.thresholdAmount) };
}
