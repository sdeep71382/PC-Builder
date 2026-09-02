import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SHOP_ID = process.env.SHOP_ID ?? "pc-builder-app.myshopify.com";

const builders = [
  {
    name: "Default PC Builder",
    description:
      "Full configurable PC builder with editable steps for the main component journey.",
    status: "draft",
    steps: [
      "Processor",
      "Motherboard",
      "Memory",
      "Graphics card",
      "Storage",
      "Power supply",
      "Case",
    ],
  },
  {
    name: "Starter PC Builder",
    description:
      "Simpler starter builder for merchants who want a shorter guided selection flow.",
    status: "draft",
    steps: [
      "Processor",
      "Motherboard",
      "Memory",
      "Storage",
      "Case",
    ],
  },
];

async function deleteExistingBuilderData(shopId) {
  await prisma.$transaction([
    prisma.productSpecification.deleteMany({ where: { shopId } }),
    prisma.compatibilityRule.deleteMany({ where: { shopId } }),
    prisma.stepCatalogAssignment.deleteMany({ where: { shopId } }),
    prisma.builderStep.deleteMany({ where: { shopId } }),
    prisma.builder.deleteMany({ where: { shopId } }),
  ]);
}

async function createBuilderWithSteps(shopId, builderInput, isDefault) {
  const builder = await prisma.builder.create({
    data: {
      shopId,
      name: builderInput.name,
      description: builderInput.description,
      status: builderInput.status,
      isDefault,
      builderSteps: {
        create: builderInput.steps.map((name, index) => ({
          shopId,
          name,
          position: index + 1,
          enabled: true,
          required: true,
        })),
      },
    },
    include: {
      builderSteps: {
        orderBy: { position: "asc" },
      },
    },
  });

  return builder;
}

async function main() {
  await deleteExistingBuilderData(SHOP_ID);

  const created = [];
  for (const [index, builder] of builders.entries()) {
    const createdBuilder = await createBuilderWithSteps(SHOP_ID, builder, index === 0);
    created.push(createdBuilder);
  }

  console.log(`Seeded ${created.length} builders for ${SHOP_ID}:`);
  for (const builder of created) {
    console.log(`- ${builder.name}: ${builder.builderSteps.length} steps`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
