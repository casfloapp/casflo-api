import type { Env } from '../types';
import { getEnv } from '../config/env';
import { truncate } from '../utils/text';

export interface AiRequest {
  type: 'chat' | 'summary' | 'classification';
  prompt: string;
  system?: string;
}

export interface AiResponse {
  provider: 'openai' | 'gemini';
  model: string;
  content: string;
}

/**
 * Call OpenAI ChatGPT API (gpt-4.1-mini by default)
 */
export async function callOpenAI(env: Env, req: AiRequest): Promise<AiResponse> {
  const cfg = getEnv(env);
  if (!cfg.openAiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  const model = 'gpt-4.1-mini';
  const body = {
    model,
    messages: [
      req.system
        ? { role: 'system', content: req.system }
        : { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: truncate(req.prompt, 8000) },
    ],
  };
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.openAiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }
  const json: any = await res.json();
  const content = json.choices?.[0]?.message?.content ?? '';
  return { provider: 'openai', model, content };
}

/**
 * Call Gemini API (gemini-2.0-flash)
 */
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
        parts: [
          { text: sys },
          { text: truncate(req.prompt, 8000) },
        ],
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
  const content = json.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join(' ') ?? '';
  return { provider: 'gemini', model, content };
}

/**
 * Hybrid router:
 * - short / classification / keyword → Gemini
 * - long / creative text → OpenAI
 */
export async function callHybrid(env: Env, req: AiRequest): Promise<AiResponse> {
  const len = req.prompt.length;
  // simple heuristic: short texts or type classification → Gemini
  if (req.type === 'classification' || len < 400) {
    try {
      return await callGemini(env, req);
    } catch {
      return await callOpenAI(env, req);
    }
  }
  // longer text → OpenAI, fallback Gemini
  try {
    return await callOpenAI(env, req);
  } catch {
    return await callGemini(env, req);
  }
}
