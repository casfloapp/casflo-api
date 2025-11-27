import type { Env } from '../types';
import { getEnv } from '../config/env';
import { truncate } from '../utils/text';
import type { AiRequest, AiResponse } from './chatgpt';

export async function callGemini(env: Env, req: AiRequest): Promise<AiResponse> {
  const cfg = getEnv(env);
  if (!cfg.geminiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }
  const model = 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cfg.geminiKey}`;
  const sys = req.system || 'You are a helpful assistant.';
  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: sys }, { text: truncate(req.prompt, 8000) }],
      },
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }
  const json: any = await res.json();
  const content =
    json.candidates?.[0]?.content?.parts
      ?.map((p: any) => p.text)
      .join(' ') ?? '';
  return { provider: 'gemini', model, content };
}
