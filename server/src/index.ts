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
});
