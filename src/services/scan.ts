type Category = { id: string; name: string };

function stripBase64Prefix(data: string): string {
  if (!data) return data;
  const parts = data.split(',');
  return parts.length > 1 ? parts[1] : parts[0];
}

function buildPrompt(categories: Category[]): string {
  const list = (categories || [])
    .map((c) => `- ${c.name} (id: ${c.id})`)
    .join('\n');
  return `Anda adalah AI pemindai struk Casflo. Ekstrak JSON dengan format:\n\n{
  "merchant": string,
  "tanggal": "YYYY-MM-DD",
  "items": [
    { "nama": string, "harga": number, "category_id": string | null }
  ]
}

Daftar kategori pengeluaran pengguna:
${list}

Aturan:
- Balas HANYA JSON valid, tanpa penjelasan.
- Jangan masukkan subtotal/PPN/total sebagai item.
- harga dalam integer (tanpa Rp, titik, koma).
- Jika tidak ada kategori cocok, gunakan "category_id": null.`;
}

function normalizeScanResult(rawText: string) {
  let json: any;
  try {
    json = JSON.parse(rawText);
  } catch (e: any) {
    throw new Error('Invalid JSON from AI: ' + e.message);
  }
  if (Array.isArray(json.items)) {
    json.items = json.items.map((i: any) => ({
      ...i,
      harga: parseInt(String(i.harga).replace(/\D/g, ''), 10) || 0,
      category_id: i.category_id || null,
    }));
  } else {
    json.items = [];
  }
  if (!json.tanggal) {
    json.tanggal = new Date().toISOString().split('T')[0];
  }
  if (!json.merchant) {
    json.merchant = 'Merchant Tidak Dikenal';
  }
  return json;
}

export async function callGeminiREST(base64Image: string, apiKey: string, categories: Category[]) {
  const prompt = buildPrompt(categories);
  const imageData = stripBase64Prefix(base64Image);

  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' +
      encodeURIComponent(apiKey),
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: imageData,
                },
              },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: 'application/json',
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error('Gemini HTTP error: ' + res.status + ' ' + text);
  }
  const json = await res.json();
  const textPart =
    json?.candidates?.[0]?.content?.parts?.[0]?.text ||
    json?.candidates?.[0]?.content?.parts?.[0]?.rawText ||
    JSON.stringify(json);
  return normalizeScanResult(textPart);
}

export async function callOpenAIREST(base64Image: string, apiKey: string, categories: Category[]) {
  const prompt = buildPrompt(categories);
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            {
              type: 'input_image',
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      max_output_tokens: 1200,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('OpenAI HTTP error: ' + res.status + ' ' + txt);
  }
  const data = await res.json();
  const text =
    data?.output_text ||
    data?.output?.[0]?.content?.[0]?.text ||
    JSON.stringify(data);
  return normalizeScanResult(text);
}

export async function processScanRequest(c: any, env: Env) {
  const body = await c.req.json();
  const { image, book_id, provider = 'gemini' } = body || {};

  if (!image || !book_id) {
    throw new Error('image dan book_id wajib diisi');
  }

  const stmt = env.DB.prepare(
    "SELECT id, name FROM categories WHERE book_id = ? AND type = 'EXPENSE'"
  );
  const { results } = await stmt.bind(book_id).all();
  const categories = (results || []) as Category[];

  if (provider === 'chatgpt') {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY belum diset');
    }
    const result = await callOpenAIREST(image, env.OPENAI_API_KEY, categories);
    return result;
  } else {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY belum diset');
    }
    const result = await callGeminiREST(image, env.GEMINI_API_KEY, categories);
    return result;
  }
}
