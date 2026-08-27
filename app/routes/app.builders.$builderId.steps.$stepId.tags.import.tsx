import type { ActionFunctionArgs } from "react-router";
import { useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { importCompatibilityValuesCsv } from "../domains/compatibility/csv-import.server";
import type { CsvRowResult } from "../domains/compatibility/csv-import.server";
import { CsvImportPanel } from "../components/compatibility/CsvImportPanel";

interface ActionData {
  results?: CsvRowResult[];
  feedback?: {
    type: "success" | "validation" | "authorization" | "stale" | "temporary";
    message: string;
  };
}

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const stepId = params.stepId;
  if (!stepId) {
    return Response.json(
      { feedback: { type: "validation", message: "Step ID is required." } },
      { status: 400 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("csvFile");

  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { feedback: { type: "validation", message: "A CSV file is required." } },
      { status: 400 },
    );
  }

  try {
    const content = await file.text();
    const results = await importCompatibilityValuesCsv(session.shop, stepId, content);
    const failureCount = results.filter((result) => !result.success).length;
    return Response.json({
      results,
      feedback: {
        type: "success",
        message:
          failureCount === 0
            ? `Imported ${results.length} row(s).`
            : `Imported ${results.length} row(s), ${failureCount} failed. See details below.`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to import CSV.";
    const type = message.includes("not found") ? "authorization" : "validation";
    return Response.json({ feedback: { type, message } }, { status: 400 });
  }
};

export default function CompatibilityTagsImport() {
  const actionData = useActionData<ActionData>();
  return <CsvImportPanel results={actionData?.results ?? null} />;
}
