import { getHiddenAdminRoute } from "../../shared/admin-paths.ts";

export const hiddenAdminRoute = getHiddenAdminRoute(
  import.meta.env.VITE_HIDDEN_ADMIN_PATH,
);
