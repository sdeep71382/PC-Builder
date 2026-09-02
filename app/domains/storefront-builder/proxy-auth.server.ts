import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { authenticate, unauthenticated } from "../../shopify.server";

export interface PcBuilderStorefrontContext {
  shop: string;
  admin: AdminApiContext;
}

export async function authenticatePcBuilderStorefront(
  request: Request
): Promise<PcBuilderStorefrontContext | null> {
  const debugUrl = new URL(request.url);
  console.info("PC Builder storefront request received", {
    origin: debugUrl.origin,
    pathname: debugUrl.pathname,
    hasShop: debugUrl.searchParams.has("shop"),
    hasSignature: debugUrl.searchParams.has("signature"),
    hasHmac: debugUrl.searchParams.has("hmac"),
  });

  try {
    const { session, admin } = await authenticate.public.appProxy(request);
    if (session && admin) {
      console.info("PC Builder signed app proxy authentication succeeded", {
        shop: session.shop,
      });
      return { shop: session.shop, admin };
    }
    console.info("PC Builder signed app proxy authentication returned without session");
  } catch (error) {
    console.warn("PC Builder signed app proxy authentication failed", {
      message: error instanceof Error ? error.message : "Unknown app proxy authentication error.",
    });
  }

  const shop = getShopFromStorefrontRequest(request);
  if (!shop) {
    console.warn("PC Builder storefront shop could not be derived from request", {
      host: debugUrl.hostname,
      shop: debugUrl.searchParams.get("shop"),
    });
    return null;
  }

  try {
    const { session, admin } = await unauthenticated.admin(shop);
    console.info("PC Builder offline storefront session loaded", {
      shop: session.shop,
    });
    return { shop: session.shop, admin };
  } catch (error) {
    console.warn("PC Builder storefront offline session lookup failed", {
      shop,
      message: error instanceof Error ? error.message : "Unknown offline session error.",
    });
    return null;
  }
}

function getShopFromStorefrontRequest(request: Request): string | null {
  const url = new URL(request.url);
  const shopFromQuery = url.searchParams.get("shop")?.toLowerCase() ?? null;
  if (isMyshopifyDomain(shopFromQuery)) {
    return shopFromQuery;
  }

  const host = url.hostname.toLowerCase();
  return isMyshopifyDomain(host) ? host : null;
}

function isMyshopifyDomain(value: string | null): value is string {
  return Boolean(value && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(value));
}
