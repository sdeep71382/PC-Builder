import { useFetcher } from "react-router";
import type { CsvRowResult } from "../../domains/compatibility/csv-import.server";

interface CsvImportPanelProps {
  results?: CsvRowResult[] | null;
}

export function CsvImportPanel({ results }: CsvImportPanelProps) {
  const fetcher = useFetcher();
  const isImporting =
    ["loading", "submitting"].includes(fetcher.state) && fetcher.formMethod === "POST";

  return (
    <s-section heading="Import values from CSV">
      <s-paragraph>
        Upload a CSV with three columns: catalog reference, tag name, value. Rows
        overwrite any existing value for the same tag and item.
      </s-paragraph>
      <fetcher.Form method="post" encType="multipart/form-data">
        <input type="file" name="csvFile" accept=".csv,text/csv" required aria-label="CSV file" />
        <s-button variant="primary" type="submit" disabled={isImporting}>
          Import
        </s-button>
      </fetcher.Form>

      {results && results.length > 0 && (
        <div role="status" aria-live="polite">
          <s-unordered-list>
            {results.map((result) => (
              <s-list-item key={result.row}>
                Row {result.row}:{" "}
                <s-badge tone={result.success ? "success" : "critical"}>
                  {result.success ? "Saved" : "Failed"}
                </s-badge>{" "}
                {result.message}
              </s-list-item>
            ))}
          </s-unordered-list>
        </div>
      )}
    </s-section>
  );
}
