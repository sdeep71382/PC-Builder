# Storefront PC Builder Proxy Debug

## Current Symptom

The storefront theme app extension renders the PC Builder block shell, then shows:

```text
Builder unavailable
Status 400: unavailable (/apps/pc-builder)
```

This proves:

- The theme app extension block is installed and rendering.
- `pc-builder.js` is loading and running.
- The widget is attempting to fetch `/apps/pc-builder`.
- The fetch receives HTTP `400`.
- The response body is not the app's structured JSON error, otherwise the widget would show a specific `reason`.

## Error Boundaries

1. Theme block registration
   - Expected: Shopify renders `blocks/pc-builder.liquid`.
   - Evidence: The block UI appears in the storefront.
   - Status: Passing.

2. Theme asset loading
   - Expected: `pc-builder.js` runs.
   - Evidence: The JavaScript-created fallback UI appears.
   - Status: Passing.

3. Browser fetch path
   - Expected: Widget fetches the configured app proxy path.
   - Evidence: UI reports `/apps/pc-builder`.
   - Status: Passing.

4. Shopify app proxy forwarding
   - Expected: Storefront request to `/apps/pc-builder` forwards to the dev tunnel app URL with Shopify proxy query parameters.
   - Evidence needed: Network request URL, status, response body, and app dev logs.
   - Status: Unverified.

5. React Router route matching
   - Expected: `/apps/pc-builder` resolves to `app/routes/apps.pc-builder._index.tsx`.
   - Evidence needed: Direct local request or route manifest/build output.
   - Status: Build output confirms route exists; runtime still needs verification.

6. App proxy authentication
   - Expected: `authenticate.public.appProxy(request)` succeeds, or controlled fallback extracts a valid `.myshopify.com` shop and loads the offline session.
   - Evidence needed: Server logs showing signed auth success/failure and fallback shop/session result.
   - Status: Unverified in live dev server.

7. Default builder lookup
   - Expected: Database has a published default builder for the request shop.
   - Evidence: Local Prisma read shows `Default PC Builder`, `status=published`, `isDefault=true`, `7` steps.
   - Status: Passing locally.

8. Shopify collection/product loading
   - Expected: Assigned collections can be read with Admin GraphQL.
   - Evidence needed: Server logs or route response after auth succeeds.
   - Status: Unverified for storefront route.

## Hypotheses To Test

1. Shopify is forwarding to an older Cloudflare tunnel or older app process.
2. Shopify app proxy is not updating the destination URL/path despite local config changes.
3. The request reaches the app but React Router or Shopify auth throws a framework `400` before route JSON.
4. The current storefront request lacks the expected `shop` query parameter, so fallback cannot identify tenant.
5. The app dev process is stale and not running the newest route/helper code.

## Verified Evidence

### 2026-08-30

Clean `shopify app dev` startup after stopping stale process on `127.0.0.1:9293`:

```text
✅ Ready, watching for changes in your app
Using URL: https://combinations-bryan-lambda-standards.trycloudflare.com/apps/pc-builder
No pending migrations to apply.
React Router Local: http://localhost:50749/
```

Local direct request to the running React Router server:

```text
GET http://localhost:50749/apps/pc-builder?shop=pc-builder-app.myshopify.com
HTTP/1.1 200
```

Result:

- Returned full builder JSON.
- Loaded `Default PC Builder`.
- Included published builder public ID.
- Included enabled steps and Shopify product/variant data.

Server logs for the local direct request:

```text
PC Builder storefront request received {
  origin: 'http://localhost:50749',
  pathname: '/apps/pc-builder',
  hasShop: true,
  hasSignature: false,
  hasHmac: false
}
PC Builder signed app proxy authentication failed
PC Builder offline storefront session loaded { shop: 'pc-builder-app.myshopify.com' }
```

This proves:

- React Router route matching works.
- The fallback storefront auth works when `shop` is present.
- The default builder query works.
- Shopify Admin GraphQL product loading works.
- The current failure is not in the local route, database, or builder data.

Storefront browser still shows:

```text
Status 400: unavailable (/apps/pc-builder)
```

No matching `PC Builder storefront request received` log appears in the running `shopify app dev` terminal for that browser request.

## Confirmed external configuration failure

The Shopify Dev Dashboard version used by the storefront was inspected after the
latest failed request. Its App Proxy was still configured as:

```text
https://example.com/apps/pc-builder
```

That is the template placeholder from `shopify.app.toml`, not the current
Cloudflare URL printed by `shopify app dev`. The browser request therefore never
reaches the local React Router server. This is why the local request can return
the builder successfully while the storefront block receives HTTP 400/404.

This cannot be corrected by the widget JavaScript or an app route. Shopify must
refresh the dev app version and its App Proxy target.

### Required recovery procedure

1. Stop every old `shopify app dev` process. On Windows, check `netstat -ano | findstr :9293` and stop only the stale Node process that owns port 9293.
2. Run `shopify app dev clean` from this repository.
3. Start one fresh `shopify app dev` session and wait for `Ready, watching for changes in your app`.
4. Open the install/preview URL printed by that same terminal and complete the install or reauthorization flow.
5. In the Shopify theme editor, remove the existing PC Builder block, add it again, and save the theme. This refreshes the block asset/configuration after the preview URL changes.
6. Reload the storefront. A successful request will produce `PC Builder storefront request received` in the same dev terminal.

If the Dev Dashboard still shows `example.com` after step 3, the app is using a
different linked configuration. Run `shopify app config link`, select the app
whose client ID is `05dc69348e7ba7728610b0f7e81c54a0`, then repeat steps 2-5.

This means the live storefront request is not reaching the current local app process. The likely failing boundary is Shopify app proxy configuration/dev-preview forwarding.

## Current Root Cause Boundary

The code path works locally, but Shopify storefront `/apps/pc-builder` is not being forwarded into the current `shopify app dev` process.

Most likely causes:

1. The store has stale app proxy configuration from an older app install.
2. The dev preview is stale and still points to an older Cloudflare tunnel.
3. The app proxy path was initialized before `write_app_proxy` or before the current proxy path existed, and needs reinstall/reinitialization.
4. The storefront tab is not using the active dev preview generated by the current `shopify app dev` session.

## Manual Evidence Needed If Local Tools Cannot Access Browser

In Chrome DevTools Network:

1. Clear the Network filter text.
2. Click the PC Builder block's `Retry` button.
3. Find the request named `pc-builder` or `/apps/pc-builder`.
4. Open it and capture:
   - Request URL
   - Status code
   - Response body / Preview
   - Response headers, especially `content-type`

In the terminal running `shopify app dev`, capture lines printed at the same time as Retry.
