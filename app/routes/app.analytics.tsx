import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { getBuildAnalytics, type AnalyticsRange } from "../domains/build-sessions/analytics.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const range = new URL(request.url).searchParams.get("range");
  const selected: AnalyticsRange = range === "7d" || range === "all" ? range : "30d";
  return getBuildAnalytics(session.shop, selected);
}

export default function Analytics() {
  const data = useLoaderData<typeof loader>();
  const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" });
  return <s-page heading="Builder analytics">
    <div className="builder-admin">
      <div className="builder-admin__header"><div><p className="builder-admin__eyebrow">Performance</p><h1 className="builder-admin__title">Builder analytics</h1><p className="builder-admin__subtitle">Track validated builds, cart additions, and attributed orders from your builders.</p></div><div className="builder-admin__actions"><s-button href="/app/analytics?range=7d">7 days</s-button><s-button href="/app/analytics?range=30d">30 days</s-button><s-button href="/app/analytics?range=all">All time</s-button></div></div>
      <div className="builder-admin__grid builder-admin__grid--two">
        <Metric label="Validated builds" value={String(data.validated)} />
        <Metric label="Added to cart" value={String(data.addedToCart)} />
        <Metric label="Purchased builds" value={String(data.purchasedBuilds)} />
        <Metric label="Attributed orders" value={String(data.attributedOrders)} />
        <Metric label="Attributed revenue" value={money.format(data.attributedRevenue)} />
        <Metric label="Average build value" value={money.format(data.averageBuildValue)} />
      </div>
      <div className="builder-card"><h2 className="builder-card__title">Builder performance</h2>{data.breakdown.length === 0 ? <p className="builder-card__text">No attributed orders in this period.</p> : <div className="builder-table-wrap"><table className="builder-table"><thead><tr><th>Builder</th><th>Validated</th><th>Cart adds</th><th>Purchased</th><th>Orders</th><th>Revenue</th></tr></thead><tbody>{data.breakdown.map((row) => <tr key={row.builderId}><td>{row.builderName}</td><td>{row.validated}</td><td>{row.addedToCart}</td><td>{row.purchasedBuilds}</td><td>{row.attributedOrders}</td><td>{money.format(row.revenue)}</td></tr>)}</tbody></table></div>}</div>
      <div className="builder-card"><h2 className="builder-card__title">Recent attributed orders</h2>{data.recentOrders.length === 0 ? <p className="builder-card__text">No attributed orders yet. Orders completed through the PC Builder will appear here after Shopify sends the order webhook.</p> : <div className="builder-table-wrap"><table className="builder-table"><thead><tr><th>Order</th><th>Builder</th><th>Build session</th><th>Value</th><th>Date</th></tr></thead><tbody>{data.recentOrders.map((row) => <tr key={`${row.shopifyOrderId}-${row.buildSessionId}`}><td>{row.shopifyOrderName ?? row.shopifyOrderId}</td><td>{row.builder.name}</td><td>{row.buildSessionId}</td><td>{money.format(Number(row.attributedValue ?? 0))}</td><td>{new Date(row.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>}</div>
    </div>
  </s-page>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="builder-card builder-card--equal"><h2 className="builder-card__title">{label}</h2><p className="builder-admin__title">{value}</p></div>; }
