import { Context, Next } from "hono";

export const errorHandler = async (c: Context, next: Next) => {
  try {
    await next(); // Process request

  } catch (err: any) {
    console.error("🔥 API ERROR:", {
      message: err?.message,
      stack: err?.stack,
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString()
    });

    return c.json({
      success: false,
      error: err?.message ?? "Internal Server Error",
      path: c.req.path,
      method: c.req.method,
      timestamp: new Date().toISOString()
    }, 500);
  }
};
