import type { Env } from '../types';
import type { AiRequest, AiResponse } from './chatgpt';
import { callOpenAI } from './chatgpt';
import { callGemini } from './gemini';

export async function callHybrid(env: Env, req: AiRequest): Promise<AiResponse> {
  const len = req.prompt.length;

  // pendek / classification → coba Gemini dulu
  if (req.type === 'classification' || len < 400) {
    try {
      return await callGemini(env, req);
    } catch {
      return await callOpenAI(env, req);
    }
  }

  // panjang → coba OpenAI dulu
  try {
    return await callOpenAI(env, req);
  } catch {
    return await callGemini(env, req);
  }
}
