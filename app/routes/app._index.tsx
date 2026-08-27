import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  void request;
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await request.formData();
  return null;
};

export default function Index() {
  return (
    <s-page heading="PC Builder">
      <div className="builder-admin">
        <div className="builder-admin__header builder-admin__header--hero">
          <div>
            <p className="builder-admin__eyebrow">Merchant setup</p>
            <h1 className="builder-admin__title">Set up your product builder</h1>
            <p className="builder-admin__subtitle">
              Create a guided buying flow by choosing a builder, defining the customer
              steps, and connecting each step to real Shopify collections.
            </p>
          </div>
          <div className="builder-admin__actions">
            <s-button variant="primary" href="/app/builders">
              Continue setup
            </s-button>
            <s-button href="/app/builders/new">Create builder</s-button>
          </div>
        </div>

        <div className="builder-admin__grid builder-admin__grid--two builder-admin__grid--top">
          <div className="builder-card builder-card--setup">
            <h2 className="builder-card__title">Guide</h2>
            <div className="builder-setup-list">
              <div className="builder-setup-step">
                <span className="builder-setup-step__number">1</span>
                <span>
                  <strong>Choose a builder</strong>
                  <small>Open the default builder or create a new one.</small>
                </span>
              </div>
              <div className="builder-setup-step">
                <span className="builder-setup-step__number">2</span>
                <span>
                  <strong>Review steps</strong>
                  <small>Steps are the customer choices in order.</small>
                </span>
              </div>
              <div className="builder-setup-step">
                <span className="builder-setup-step__number">3</span>
                <span>
                  <strong>Assign collections</strong>
                  <small>Connect each step to the right Shopify collection.</small>
                </span>
              </div>
              <div className="builder-setup-step">
                <span className="builder-setup-step__number">4</span>
                <span>
                  <strong>Publish when ready</strong>
                  <small>Keep builders draft until the setup is complete.</small>
                </span>
              </div>
            </div>
          </div>

          <div className="builder-card builder-card--setup">
            <h2 className="builder-card__title">Setup path</h2>
            <p className="builder-card__text">
              Start from the builders list. Choose a builder, open its steps, then
              configure collections from the step that needs catalog items.
            </p>
            <div className="builder-flow-preview" aria-label="Setup path">
              <span>Builders</span>
              <span>Builder details</span>
              <span>Manage steps</span>
              <span>Configure collections</span>
              <span>Publish</span>
            </div>
          </div>
        </div>

        <div className="builder-admin__grid builder-admin__grid--two">
          <div className="builder-card builder-card--equal">
            <h2 className="builder-card__title">How merchants should think about steps</h2>
            <p className="builder-card__text">
              A step is one customer decision. It can be a component, service, warranty,
              accessory, or any other choice. The engine stays generic, so merchants are
              free to rename and reorder steps for their store.
            </p>
          </div>
          <div className="builder-card builder-card--equal">
            <h2 className="builder-card__title">Next action</h2>
            <p className="builder-card__text">
              Open a builder, review its steps, then use Configure collections on each
              step to connect the real Shopify catalog.
            </p>
          </div>
        </div>
      </div>
    </s-page>
  );
}
