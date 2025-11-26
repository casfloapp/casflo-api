import { verifyAccessToken } from "../lib/jwt";

export const requireAuth = () => {
  return async (c, next) => {
    try {
      const header = c.req.headers.get("Authorization") || "";
      const m = header.match(/Bearer (.+)/);
      if (!m) return c.text(JSON.stringify({ status: "error", message: "No auth" }), 401);
      const payload = await verifyAccessToken(m[1], c.env);
      c.set("user", payload);
      await next();
    } catch (e) {
      return c.text(JSON.stringify({ status: "error", message: "Unauthorized" }), 401);
    }
  };
};
