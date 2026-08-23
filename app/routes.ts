import { flatRoutes } from "@react-router/fs-routes";

export default flatRoutes({
  ignoredRouteFiles: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
});
