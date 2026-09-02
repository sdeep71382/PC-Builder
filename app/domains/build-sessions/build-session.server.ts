import prisma from "../../db.server";

export type PersistedSelection = {
  stepId: string;
  productId: string;
  variantId: string;
  price: string;
};

export async function upsertValidatedBuild(input: {
  shopId: string;
  builderId: string;
  publicSessionId: string;
  currency: string;
  selections: PersistedSelection[];
}) {
  const value = input.selections.reduce((total, selection) => total + Number(selection.price), 0);
  return prisma.$transaction(async (tx) => {
    const builder = await tx.builder.findFirst({ where: { id: input.builderId, shopId: input.shopId }, select: { id: true } });
    if (!builder) throw new Error("Builder is not available for this shop.");
    const session = await tx.buildSession.upsert({
      where: { publicSessionId: input.publicSessionId },
      create: {
        publicSessionId: input.publicSessionId,
        shopId: input.shopId,
        builderId: input.builderId,
        status: "VALIDATED",
        currency: input.currency,
        buildValue: value,
        validatedAt: new Date(),
      },
      update: { status: "VALIDATED", currency: input.currency, buildValue: value, validatedAt: new Date() },
    });
    if (session.shopId !== input.shopId || session.builderId !== input.builderId) throw new Error("Build session ownership mismatch.");
    await tx.buildSelection.deleteMany({ where: { buildSessionId: session.id } });
    if (input.selections.length) {
      await tx.buildSelection.createMany({ data: input.selections.map((selection) => ({
        buildSessionId: session.id,
        stepId: selection.stepId,
        shopifyProductId: selection.productId,
        shopifyVariantId: selection.variantId,
        priceSnapshot: Number(selection.price),
      })) });
    }
    return session;
  });
}

export async function markBuildSessionCartAdded(shopId: string, publicSessionId: string) {
  return prisma.buildSession.updateMany({
    where: { shopId, publicSessionId },
    data: { status: "ADDED_TO_CART", cartAddedAt: new Date() },
  });
}

export type OrderLine = { sessionId: string; value: number };

export async function attributeOrder(input: {
  shopId: string;
  orderId: string;
  orderName?: string;
  currency?: string;
  orderTotal?: number;
  lines: OrderLine[];
}) {
  const grouped = new Map<string, number>();
  for (const line of input.lines) grouped.set(line.sessionId, (grouped.get(line.sessionId) ?? 0) + line.value);
  let attributed = 0;
  for (const [publicSessionId, value] of grouped) {
    const session = await prisma.buildSession.findFirst({ where: { shopId: input.shopId, publicSessionId }, select: { id: true, builderId: true } });
    if (!session) { console.warn("PC Builder order references an unknown build session", { shop: input.shopId, publicSessionId }); continue; }
    await prisma.$transaction([
      prisma.orderAttribution.upsert({
        where: { shopId_shopifyOrderId_buildSessionId: { shopId: input.shopId, shopifyOrderId: input.orderId, buildSessionId: session.id } },
        create: { shopId: input.shopId, builderId: session.builderId, buildSessionId: session.id, shopifyOrderId: input.orderId, shopifyOrderName: input.orderName, currency: input.currency, attributedValue: value, orderTotal: input.orderTotal },
        update: { attributedValue: value, orderTotal: input.orderTotal, currency: input.currency, shopifyOrderName: input.orderName },
      }),
      prisma.buildSession.update({ where: { id: session.id }, data: { status: "ORDERED", completedAt: new Date(), shopifyOrderId: input.orderId } }),
    ]);
    attributed += value;
  }
  return { sessions: grouped.size, attributedValue: attributed };
}
