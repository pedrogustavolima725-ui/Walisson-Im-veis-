import crypto from 'node:crypto';

/* ------------------------------------------------------------------ */
/* Senhas — scrypt (memory-hard) com salt aleatório por usuário        */
/* ------------------------------------------------------------------ */
const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) => {
    crypto.scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT, (err, key) => {
      if (err) return reject(err);
      resolve(`scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${key.toString('base64')}`);
    });
  });
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, N, r, p, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt') return Promise.resolve(false);
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(keyB64, 'base64');
  const params = { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem };
  return new Promise((resolve) => {
    crypto.scrypt(password.normalize('NFKC'), salt, expected.length, params, (err, key) => {
      if (err) return resolve(false);
      resolve(crypto.timingSafeEqual(key, expected));
    });
  });
}

/** Hash fixo usado para equalizar o tempo de resposta quando o e-mail não existe. */
export const DUMMY_HASH =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');

const COMMON = new Set([
  'password', '12345678', '123456789', '1234567890', 'qwerty123', 'senha123', 'senha1234',
  'abc12345', 'password1', 'iloveyou', 'admin123', 'brasil123', 'mudar123', 'walisson123',
]);

export function passwordProblems(pw: string, ctx: { email?: string; name?: string } = {}): string[] {
  const issues: string[] = [];
  if (pw.length < 8) issues.push('mínimo de 8 caracteres');
  if (pw.length > 128) issues.push('máximo de 128 caracteres');
  if (!/[a-z]/.test(pw)) issues.push('uma letra minúscula');
  if (!/[A-Z]/.test(pw)) issues.push('uma letra maiúscula');
  if (!/\d/.test(pw)) issues.push('um número');
  if (COMMON.has(pw.toLowerCase())) issues.push('não pode ser uma senha comum');
  const local = ctx.email?.split('@')[0]?.toLowerCase();
  if (local && local.length >= 4 && pw.toLowerCase().includes(local)) issues.push('não pode conter seu e-mail');
  return issues;
}

/* ------------------------------------------------------------------ */
/* Tokens                                                              */
/* ------------------------------------------------------------------ */
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

export function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/* ------------------------------------------------------------------ */
/* TOTP (RFC 6238) — compatível com Google Authenticator / Authy        */
/* ------------------------------------------------------------------ */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer) {
  let bits = 0, value = 0, out = '';
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(str: string) {
  const clean = str.replace(/=+$/, '').toUpperCase().replace(/\s/g, '');
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('base32 inválido');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = () => base32Encode(crypto.randomBytes(20));

export function totpCode(secret: string, counter: number) {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

/** Aceita o código atual e ±1 janela de 30s (tolerância de relógio). */
export function verifyTotp(secret: string, token: string, at = Date.now()) {
  if (!/^\d{6}$/.test(token)) return false;
  const counter = Math.floor(at / 1000 / 30);
  for (const w of [-1, 0, 1]) if (safeEqual(totpCode(secret, counter + w), token)) return true;
  return false;
}

export function totpUri(secret: string, email: string) {
  const issuer = encodeURIComponent('Walisson Imóveis');
  return `otpauth://totp/${issuer}:${encodeURIComponent(email)}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

export function generateRecoveryCodes(n = 8) {
  return Array.from({ length: n }, () => {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}
