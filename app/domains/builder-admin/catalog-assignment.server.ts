import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type {
  ShopifyCatalogResult,
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

    const productsData = (await products.json()) as {
      products: { nodes: ShopifyProductNode[] };
    };
    const variantsData = (await variants.json()) as {
      productVariants: { nodes: ShopifyVariantNode[] };
    };

    return {
      type: "success",
      products: productsData.products.nodes,
      variants: variantsData.productVariants.nodes,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : CATALOG_UNAVAILABLE_MESSAGE;
    return { type: "failure", message: message || CATALOG_UNAVAILABLE_MESSAGE };
  }
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

    const data = (await result.json()) as { product: ShopifyProductNode | null };
    return { type: "success", product: data.product ?? null };
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

    const data = (await result.json()) as { productVariant: ShopifyVariantNode | null };
    return { type: "success", variant: data.productVariant ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : CATALOG_UNAVAILABLE_MESSAGE;
    return { type: "failure", message: message || CATALOG_UNAVAILABLE_MESSAGE };
  }
}
