import type { HeadersFunction, LinksFunction, LoaderFunctionArgs } from "react-router";
import {
  isRouteErrorResponse,
  Outlet,
  useLoaderData,
  useRouteError,
} from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";

import { authenticate } from "../shopify.server";
import builderAdminStyles from "../styles/builder-admin.css?url";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: builderAdminStyles },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  // eslint-disable-next-line no-undef
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">Home</s-link>
        <s-link href="/app/builders">Builders</s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

function AppLoadingSkeleton() {
  return (
    <div className="builder-loading-shell">
      <div className="builder-admin">
        <div className="builder-loading-header" role="status" aria-live="polite">
          <div>
            <div className="builder-skeleton builder-skeleton--eyebrow" />
            <div className="builder-skeleton builder-skeleton--title" />
            <div className="builder-skeleton builder-skeleton--text" />
            <div className="builder-skeleton builder-skeleton--text builder-skeleton--short" />
          </div>
          <div className="builder-loading-actions">
            <div className="builder-skeleton builder-skeleton--button" />
            <div className="builder-skeleton builder-skeleton--button builder-skeleton--button-secondary" />
          </div>
          <span className="builder-loading-label">Loading app...</span>
        </div>

        <div className="builder-admin__grid builder-admin__grid--two builder-admin__grid--top">
          <div className="builder-card builder-card--setup">
            <div className="builder-skeleton builder-skeleton--card-title" />
            <div className="builder-skeleton-list">
              <div className="builder-skeleton builder-skeleton--row" />
              <div className="builder-skeleton builder-skeleton--row" />
              <div className="builder-skeleton builder-skeleton--row" />
              <div className="builder-skeleton builder-skeleton--row" />
            </div>
          </div>
          <div className="builder-card builder-card--setup">
            <div className="builder-skeleton builder-skeleton--card-title" />
            <div className="builder-skeleton builder-skeleton--text" />
            <div className="builder-skeleton-list">
              <div className="builder-skeleton builder-skeleton--row" />
              <div className="builder-skeleton builder-skeleton--row" />
              <div className="builder-skeleton builder-skeleton--row" />
              <div className="builder-skeleton builder-skeleton--row" />
            </div>
          </div>
        </div>

        <div className="builder-admin__grid builder-admin__grid--two">
          <div className="builder-card builder-card--equal">
            <div className="builder-skeleton builder-skeleton--card-title" />
            <div className="builder-skeleton builder-skeleton--paragraph" />
          </div>
          <div className="builder-card builder-card--equal">
            <div className="builder-skeleton builder-skeleton--card-title" />
            <div className="builder-skeleton builder-skeleton--paragraph" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HydrateFallback() {
  return <AppLoadingSkeleton />;
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof Response || isRouteErrorResponse(error)) {
    return <AppLoadingSkeleton />;
  }

  throw error;
}

export const headers: HeadersFunction = (headersArgs) => {
  return headersArgs.loaderHeaders;
};
