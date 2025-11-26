const encoder = new TextEncoder();

export const randomSalt = (len = 16) => {
  const arr = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const deriveKeyHex = async (password: string, saltHex: string, iterations = 80000) => {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g).map(h => parseInt(h, 16)));
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, keyMaterial, 256);
  const arr = new Uint8Array(bits);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
};

export const verifyPassword = async (password: string, saltHex: string, expectedHash: string) => {
  const derived = await deriveKeyHex(password, saltHex);
  return derived === expectedHash;
};
