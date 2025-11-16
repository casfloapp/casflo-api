/**
 * Memanggil Google Gemini 1.5 Flash API.
 * Model ini dioptimalkan untuk kecepatan, yang ideal untuk scan struk.
 */
async function callGeminiAPI(base64Image, apiKey) {
    // 1. Tentukan URL API
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;

    // 2. Hapus header data "data:image/jpeg;base64," dari string base64
    const cleanBase64 = base64Image.split(',')[1];
    
    // 3. Susun Prompt Perintah
    const prompt = `
      Anda adalah asisten pemindai struk yang ahli untuk aplikasi keuangan Casflo.
      Tugas Anda adalah menganalisis gambar struk ini dan mengekstrak informasi berikut:
      1.  "merchant": Nama toko atau merchant (misal: "Indomaret", "KFC", "Alfamart").
      2.  "tanggal": Tanggal transaksi dalam format YYYY-MM-DD.
      3.  "items": Sebuah array dari SETIAP barang yang dibeli. Setiap barang harus memiliki "nama" dan "harga" (sebagai angka, tanpa "Rp" atau ".").

      PENTING:
      - Hanya ekstrak item yang memiliki harga. Jangan ekstrak subtotal, PPN, diskon, atau total akhir sebagai item.
      - Pastikan harga adalah angka integer.
      - Jika Anda tidak bisa menemukan merchant atau tanggal, kembalikan "null" untuk field tersebut.
      - Kembalikan HANYA JSON yang valid. Jangan tambahkan "json" atau "\`\`\`" di awal atau akhir.

      Contoh output JSON yang diinginkan:
      {
        "merchant": "Indomaret",
        "tanggal": "2025-11-16",
        "items": [
          { "nama": "Susu UHT", "harga": 25000 },
          { "nama": "Roti Tawar", "harga": 15000 },
          { "nama": "Sabun Lifebuoy", "harga": 20000 }
        ]
      }
    `;

    // 4. Susun Body Request ke Gemini
    const requestBody = {
        contents: [
            {
                parts: [
                    { "text": prompt }, // Perintah kita
                    {
                        "inline_data": { // Gambar struknya
                            "mime_type": "image/jpeg", // Asumsi jpeg
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

    // 5. Panggil API
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorBody = await response.json();
        console.error("Gemini API Error:", JSON.stringify(errorBody, null, 2));
        throw new Error("Gagal memanggil Google Gemini API.");
    }

    const responseData = await response.json();

    // 6. Ekstrak JSON dari respons AI
    try {
        const jsonText = responseData.candidates[0].content.parts[0].text;
        const result = JSON.parse(jsonText);
        
        // Bersihkan data harga (pastikan semuanya angka)
        if (result.items && Array.isArray(result.items)) {
            result.items = result.items.map(item => ({
                ...item,
                harga: parseInt(String(item.harga).replace(/[^0-9]/g, ''), 10) || 0
            }));
        }

        // Jika tanggal null, gunakan hari ini
        if (!result.tanggal) {
            result.tanggal = new Date().toISOString().split('T')[0];
        }

        return result;
    } catch (e) {
        console.error("Gagal mem-parsing JSON dari Gemini:", e);
        console.error("Raw response from Gemini:", responseData.candidates[0].content.parts[0].text);
        throw new Error("AI mengembalikan data dalam format yang tidak terduga.");
    }
}

/**
 * Fungsi helper untuk mencocokkan nama item dengan kategori (Logika Opsi B - Aman).
 */
function findMatchingCategory(itemName, userCategories) {
    if (!itemName || !userCategories) {
        return null;
    }
    
    const itemNameLower = itemName.toLowerCase();
    
    // Coba cari kecocokan
    const found = userCategories.find(cat => {
        // Cek jika nama kategori (misal: "susu") ada di dalam nama item (misal: "susu uht")
        return itemNameLower.includes(cat.name.toLowerCase());
    });
    
    return found ? found.id : null;
}

/**
 * Fungsi utama yang akan dipanggil oleh router.
 * Menggabungkan panggilan AI dengan logika pencocokan kategori.
 * Disesuaikan untuk Hono (menerima 'c' sebagai context).
 */
export async function processScanRequest(c, env) {
    const body = await c.req.json();
    const { image, wallet_id } = body;
    const userId = c.get('user').id; // Ambil user dari Hono context (asumsi middleware 'protect' Anda menyediakannya)

    if (!image || !wallet_id) {
        throw new Error('Data gambar dan wallet_id diperlukan');
    }
    
    if (!env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY belum diatur di Cloudflare Worker secrets.');
    }

    // 1. Panggil Gemini API
    const scanResult = await callGeminiAPI(image, env.GEMINI_API_KEY);

    // 2. Ambil daftar kategori PENGELUARAN milik pengguna dari D1
    const categoriesStmt = env.DB.prepare(
        "SELECT id, name FROM categories WHERE wallet_id = ? AND type = 'EXPENSE'"
    );
    const { results: userCategories } = await categoriesStmt.bind(wallet_id).all();

    // 3. Cocokkan Kategori (Logika Opsi B)
    const matchedItems = scanResult.items.map(item => {
        const category_id = findMatchingCategory(item.nama, userCategories);
        return {
            ...item,
            category_id: category_id // Akan jadi "cat_123" atau null
        };
    });

    // 4. Kembalikan data yang sudah diproses
    return {
        merchant: scanResult.merchant || "Merchant Tidak Dikenal",
        tanggal: scanResult.tanggal,
        items: matchedItems
    };
}