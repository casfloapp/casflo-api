import { z } from 'zod';

export const validate = <T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> => {
  const r = schema.safeParse(data);
  if (!r.success) throw r.error;
  return r.data;
};
