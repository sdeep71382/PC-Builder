import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="Builder Administration">
      <s-section heading="Welcome to PC Builder Administration">
        <s-paragraph>
          Create and manage configurable PC-building experiences for your shop.
          Builders let you define ordered steps and assign existing Shopify
          products and variants to each step.
        </s-paragraph>
      </s-section>

      <s-section heading="Get started">
        <s-paragraph>
          <s-link href="/app/builders">View your builders</s-link>
        </s-paragraph>
        <s-paragraph>
          Create a builder, add steps, and assign products or variants to each
          step to define a configurable building experience.
        </s-paragraph>
        <s-button variant="primary" href="/app/builders/new">
          Create builder
        </s-button>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
