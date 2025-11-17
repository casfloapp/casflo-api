// [PERBAIKAN ADAPTASI SDK TERBARU UNTUK FILE: casflo-api/src/lib/gemini.js]

// [PERBAIKAN] Impor GoogleGenAI, bukan GoogleGenerativeAI
import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai/node";

/**
 * Mengonversi Base64 ke format yang dimengerti oleh SDK @google/genai
 */
function base64ToGenerativePart(base64Data, mimeType) {
    return {
        inlineData: {
            // Hapus prefix jika ada (kode Anda sudah benar)
            data: base64Data.includes(',') ? base64Data.split(',')[1] : base64Data,
            mimeType
        },
    };
}

/**
 * Memanggil Google Gemini API menggunakan SDK @google/genai versi terbaru.
 */
async function callGeminiAPI(base64Image, apiKey, userCategories = []) {

    // [PERBAIKAN] Inisialisasi menggunakan new GoogleGenAI({ apiKey })
    const ai = new GoogleGenAI({ apiKey: apiKey });

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
        // [PERBAIKAN] Panggilan API disederhanakan menjadi satu fungsi.
        // Konfigurasi seperti responseMimeType dan safetySettings dimasukkan ke dalam objek `config`.
        const response = await ai.models.generateContent({
            // [PERBAIKAN] Gunakan model yang direkomendasikan
            model: 'gemini-2.5-flash',
            contents: [{ parts: [promptPart, imagePart] }],
            // [PERBAIKAN] 'generationConfig' diubah menjadi 'config'
            config: {
                responseMimeType: "application/json",
                safetySettings: [
                    { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                    { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                ],
            }
        });

        // [PERBAIKAN] Akses teks lebih mudah dengan properti .text
        const jsonText = response.text;
        if (!jsonText) {
            throw new Error("AI tidak memberikan respons teks.");
        }

        const scanResult = JSON.parse(jsonText);

        // Logika bisnis Anda (sudah benar, tidak perlu diubah)
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
         if (error instanceof SyntaxError) {
            throw new Error("Gagal mem-parsing respons dari AI. Mungkin bukan JSON yang valid.");
        }
        throw new Error(`Error dari Gemini SDK: ${error.message}`);
    }
}