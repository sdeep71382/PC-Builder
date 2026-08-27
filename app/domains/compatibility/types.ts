export type CompatibilityTagRole = "standard" | "powerDraw" | "outputWattage";

export interface CompatibilityTag {
  id: string;
  shopId: string;
  stepId: string;
  builderId: string;
  name: string;
  role: CompatibilityTagRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface TagValueAssignment {
  id: string;
  shopId: string;
  tagId: string;
  assignmentId: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompatibilityTagWithValues extends CompatibilityTag {
  values: TagValueAssignment[];
}

export type BuildSelections = Record<string, string>;

export interface Build {
  id: string;
  shopId: string;
  builderId: string;
  token: string;
  selections: BuildSelections;
  startedAt: Date;
  completedAt: Date | null;
  addedToCartAt: Date | null;
  convertedAt: Date | null;
  lastActivityAt: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type AiSuggestionSource = "gemini-byo" | "built-in";
export type AiSuggestionStatus = "pending" | "approved" | "rejected";

export interface AiTagSuggestion {
  id: string;
  shopId: string;
  tagId: string;
  assignmentId: string;
  suggestedValue: string;
  source: AiSuggestionSource;
  status: AiSuggestionStatus;
  createdAt: Date;
  reviewedAt: Date | null;
}

export interface AiIntegration {
  id: string;
  shopId: string;
  geminiApiKeyEncrypted: string | null;
  builtInAiEntitled: boolean;
  disclosureAcceptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompatibilityValidationError {
  field: string;
  message: string;
}

export interface ExcludedOption {
  assignmentId: string;
  reason: string;
}

export interface FilteredStepOptions {
  available: string[];
  outOfStock: string[];
  excluded: ExcludedOption[];
}

export interface PowerBudgetResult {
  runningDrawWatts: number;
  headroomPercentage: number;
  requiredWattage: number;
}
