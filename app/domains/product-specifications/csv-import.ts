import type { ShopifyCollectionProduct, SpecificationDefinition } from "./types";

export interface CsvImportRowError {
  row: number;
  message: string;
}

export interface CsvImportEntry {
  shopifyProductId: string;
  shopifyVariantId: string;
  productTitle: string;
  variantTitle: string;
  values: Record<string, string | undefined>;
}

export interface CsvImportPlan {
  entries: CsvImportEntry[];
  errors: CsvImportRowError[];
}

const HANDLE_COLUMN = "handle";
const SKU_COLUMN = "sku";

/** Parses a small RFC4180-style CSV (quoted fields, embedded commas/newlines, "" escapes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((cell) => cell.trim() !== ""));
}

/**
 * Builds an import plan from a specifications CSV against the products already
 * loaded for the current builder step. Expects a header row with a `handle`
 * and/or `sku` identifier column plus one column per specification key.
 */
export function buildSpecificationImportPlan(
  csvText: string,
  definitions: SpecificationDefinition[],
  products: ShopifyCollectionProduct[]
): CsvImportPlan {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { entries: [], errors: [{ row: 0, message: "The CSV file is empty." }] };
  }

  const [headerRow, ...dataRows] = rows;
  const headers = headerRow.map((header) => header.trim().toLowerCase());
  const handleIndex = headers.indexOf(HANDLE_COLUMN);
  const skuIndex = headers.indexOf(SKU_COLUMN);
  if (handleIndex === -1 && skuIndex === -1) {
    return {
      entries: [],
      errors: [{ row: 1, message: "The CSV header must include a \"handle\" or \"sku\" column." }],
    };
  }

  const definitionByKey = new Map(
    definitions.map((definition) => [definition.key.toLowerCase(), definition])
  );
  const columnDefinitions = headers.map((header) => definitionByKey.get(header) ?? null);

  const variantBySku = new Map<string, { product: ShopifyCollectionProduct; variant: ShopifyCollectionProduct["variants"][number] }>();
  const variantsByHandle = new Map<string, Array<{ product: ShopifyCollectionProduct; variant: ShopifyCollectionProduct["variants"][number] }>>();
  for (const product of products) {
    for (const variant of product.variants) {
      if (variant.sku) variantBySku.set(variant.sku.trim().toLowerCase(), { product, variant });
      const byHandle = variantsByHandle.get(product.handle) ?? [];
      byHandle.push({ product, variant });
      variantsByHandle.set(product.handle, byHandle);
    }
  }

  const entries: CsvImportEntry[] = [];
  const errors: CsvImportRowError[] = [];

  dataRows.forEach((cells, dataIndex) => {
    const rowNumber = dataIndex + 2; // account for the header row, 1-indexed
    const handle = handleIndex >= 0 ? (cells[handleIndex] ?? "").trim() : "";
    const sku = skuIndex >= 0 ? (cells[skuIndex] ?? "").trim() : "";

    let match: { product: ShopifyCollectionProduct; variant: ShopifyCollectionProduct["variants"][number] } | undefined;
    if (sku) {
      match = variantBySku.get(sku.toLowerCase());
      if (!match) {
        errors.push({ row: rowNumber, message: `No product variant found with SKU "${sku}".` });
        return;
      }
    } else if (handle) {
      const candidates = variantsByHandle.get(handle) ?? [];
      if (candidates.length === 0) {
        errors.push({ row: rowNumber, message: `No product found with handle "${handle}".` });
        return;
      }
      if (candidates.length > 1) {
        errors.push({
          row: rowNumber,
          message: `"${handle}" has multiple variants; add a "sku" column to disambiguate.`,
        });
        return;
      }
      match = candidates[0];
    } else {
      errors.push({ row: rowNumber, message: "Row is missing a handle or SKU to match a product." });
      return;
    }

    const values: Record<string, string | undefined> = {};
    columnDefinitions.forEach((definition, columnIndex) => {
      if (!definition) return;
      const raw = cells[columnIndex];
      values[definition.id] = raw === undefined || raw.trim() === "" ? undefined : raw.trim();
    });

    entries.push({
      shopifyProductId: match.product.id,
      shopifyVariantId: match.variant.id,
      productTitle: match.product.title,
      variantTitle: match.variant.title,
      values,
    });
  });

  return { entries, errors };
}
