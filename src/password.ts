async function hashPasswordInternal(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(password + salt);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(digest));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hashHex}`;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  return hashPasswordInternal(password, salt);
}

export async function comparePassword(password: string, hashed: string): Promise<boolean> {
  const [salt, hash] = hashed.split(':');
  const hashedAttempt = await hashPasswordInternal(password, salt);
  return hashedAttempt === hashed;
}
