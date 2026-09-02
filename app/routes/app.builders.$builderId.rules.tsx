import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useActionData, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getBuilder } from "../domains/builder-admin/builder.server";
import { ensureDefaultSpecificationDefinitions } from "../domains/product-specifications/product-specification.server";
import {
  createCompatibilityRule,
  deleteCompatibilityRule,
  ensureDefaultPcCompatibilityRules,
  listCompatibilityRules,
  listRuleFieldOptions,
  setCompatibilityRuleEnabled,
  updateCompatibilityRule,
} from "../domains/compatibility/compatibility-rule.server";
import type {
  CompatibilityRuleOperator,
  CompatibilityRuleSeverity,
} from "../domains/compatibility/types";
import { CompatibilityRuleManager } from "../components/compatibility/CompatibilityRuleManager";

interface ActionData {
  feedback?: {
    type: "success" | "validation" | "authorization";
    message: string;
  };
}

function formString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function ruleInputFromFormData(formData: FormData) {
  return {
    sourceCategory: formString(formData, "sourceCategory"),
    sourceField: formString(formData, "sourceField"),
    operator: formString(formData, "operator") as CompatibilityRuleOperator,
    targetCategory: formString(formData, "targetCategory"),
    targetField: formString(formData, "targetField"),
    severity: formString(formData, "severity") as CompatibilityRuleSeverity,
    enabled: formData.get("enabled") === "on",
    message: formString(formData, "message"),
  };
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    throw new Response("Not Found", { status: 404 });
  }

  const builder = await getBuilder(session.shop, builderId);
  if (!builder) {
    throw new Response("Not Found", { status: 404 });
  }

  await ensureDefaultSpecificationDefinitions(session.shop);
  const [rules, fieldOptions] = await Promise.all([
    listCompatibilityRules(session.shop, builderId),
    listRuleFieldOptions(session.shop),
  ]);

  return { builder, rules, fieldOptions };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builderId = params.builderId;
  if (!builderId) {
    return Response.json(
      { feedback: { type: "validation", message: "Builder ID is required." } },
      { status: 400 }
    );
  }

  const formData = await request.formData();
  const intent = formString(formData, "intent");
  const ruleId = formString(formData, "ruleId");

  try {
    if (intent === "create-defaults") {
      await ensureDefaultSpecificationDefinitions(session.shop);
      await ensureDefaultPcCompatibilityRules(session.shop, builderId);
    } else if (intent === "create") {
      await createCompatibilityRule(session.shop, builderId, ruleInputFromFormData(formData));
    } else if (intent === "update") {
      await updateCompatibilityRule(
        session.shop,
        builderId,
        ruleId,
        ruleInputFromFormData(formData)
      );
    } else if (intent === "toggle") {
      await setCompatibilityRuleEnabled(
        session.shop,
        builderId,
        ruleId,
        formString(formData, "enabled") === "true"
      );
    } else if (intent === "delete") {
      await deleteCompatibilityRule(session.shop, builderId, ruleId);
    } else {
      throw new Error("Unsupported rule action.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save compatibility rule.";
    const type = message.includes("not found") ? "authorization" : "validation";
    return Response.json({ feedback: { type, message } }, { status: 400 });
  }

  return Response.json({
    feedback: { type: "success", message: "Compatibility rule changes saved." },
  });
};

export default function BuilderCompatibilityRules() {
  const { builder, rules, fieldOptions } = useLoaderData<typeof loader>();
  const actionData = useActionData<ActionData>();

  return (
    <CompatibilityRuleManager
      builder={builder}
      rules={rules}
      fieldOptions={fieldOptions}
      feedback={actionData?.feedback ?? null}
    />
  );
}
