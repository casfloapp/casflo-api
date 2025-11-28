export const dbAll = async (env: Env, sql: string, params: any[] = []) => {
  const res = await env.DB.prepare(sql).bind(...params).all();
  return res.results ?? [];
};

export const dbGet = async (env: Env, sql: string, params: any[] = []) => {
  const res = await env.DB.prepare(sql).bind(...params).first();
  return res ?? null;
};

export const dbRun = async (env: Env, sql: string, params: any[] = []) => {
  return await env.DB.prepare(sql).bind(...params).run();
};
