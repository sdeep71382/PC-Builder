import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { attributeOrder } from "../domains/build-sessions/build-session.server";

export async function action({ request }: ActionFunctionArgs) {
  const { shop, topic, payload } = await authenticate.webhook(request);
  const order = asRecord(payload);
  const rawOrderId = typeof order.id === "string" || typeof order.id === "number" ? String(order.id) : "";
  if (!rawOrderId) return new Response(null, { status: 200 });
  const orderId = rawOrderId.startsWith("gid://shopify/") ? rawOrderId : `gid://shopify/Order/${rawOrderId}`;
  const lines = Array.isArray(order.line_items) ? order.line_items.flatMap(parseLine) : [];
  if (!lines.length) return new Response(null, { status: 200 });
  const result = await attributeOrder({
    shopId: shop,
    orderId,
    orderName: typeof order.name === "string" ? order.name : undefined,
    currency: typeof order.currency === "string" ? order.currency : undefined,
    orderTotal: numeric(order.total_price),
    lines,
  });
  console.info("PC Builder order attribution processed", { shop, topic, orderId, sessions: result.sessions });
  return new Response(null, { status: 200 });
}

function parseLine(value: unknown) {
  const line = asRecord(value);
  const properties = Array.isArray(line.properties) ? line.properties : [];
  const sessionProperty = properties.map(asRecord).find((property) => property.name === "_pc_build_session");
  const sessionId = sessionProperty && typeof sessionProperty.value === "string" ? sessionProperty.value : null;
  if (!sessionId) return [];
  const quantity = numeric(line.quantity) ?? 1;
  const priceSet = asRecord(line.price_set);
  const shopMoney = asRecord(priceSet.shop_money);
  const linePrice = numeric(shopMoney.amount) ?? numeric(line.price) ?? 0;
  return [{ sessionId, value: linePrice * quantity }];
}

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" ? value as Record<string, unknown> : {}; }
function numeric(value: unknown): number | undefined { const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : undefined; }
