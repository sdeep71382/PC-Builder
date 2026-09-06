import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const CART_TRANSFORM_FUNCTION_HANDLE = "pc-builder-cart-transform";

type ShopifyResponse = {
  data?: {
    cartTransformCreate?: {
      cartTransform?: { id: string } | null;
      userErrors: Array<{ code?: string | null; message: string }>;
    };
  };
  errors?: Array<{ message: string }>;
};

export async function ensureCartTransform(admin: AdminApiContext): Promise<void> {
  const response = await admin.graphql(
    `#graphql
      mutation PcBuilderActivateCartTransform($functionHandle: String!) {
        cartTransformCreate(functionHandle: $functionHandle) {
          cartTransform { id }
          userErrors { code message }
        }
      }
    `,
    { variables: { functionHandle: CART_TRANSFORM_FUNCTION_HANDLE } }
  );
  const json = (await response.json()) as ShopifyResponse;
  const userErrors = json.data?.cartTransformCreate?.userErrors ?? [];
  const alreadyRegistered = userErrors.some((error) => error.code === "FUNCTION_ALREADY_REGISTERED");
  if (alreadyRegistered) {
    console.info("PC Builder cart transform already active", {
      functionHandle: CART_TRANSFORM_FUNCTION_HANDLE,
    });
    return;
  }
  if (json.errors?.length || userErrors.length || !json.data?.cartTransformCreate?.cartTransform) {
    const messages = [
      ...(json.errors ?? []).map((error) => error.message),
      ...userErrors.map((error) => error.message),
    ];
    throw new Error(messages.join(" ") || "Could not activate the PC Builder cart transform.");
  }
  console.info("PC Builder cart transform activated", {
    functionHandle: CART_TRANSFORM_FUNCTION_HANDLE,
    cartTransformId: json.data.cartTransformCreate.cartTransform.id,
  });
}
