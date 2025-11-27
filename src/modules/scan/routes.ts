import { Hono } from 'hono';
import type { Env } from '../../types';
import { authMiddleware } from '../../middlewares/auth';
import { callHybrid } from '../../ai/hybrid';
import { callOpenAI } from '../../ai/chatgpt';
import { callGemini } from '../../ai/gemini';

export const scanRoutes = new Hono<{ Bindings: Env }>();

scanRoutes.use('*', authMiddleware);

/**
 * POST /scan/receipt
 * Body:
 * {
 *   "text": "raw receipt text (hasil OCR dari client)",
 *   "model": "auto" | "gpt" | "gemini",
 *   "currency": "IDR" (optional, default IDR),
 *   "language": "id" | "en" (optional, default id)
 * }
 *
 * Catatan: endpoint ini mengharapkan teks hasil scan (OCR) dari mobile app.
 * Di server, kita pakai Gemini / GPT untuk parsing menjadi struktur JSON.
 */
scanRoutes.post('/receipt', async (c) => {
  const body = await c.req.json<{
    text: string;
    model?: 'auto' | 'gpt' | 'gemini';
    currency?: string;
    language?: string;
  }>().catch(() => null);

  if (!body || !body.text) {
    return c.json({ error: 'text (receipt raw text) is required' }, 400);
  }

  const model = body.model || 'auto';
  const currency = body.currency || 'IDR';
  const language = body.language || 'id';

  const systemPrompt =
    language === 'id'
      ? `Kamu adalah AI yang ahli membaca struk belanja dalam bahasa Indonesia.
Ekstrak STRUK berikut menjadi JSON dengan format:
{
  "merchant": string | null,
  "date": string | null,        // format YYYY-MM-DD jika bisa
  "items": [
    { "name": string, "qty": number | null, "price": number | null }
  ],
  "subtotal": number | null,
  "tax": number | null,
  "total": number,
  "currency": "${currency}"
}
Jawab HANYA dengan JSON valid.`
      : `You are an AI expert in reading shopping receipts.
Parse the RECEIPT into JSON with shape:
{
  "merchant": string | null,
  "date": string | null,        // format YYYY-MM-DD if possible
  "items": [
    { "name": string, "qty": number | null, "price": number | null }
  ],
  "subtotal": number | null,
  "tax": number | null,
  "total": number,
  "currency": "${currency}"
}
Respond with ONLY valid JSON.`;

  const prompt =
    (language === 'id'
      ? 'Berikut isi struk belanja (hasil OCR):\n\n'
      : 'Here is the receipt text (OCR result):\n\n') + body.text;

  let aiRes;
  if (model === 'gpt') {
    aiRes = await callOpenAI(c.env, {
      prompt,
      type: 'classification',
      system: systemPrompt,
    });
  } else if (model === 'gemini') {
    aiRes = await callGemini(c.env, {
      prompt,
      type: 'classification',
      system: systemPrompt,
    });
  } else {
    aiRes = await callHybrid(c.env, {
      prompt,
      type: 'classification',
      system: systemPrompt,
    });
  }

  // coba parse JSON; kalau gagal, kembalikan raw text
  try {
    const parsed = JSON.parse(aiRes.content);
    return c.json({
      provider: aiRes.provider,
      model: aiRes.model,
      parsed,
    });
  } catch {
    return c.json({
      provider: aiRes.provider,
      model: aiRes.model,
      raw: aiRes.content,
      note: 'AI did not respond with valid JSON; please inspect raw field.',
    });
  }
});
