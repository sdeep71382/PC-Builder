import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type {
  ShopifyCatalogResult,
  ShopifyCollectionLookupResult,
  ShopifyCollectionNode,
  ShopifyProductLookupResult,
  ShopifyProductNode,
  ShopifyVariantLookupResult,
  ShopifyVariantNode,
} from "./types";

const CATALOG_UNAVAILABLE_MESSAGE =
  "Shopify catalog lookup is temporarily unavailable. Please try again.";

export async function lookupShopifyCatalog(
  admin: AdminApiContext
): Promise<ShopifyCatalogResult> {
  try {
    const collections = await admin.graphql(`
      query {
        collections(first: 100) {
          nodes {
            id
            title
            handle
            image {
              url
              altText
            }
            productsCount {
              count
            }
          }
        }
      }
    `);

    const products = await admin.graphql(`
      query {
        products(first: 100) {
          nodes {
            id
            title
          }
        }
      }
    `);

    const variants = await admin.graphql(`
      query {
        productVariants(first: 100) {
          nodes {
            id
            title
            product {
              id
              title
            }
          }
        }
      }
    `);

    const collectionsJson = (await collections.json()) as {
      data?: { collections: { nodes: ShopifyCollectionNode[] } };
      collections: { nodes: ShopifyCollectionNode[] };
    };
    const productsJson = (await products.json()) as {
      data?: { products: { nodes: ShopifyProductNode[] } };
      products: { nodes: ShopifyProductNode[] };
    };
    const variantsJson = (await variants.json()) as {
      data?: { productVariants: { nodes: ShopifyVariantNode[] } };
      productVariants: { nodes: ShopifyVariantNode[] };
    };

    const collectionNodes = (collectionsJson.data?.collections ?? collectionsJson.collections).nodes.map(normalizeCollectionNode);

    return {
      type: "success",
      collections: collectionNodes,
      products: (productsJson.data?.products ?? productsJson.products).nodes,
      variants: (variantsJson.data?.productVariants ?? variantsJson.productVariants).nodes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : CATALOG_UNAVAILABLE_MESSAGE;
    return { type: "failure", message: message || CATALOG_UNAVAILABLE_MESSAGE };
  }
}

export async function findShopifyCollection(
  admin: AdminApiContext,
  shopifyCollectionId: string
): Promise<ShopifyCollectionLookupResult> {
  try {
    const result = await admin.graphql(
      `#graphql
        query ($id: ID!) {
          collection(id: $id) {
            id
            title
            handle
            image {
              url
              altText
            }
            productsCount {
              count
            }
          }
        }
      `,
      { variables: { id: shopifyCollectionId } }
    );

    const json = (await result.json()) as {
      data?: { collection: (ShopifyCollectionNode & { productsCount?: { count?: number } | number }) | null };
      collection?: (ShopifyCollectionNode & { productsCount?: { count?: number } | number }) | null;
    };
    const collection = json.data?.collection ?? json.collection ?? null;
    return { type: "success", collection: collection ? normalizeCollectionNode(collection) : null };
  } catch (error) {
    const message = error instanceof Error ? error.message : CATALOG_UNAVAILABLE_MESSAGE;
    return { type: "failure", message: message || CATALOG_UNAVAILABLE_MESSAGE };
  }
}

function normalizeCollectionNode(
  collection: ShopifyCollectionNode & { productsCount?: { count?: number } | number }
): ShopifyCollectionNode {
  const productCount =
    typeof collection.productsCount === "number"
      ? collection.productsCount
      : collection.productsCount?.count ?? collection.productCount ?? null;

  return {
    id: collection.id,
    title: collection.title,
    handle: collection.handle,
    image: collection.image ?? null,
    productCount,
  };
}

export async function findShopifyProduct(
  admin: AdminApiContext,
  shopifyProductId: string
): Promise<ShopifyProductLookupResult> {
  try {
    const result = await admin.graphql(
      `#graphql
        query ($id: ID!) {
          product(id: $id) {
            id
            title
          }
        }
      `,
      { variables: { id: shopifyProductId } }
    );

    const json = (await result.json()) as {
      data?: { product: ShopifyProductNode | null };
      product?: ShopifyProductNode | null;
    };
    return { type: "success", product: json.data?.product ?? json.product ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : CATALOG_UNAVAILABLE_MESSAGE;
    return { type: "failure", message: message || CATALOG_UNAVAILABLE_MESSAGE };
  }
}

export async function findShopifyVariant(
  admin: AdminApiContext,
  shopifyVariantId: string
): Promise<ShopifyVariantLookupResult> {
  try {
    const result = await admin.graphql(
      `#graphql
        query ($id: ID!) {
          productVariant(id: $id) {
            id
            title
            product {
              id
              title
            }
          }
        }
      `,
      { variables: { id: shopifyVariantId } }
    );

    const json = (await result.json()) as {
      data?: { productVariant: ShopifyVariantNode | null };
      productVariant?: ShopifyVariantNode | null;
    };
    return { type: "success", variant: json.data?.productVariant ?? json.productVariant ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : CATALOG_UNAVAILABLE_MESSAGE;
    return { type: "failure", message: message || CATALOG_UNAVAILABLE_MESSAGE };
  }
}
