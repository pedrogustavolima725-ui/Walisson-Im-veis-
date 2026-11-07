import { config } from './config.ts';
import { get, run, now, ready } from './db.ts';
import { hashPassword, passwordProblems } from './lib/crypto.ts';

/**
 * Primeira inicialização: cria a conta de administrador a partir das variáveis
 * de ambiente ADMIN_EMAIL / ADMIN_PASSWORD (nunca gravadas no código).
 * O banco começa vazio: imóveis, corretores e leads são cadastrados pelo admin.
 */
export async function bootstrap() {
  await ready;
  if (await get('SELECT id FROM users LIMIT 1')) return;
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Walisson';
  if (!email || !password) {
    console.warn('\n  [atenção] Nenhum usuário cadastrado. Defina ADMIN_EMAIL e ADMIN_PASSWORD (no .env ou no painel da hospedagem) e reinicie para criar o administrador.\n');
    return;
  }
  const problems = passwordProblems(password);
  if (problems.length) throw new Error(`ADMIN_PASSWORD fraca — precisa de: ${problems.join(', ')}`);
  const t = now();
  await run(
    "INSERT INTO users (name, email, password_hash, role, terms_accepted_at, created_at, updated_at) VALUES (?,?,?, 'admin', ?,?,?)",
    name, email, await hashPassword(password), t, t, t,
  );
  await run("INSERT INTO audit_logs (action, meta, created_at) VALUES ('system.bootstrap', ?, ?)", JSON.stringify({ email }), t);
  console.log(`  Administrador criado: ${email}${config.isProd ? '' : ' (ative o 2FA em Minha conta → Segurança)'}`);
}
