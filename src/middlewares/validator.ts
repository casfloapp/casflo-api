import type { Context, Next } from 'hono';
import type { ZodSchema } from 'zod';

export function validateJson<T>(schema: ZodSchema<T>) {
  return async (c: Context, next: Next) => {
    const body = await c.req.json().catch(() => null);
    const result = schema.safeParse(body);
    if (!result.success) {
      return c.json(
        {
          error: 'Validation failed',
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        400,
      );
    }
    // attach parsed body
    // @ts-ignore
    c.req.valid = result.data;
    return next();
  };
}
