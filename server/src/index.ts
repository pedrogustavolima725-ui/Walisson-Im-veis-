import { config } from './config.ts';
import { createApp } from './app.ts';
import { get, isRemoteDb, ready } from './db.ts';
import { bootstrap } from './bootstrap.ts';
import { seed } from './seed.ts';

await ready;
console.log(`  Banco de dados: ${isRemoteDb ? 'Turso (nuvem)' : 'arquivo local'}`);
if (process.env.SEED_DEMO === 'true' && !await get('SELECT id FROM users LIMIT 1')) {
  console.log('Banco vazio — populando dados de demonstração (SEED_DEMO=true)...');
  await seed();
}
await bootstrap();

createApp().listen(config.port, () => {
  console.log(`\n  Walisson Imóveis API rodando em http://localhost:${config.port}`);
  if (!config.isProd) console.log('  Front-end (dev): http://localhost:5173\n');
  keepAwake();
});

/**
 * Plano gratuito do Render: o servidor "dorme" após 15 min sem acessos e o próximo
 * acesso demora ~1 min. Para o app abrir sempre na hora, o servidor acessa o próprio
 * endereço público a cada 10 min. Desative com KEEP_AWAKE=false.
 */
function keepAwake() {
  const url = process.env.RENDER_EXTERNAL_URL;
  if (!url || process.env.KEEP_AWAKE === 'false') return;
  const ping = () =>
    fetch(`${url}/api/health`, { headers: { 'user-agent': 'walisson-keep-awake' }, signal: AbortSignal.timeout(30_000) })
      .then((r) => { if (!r.ok) console.warn(`[manter acordado] resposta ${r.status}`); })
      .catch((e) => console.warn('[manter acordado] falhou:', (e as Error).message));
  setInterval(ping, 10 * 60_000).unref();
  console.log('  Mantendo o servidor acordado (acesso a cada 10 min)');
}
