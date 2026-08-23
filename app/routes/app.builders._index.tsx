import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { listBuilders } from "../domains/builder-admin/builder.server";
import { BuilderList } from "../components/builder-admin/BuilderList";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const builders = await listBuilders(session.shop);
  return { builders };
};

export default function BuildersIndex() {
  const { builders } = useLoaderData<typeof loader>();
  return <BuilderList builders={builders} />;
}
