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

export async function callOpenAI(env: Env, req: AiRequest): Promise<AiResponse> {
  const cfg = getEnv(env);
  if (!cfg.openAiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }
  const model = 'gpt-4.1-mini';
  const body = {
    model,
    messages: [
      {
        role: 'system',
        content: req.system || 'You are a helpful assistant.',
      },
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
