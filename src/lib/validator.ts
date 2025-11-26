import { z } from "zod";
export const validate = (schema: z.ZodTypeAny, data: any) => {
  const r = schema.safeParse(data);
  if (!r.success) throw r.error;
  return r.data;
};
