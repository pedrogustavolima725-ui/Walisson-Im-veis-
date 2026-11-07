// Primeira inicialização: banco vazio + administrador vindo das variáveis de ambiente
process.env.NODE_TEST = '1';
process.env.ADMIN_EMAIL = 'Dono@Exemplo.com';
process.env.ADMIN_PASSWORD = 'SenhaDoDono2026';

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { bootstrap } = await import('../src/bootstrap.ts');
const { all, get } = await import('../src/db.ts');
const { verifyPassword } = await import('../src/lib/crypto.ts');

test('cria só o administrador e nenhum dado de exemplo', async () => {
  await bootstrap();
  await bootstrap(); // idempotente
  const users = await all<{ email: string; role: string; password_hash: string }>('SELECT email, role, password_hash FROM users');
  assert.equal(users.length, 1);
  assert.equal(users[0].email, 'dono@exemplo.com');
  assert.equal(users[0].role, 'admin');
  assert.ok(!users[0].password_hash.includes('SenhaDoDono'), 'senha nunca em texto puro');
  assert.ok(await verifyPassword('SenhaDoDono2026', users[0].password_hash));
  for (const t of ['properties', 'leads', 'visits', 'proposals', 'conversations']) {
    assert.equal((await get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${t}`))!.n, 0, `${t} deve começar vazio`);
  }
});
