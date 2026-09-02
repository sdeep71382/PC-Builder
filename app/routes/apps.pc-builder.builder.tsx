import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { getDefaultStorefrontBuilder } from "../domains/storefront-builder/storefront-builder.server";
import { validateBuildForCart } from "../domains/storefront-builder/storefront-builder.server";
import { authenticatePcBuilderStorefront } from "../domains/storefront-builder/proxy-auth.server";
import { markBuildSessionCartAdded } from "../domains/build-sessions/build-session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const context = await authenticatePcBuilderStorefront(request);
  if (!context) {
    return storefrontJson(
      {
        error: "Builder unavailable.",
        reason: "storefront_shop_unavailable",
      },
      404
    );
  }

  const result = await getDefaultStorefrontBuilder(context.shop, context.admin);
  if (result.type === "unavailable") {
    return storefrontJson(
      {
        error: "Builder unavailable.",
        reason: "no_published_default_builder",
      },
      404
    );
  }

  return storefrontJson(result.data);
}

export async function action({ request }: ActionFunctionArgs) {
  const context = await authenticatePcBuilderStorefront(request);
  if (!context) return storefrontJson({ valid: false, errors: [{ type: "INVALID_VARIANT", message: "Storefront session unavailable." }] }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return storefrontJson({ valid: false, errors: [{ type: "INVALID_VARIANT", message: "Invalid validation request." }] }, 400); }
  if (!body || typeof body !== "object") return storefrontJson({ valid: false, errors: [{ type: "INVALID_VARIANT", message: "Invalid validation request." }] }, 400);
  const input = body as { action?: unknown; builderId?: unknown; selections?: unknown; sessionId?: unknown };
  if (input.action === "mark_cart_added" && typeof input.sessionId === "string") {
    await markBuildSessionCartAdded(context.shop, input.sessionId);
    return storefrontJson({ ok: true });
  }
  if (typeof input.builderId !== "string" || !input.builderId || !input.selections || typeof input.selections !== "object") return storefrontJson({ valid: false, errors: [{ type: "INVALID_VARIANT", message: "Builder and selections are required." }] }, 400);
  const selections: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.selections)) if (typeof value === "string" && value.startsWith("gid://shopify/ProductVariant/")) selections[key] = value;
  const sessionId = typeof input.sessionId === "string" && /^pcb_[A-Za-z0-9_-]{12,100}$/.test(input.sessionId) ? input.sessionId : `pcb_${crypto.randomUUID().replaceAll("-", "")}`;
  try { return storefrontJson(await validateBuildForCart(context.shop, input.builderId, selections, context.admin, sessionId)); }
  catch (error) { return storefrontJson({ valid: false, errors: [{ type: "INVALID_VARIANT", message: error instanceof Error ? error.message : "Build validation failed." }] }, 400); }
}

function storefrontJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
