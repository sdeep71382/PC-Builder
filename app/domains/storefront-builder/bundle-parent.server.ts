import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../../db.server";

const INTERNAL_BUNDLE_TAG = "pc-builder-internal-bundle";
const BUNDLE_TITLE = "PC Builder Bundle";

type BundleProduct = {
  id: string;
  title: string;
  status: string;
  tags: string[];
  variants: { nodes: Array<{ id: string }> };
};

type ShopifyResponse<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
};

export async function ensureBundleParent(
  shopId: string,
  admin: AdminApiContext
): Promise<string> {
  console.info("PC Builder bundle parent setup started", { shopId });
  const stored = await prisma.bundleParent.findUnique({ where: { shopId } });
  let product = stored
    ? await getProduct(admin, stored.shopifyProductId)
    : await findAppBundleProduct(admin);

  if (!product) {
    console.info("PC Builder bundle parent missing; creating replacement", { shopId });
    product = await createBundleProduct(admin);
  }
  if (!product.variants.nodes[0]) throw new Error("PC Builder bundle parent has no variant.");

  await activateProduct(admin, product);
  await publishProduct(admin, product.id);

  const variantId = stored?.shopifyVariantId && product.variants.nodes.some((variant) => variant.id === stored.shopifyVariantId)
    ? stored.shopifyVariantId
    : product.variants.nodes[0].id;

  await prisma.bundleParent.upsert({
    where: { shopId },
    create: { shopId, shopifyProductId: product.id, shopifyVariantId: variantId },
    update: { shopifyProductId: product.id, shopifyVariantId: variantId },
  });

  console.info("PC Builder bundle parent ready", { shopId, productId: product.id, variantId });
  return variantId;
}

async function findAppBundleProduct(admin: AdminApiContext): Promise<BundleProduct | null> {
  const tagged = await queryProducts(admin, `tag:${INTERNAL_BUNDLE_TAG}`);
  const taggedMatch = tagged.find((product) => product.title === BUNDLE_TITLE);
  if (taggedMatch) return taggedMatch;

  const titleMatches = await queryProducts(admin, "title:PC Builder Bundle");
  return titleMatches.find((product) => product.title === BUNDLE_TITLE) ?? null;
}

async function queryProducts(admin: AdminApiContext, query: string): Promise<BundleProduct[]> {
  const response = await admin.graphql(
    `#graphql
      query PcBuilderBundleProducts($query: String!) {
        products(first: 20, query: $query) {
          nodes {
            id
            title
            status
            tags
            variants(first: 1) { nodes { id } }
          }
        }
      }
    `,
    { variables: { query } }
  );
  const json = (await response.json()) as ShopifyResponse<{ products: { nodes: BundleProduct[] } }>;
  if (json.errors?.length) throw new Error(json.errors.map((error) => error.message).join(" "));
  return json.data?.products.nodes ?? [];
}

async function getProduct(admin: AdminApiContext, id: string): Promise<BundleProduct | null> {
  const response = await admin.graphql(
    `#graphql
      query PcBuilderBundleProduct($id: ID!) {
        product(id: $id) {
          id
          title
          status
          tags
          variants(first: 1) { nodes { id } }
        }
      }
    `,
    { variables: { id } }
  );
  const json = (await response.json()) as ShopifyResponse<{ product: BundleProduct | null }>;
  if (json.errors?.length) throw new Error(json.errors.map((error) => error.message).join(" "));
  return json.data?.product ?? null;
}

async function createBundleProduct(admin: AdminApiContext): Promise<BundleProduct> {
  const response = await admin.graphql(
    `#graphql
      mutation PcBuilderCreateBundle {
        productCreate(product: {
          title: "${BUNDLE_TITLE}"
          handle: "pc-builder-bundle"
          descriptionHtml: "Internal bundle parent managed by PC Builder."
          vendor: "PC Builder"
          productType: "PC Builder Bundle"
          status: ACTIVE
          tags: ["${INTERNAL_BUNDLE_TAG}"]
        }) {
          product {
            id
            title
            status
            tags
            variants(first: 1) { nodes { id } }
          }
          userErrors { field message }
        }
      }
    `
  );
  const json = (await response.json()) as ShopifyResponse<{ productCreate: { product: BundleProduct | null; userErrors: Array<{ message: string }> } }>;
  const userErrors = json.data?.productCreate.userErrors ?? [];
  if (json.errors?.length || userErrors.length || !json.data?.productCreate.product) {
    throw new Error([...json.errors ?? [], ...userErrors].map((error) => error.message).join(" ") || "Could not create PC Builder bundle parent.");
  }
  return json.data.productCreate.product;
}

async function activateProduct(admin: AdminApiContext, product: BundleProduct): Promise<void> {
  if (product.status === "ACTIVE" && product.tags.includes(INTERNAL_BUNDLE_TAG)) return;
  const tags = product.tags.includes(INTERNAL_BUNDLE_TAG) ? product.tags : [...product.tags, INTERNAL_BUNDLE_TAG];
  const response = await admin.graphql(
    `#graphql
      mutation PcBuilderActivateBundle($product: ProductUpdateInput!) {
        productUpdate(product: $product) { userErrors { field message } }
      }
    `,
    { variables: { product: { id: product.id, status: "ACTIVE", tags } } }
  );
  const json = (await response.json()) as ShopifyResponse<{ productUpdate: { userErrors: Array<{ message: string }> } }>;
  const userErrors = json.data?.productUpdate.userErrors ?? [];
  if (json.errors?.length || userErrors.length) throw new Error([...json.errors ?? [], ...userErrors].map((error) => error.message).join(" "));
}

async function publishProduct(admin: AdminApiContext, productId: string): Promise<void> {
  console.info("PC Builder publishing bundle parent to Online Store", { productId });
  const publicationsResponse = await admin.graphql(`#graphql query PcBuilderPublications { publications(first: 50) { nodes { id name } } }`);
  const publicationsJson = (await publicationsResponse.json()) as ShopifyResponse<{ publications: { nodes: Array<{ id: string; name: string }> } }>;
  if (publicationsJson.errors?.length) throw new Error(publicationsJson.errors.map((error) => error.message).join(" "));
  const onlineStore = publicationsJson.data?.publications.nodes.find((publication) => publication.name.toLowerCase() === "online store");
  if (!onlineStore) {
    throw new Error("Online Store sales channel is unavailable. Enable the Online Store channel to use PC Builder.");
  }

  const publishResponse = await admin.graphql(
    `#graphql
      mutation PcBuilderPublishBundleToOnlineStore($id: ID!, $publicationId: ID!) {
        publishablePublish(id: $id, input: { publicationId: $publicationId }) { userErrors { field message } }
      }
    `,
    { variables: { id: productId, publicationId: onlineStore.id } }
  );
  const publishJson = (await publishResponse.json()) as ShopifyResponse<{ publishablePublish: { userErrors: Array<{ message: string }> } }>;
  const userErrors = publishJson.data?.publishablePublish.userErrors ?? [];
  if (publishJson.errors?.length || userErrors.length) throw new Error([...publishJson.errors ?? [], ...userErrors].map((error) => error.message).join(" "));
}
