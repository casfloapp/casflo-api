// [PERBAIKAN FINAL UNTUK FILE: casflo-api/src/lib/gemini.js]

/**
 * Memanggil Google Gemini API.
 */
async function callGeminiAPI(base64Image, apiKey, userCategories = []) {
    
    // [PERBAIKAN KUNCI DI SINI] Mengganti nama model ke 'gemini-pro-vision'
 // [BARIS BARU YANG BENAR]
    const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
 
    const cleanBase64 = base64Image.split(',')[1];
    
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

    // [CATATAN] Request body untuk 'gemini-pro-vision' sedikit berbeda
    // Kita harus mengirim gambar dan teks dalam satu 'parts' array.
    const requestBody = {
        contents: [
            {
                parts: [
                    { "text": prompt }, // Perintah teks
                    {
                        "inline_data": { // Gambar
                            "mime_type": "image/jpeg",
                            "data": cleanBase64
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json" 
        }
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("Gemini API Error:", JSON.stringify(errorBody, null, 2));
        const details = errorBody.error?.message || "Gagal memanggil Google Gemini API.";
        throw new Error(details);
    }

    const responseData = await response.json();

    try {
        // Validasi respons
        if (!responseData.candidates || !responseData.candidates[0].content || !responseData.candidates[0].content.parts[0].text) {
             throw new Error("Respons AI tidak berisi teks JSON yang diharapkan.");
        }
        
        const jsonText = responseData.candidates[0].content.parts[0].text;
        const result = JSON.parse(jsonText);
        
        if (result.items && Array.isArray(result.items)) {
            result.items = result.items.map(item => ({
                ...item,
                harga: parseInt(String(item.harga).replace(/[^0-9]/g, ''), 10) || 0,
                category_id: item.category_id || null 
            }));
        }

        if (!result.tanggal) {
            result.tanggal = new Date().toISOString().split('T')[0];
        }
        return result;
    } catch (e) {
        console.error("Gagal mem-parsing JSON dari Gemini:", e);
        if(responseData.candidates[0].content.parts[0].text) {
             console.error("Raw response from Gemini:", responseData.candidates[0].content.parts[0].text);
        }
        throw new Error("AI mengembalikan data dalam format yang tidak terduga.");
    }
}

/**
 * Fungsi utama yang dipanggil oleh router.
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

    // 1. Ambil daftar kategori PENGELUARAN milik pengguna dari D1
    const categoriesStmt = env.DB.prepare(
        "SELECT id, name FROM categories WHERE wallet_id = ? AND type = 'EXPENSE'"
    );
    const { results: userCategories } = await categoriesStmt.bind(wallet_id).all();

    // 2. Panggil Gemini API dan KIRIMKAN daftar kategori
    const scanResult = await callGeminiAPI(image, env.GEMINI_API_KEY, userCategories);

    // 3. Kembalikan data (sudah termasuk category_id dari AI)
    return {
        merchant: scanResult.merchant || "Merchant Tidak Dikenal",
        tanggal: scanResult.tanggal,
        items: scanResult.items
    };
}