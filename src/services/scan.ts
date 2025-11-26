import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';

function base64ToPart(base64Data, mimeType) {
  return { inlineData: { data: base64Data.includes(',') ? base64Data.split(',')[1] : base64Data, mimeType } };
}

function buildPrompt(categories) {
  const list = categories.map(c => `- ${c.name} (id: ${c.id})`).join('\n');
  return `Anda adalah AI pemindai struk Casflo. Ekstrak JSON:\n{\n  "merchant": string,\n  "tanggal": "YYYY-MM-DD",\n  "items": [\n    { "nama": string, "harga": number, "category_id": string | null }\n  ]\n}\nKategori user:\n${list}\nBalas hanya JSON valid.`;
}

function parseScanJSON(text) {
  try {
    const json = JSON.parse(text);
    if (Array.isArray(json.items)) {
      json.items = json.items.map(i => ({ ...i, harga: parseInt(String(i.harga).replace(/\D/g, '')) || 0, category_id: i.category_id || null }));
    }
    if (!json.tanggal) json.tanggal = new Date().toISOString().split('T')[0];
    return json;
  } catch (e) {
    throw new Error('Invalid JSON from AI: ' + e.message);
  }
}

export async function callGemini(base64Image, apiKey, categories) {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildPrompt(categories);
  const imagePart = base64ToPart(base64Image, 'image/jpeg');
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ parts: [{ text: prompt }, imagePart] }],
    config: {
      responseMimeType: 'application/json',
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE }
      ]
    }
  });
  const text = response.text;
  return parseScanJSON(text);
}

export async function callChatGPT(base64Image, apiKey, categories) {
  const prompt = buildPrompt(categories);
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input: [{ role: 'user', content: [{ type:'text', text: prompt }, { type:'input_image', image_url: { uri: base64Image } }] }],
      max_output_tokens: 1200
    })
  });
  const data = await res.json();
  const text = data.output_text || (data.output && data.output[0] && data.output[0].content && data.output[0].content[0] && data.output[0].content[0].text) || JSON.stringify(data);
  return parseScanJSON(text);
}
