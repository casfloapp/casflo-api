import { z } from 'zod';
export const validate = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw r.error;
  return r.data;
};
