export default function AdditionalPage() {
  return (
    <s-page heading="Builder Administration Help">
      <s-section heading="Managing builders">
        <s-paragraph>
          Use the Builders section to create, edit, and manage your
          PC-building experiences. Each builder can have multiple ordered steps,
          and each step can reference existing Shopify products or variants.
        </s-paragraph>
      </s-section>

      <s-section heading="Steps">
        <s-paragraph>
          Steps define the flow customers follow when selecting products. You
          can reorder steps, enable or disable them, and mark them as required
          or optional.
        </s-paragraph>
      </s-section>

      <s-section heading="Catalog assignments">
        <s-paragraph>
          Assign existing Shopify products and variants to steps so merchants
          can curate selectable commerce items for each stage of the builder.
          Shopify remains the source of truth for product and variant details.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}
