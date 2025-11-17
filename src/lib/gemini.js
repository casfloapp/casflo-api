// [PERBAIKAN ADAPTASI SDK v3 UNTUK FILE: casflo-api/src/lib/gemini.js]

// [PERBAIKAN 1] Kita impor dari '@google/genai/node'
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/genai/node";

/**
 * Mengonversi Base64 ke format yang dimengerti oleh SDK @google/genai
 */
function base64ToGenerativePart(base64Data, mimeType) {
    return {
        inlineData: {
            data: base64Data.split(',')[1], // Hapus prefix "data:image/jpeg;base64,"
            mimeType
        },
    };
}

/**
 * Memanggil Google Gemini API menggunakan SDK @google/genai.
 */
async function callGeminiAPI(base64Image, apiKey, userCategories = []) {
    
    const ai = new GoogleGenerativeAI(apiKey);
    
    // [PERBAIKAN 2] Konfigurasi model HANYA berisi nama model dan safetySettings
    const model = ai.getGenerativeModel({
        model: "gemini-1.5-flash",
        safetySettings: [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        // generationConfig (yang menyebabkan error Anda sebelumnya) dipindahkan dari sini
    });

    const categoriesPromptString = userCategories.map(cat => `- ${cat.name} (id: ${cat.id})`).join('\n');

    const prompt = `
      Anda adalah asisten pemindai struk yang ahli untuk aplikasi keuangan Casflo.
      Tugas Anda adalah menganalisis gambar struk ini dan mengekstrak informasi berikut:
      1.  "merchant": Nama toko atau merchant (misal: "Indomaret", "KFC").
      2.  "tanggal": Tanggal transaksi dalam format YYYY-MM-DD.
      3.  "items": Sebuah array dari SETIAP barang yang dibeli.

      Ini adalah daftar kategori PENGELUARAN yang dimiliki pengguna:
      [START_KATEGORI]
      ${categoriesPromptString}
      [END_KATEGORI]

      PENTING:
      - Untuk setiap item, tentukan "category_id" yang paling relevan dari daftar di atas.
      - Jika tidak ada kategori yang cocok, kembalikan "category_id": null.
      - Pastikan harga adalah angka integer (tanpa "Rp" atau ".").
      - Jangan ekstrak subtotal, PPN, atau total sebagai item.
      - Kembalikan HANYA JSON yang valid.

      Contoh output JSON yang diinginkan:
      {
        "merchant": "Alfamart",
        "tanggal": "2025-11-16",
        "items": [
          { "nama": "Susu UHT Coklat", "harga": 25000, "category_id": "cat_makanan_minuman" },
          { "nama": "Roti Tawar", "harga": 15000, "category_id": "cat_makanan_minuman" },
          { "nama": "Biaya Parkir", "harga": 2000, "category_id": "cat_transportasi" }
        ]
      }
    `;

    const imagePart = base64ToGenerativePart(base64Image, "image/jpeg");
    const promptPart = { text: prompt };

    try {
        // [PERBAIKAN 3] ...dan 'generationConfig' dipindahkan ke SINI
        const result = await model.generateContent({
            contents: [{ parts: [promptPart, imagePart] }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        });
        
        const response = result.response;
        if (!response) {
            throw new Error("AI tidak memberikan respons.");
        }
        
        const jsonText = response.text();
        const scanResult = JSON.parse(jsonText);

        // 6. Proses hasil
        if (scanResult.items && Array.isArray(scanResult.items)) {
            scanResult.items = scanResult.items.map(item => ({
                ...item,
                harga: parseInt(String(item.harga).replace(/[^0-9]/g, ''), 10) || 0,
                category_id: item.category_id || null 
            }));
        }
        if (!scanResult.tanggal) {
            scanResult.tanggal = new Date().toISOString().split('T')[0];
        }
        return scanResult;

    } catch (error) {
        console.error("Error memanggil Gemini SDK:", error);
        if (error.message.includes('BLOCKED_BY_SAFETY')) {
            throw new Error("Gambar diblokir oleh filter keamanan Google. Coba gambar lain.");
        }
        throw new Error(`Error dari Gemini SDK: ${error.message}`);
    }
}

/**
 * Fungsi utama yang dipanggil oleh router. (Tidak berubah)
 */
export async function processScanRequest(c, env) {
    const body = await c.req.json();
    const { image, wallet_id } = body;

    if (!image || !wallet_id) {
        throw new Error('Data gambar dan wallet_id diperlukan');
    }
    
    if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY belum diatur di Cloudflare Worker secrets.');
    }

    const categoriesStmt = env.DB.prepare(
        "SELECT id, name FROM categories WHERE wallet_id = ? AND type = 'EXPENSE'"
    );
    const { results: userCategories } = await categoriesStmt.bind(wallet_id).all();

    const scanResult = await callGeminiAPI(image, env.GEMINI_API_KEY, userCategories);

    return {
        merchant: scanResult.merchant || "Merchant Tidak Dikenal",
        tanggal: scanResult.tanggal,
        items: scanResult.items
    };
}