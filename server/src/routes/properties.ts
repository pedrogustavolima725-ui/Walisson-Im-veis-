import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.ts';
import { all, get, run, now, tx } from '../db.ts';
import { isStaff, requireAuth, requireRole } from '../lib/auth.ts';
import { audit, notify, notifyStaff, upsertLeadForClient } from '../lib/events.ts';
import { badRequest, forbidden, idParam, notFound, parse, zBool, zReqStr, zStr } from '../lib/http.ts';

export const propertiesRouter = Router();

export const PURPOSES = ['venda', 'aluguel', 'temporada'] as const;
export const TYPES = ['casa', 'apartamento', 'cobertura', 'sobrado', 'studio', 'terreno', 'comercial', 'chacara'] as const;
export const STATUSES = ['disponivel', 'reservado', 'vendido', 'alugado', 'inativo', 'pendente'] as const;

const PUBLIC_COLS = `p.id, p.code, p.title, p.purpose, p.type, p.status, p.price, p.condo_fee, p.iptu, p.bedrooms, p.suites,
  p.bathrooms, p.parking, p.area, p.land_area, p.neighborhood, p.city, p.state, p.lat, p.lng, p.featured, p.views, p.created_at,
  p.accepts_financing, p.accepts_pets, p.furnished`;

function cover(id: number) {
  return get<{ url: string }>('SELECT url FROM property_images WHERE property_id = ? ORDER BY position, id LIMIT 1', id)?.url ?? null;
}

export function withExtras<T extends { id: number }>(rows: T[], userId?: number) {
  const favs = userId ? new Set(all<{ property_id: number }>('SELECT property_id FROM favorites WHERE user_id = ?', userId).map((f) => f.property_id)) : new Set<number>();
  return rows.map((r) => ({ ...r, cover: cover(r.id), favorite: favs.has(r.id) }));
}

/* ---------------- Busca pública ---------------- */
const searchSchema = z.object({
  q: zStr(100).optional(),
  purpose: z.enum(PURPOSES).optional(),
  type: z.string().max(200).optional(), // lista separada por vírgula
  city: zStr(80).optional(),
  neighborhood: zStr(80).optional(),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  bedrooms: z.coerce.number().int().min(0).max(20).optional(),
  bathrooms: z.coerce.number().int().min(0).max(20).optional(),
  parking: z.coerce.number().int().min(0).max(20).optional(),
  minArea: z.coerce.number().min(0).optional(),
  maxArea: z.coerce.number().min(0).optional(),
  pets: zBool.optional(),
  furnished: zBool.optional(),
  financing: zBool.optional(),
  featured: zBool.optional(),
  sort: z.enum(['recentes', 'menor_preco', 'maior_preco', 'maior_area', 'populares']).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(60).optional(),
  ids: z.string().max(200).optional(),
});

propertiesRouter.get('/', (req, res) => {
  const f = parse(searchSchema, req.query);
  const where: string[] = ["p.status IN ('disponivel','reservado')"];
  const params: (string | number)[] = [];
  if (f.q) {
    where.push('(p.title LIKE ? OR p.neighborhood LIKE ? OR p.city LIKE ? OR p.code LIKE ? OR p.description LIKE ?)');
    const like = `%${f.q.replace(/[%_]/g, '')}%`;
    params.push(like, like, like, like, like);
  }
  if (f.purpose) { where.push('p.purpose = ?'); params.push(f.purpose); }
  if (f.type) {
    const types = f.type.split(',').filter((t) => (TYPES as readonly string[]).includes(t));
    if (types.length) { where.push(`p.type IN (${types.map(() => '?').join(',')})`); params.push(...types); }
  }
  if (f.city) { where.push('p.city = ?'); params.push(f.city); }
  if (f.neighborhood) { where.push('p.neighborhood LIKE ?'); params.push(`%${f.neighborhood}%`); }
  if (f.minPrice !== undefined) { where.push('p.price >= ?'); params.push(f.minPrice); }
  if (f.maxPrice !== undefined) { where.push('p.price <= ?'); params.push(f.maxPrice); }
  if (f.bedrooms) { where.push('p.bedrooms >= ?'); params.push(f.bedrooms); }
  if (f.bathrooms) { where.push('p.bathrooms >= ?'); params.push(f.bathrooms); }
  if (f.parking) { where.push('p.parking >= ?'); params.push(f.parking); }
  if (f.minArea !== undefined) { where.push('p.area >= ?'); params.push(f.minArea); }
  if (f.maxArea !== undefined) { where.push('p.area <= ?'); params.push(f.maxArea); }
  if (f.pets) where.push('p.accepts_pets = 1');
  if (f.furnished) where.push('p.furnished = 1');
  if (f.financing) where.push('p.accepts_financing = 1');
  if (f.featured) where.push('p.featured = 1');
  if (f.ids) {
    const ids = f.ids.split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 10);
    if (ids.length) { where.push(`p.id IN (${ids.map(() => '?').join(',')})`); params.push(...ids); }
  }
  const order = {
    recentes: 'p.created_at DESC',
    menor_preco: 'p.price ASC',
    maior_preco: 'p.price DESC',
    maior_area: 'p.area DESC',
    populares: 'p.views DESC',
  }[f.sort ?? 'recentes'];
  const limit = f.limit ?? 12;
  const page = f.page ?? 1;
  const w = where.join(' AND ');
  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM properties p WHERE ${w}`, ...params)!.n;
  const rows = all(`SELECT ${PUBLIC_COLS} FROM properties p WHERE ${w} ORDER BY p.featured DESC, ${order} LIMIT ? OFFSET ?`, ...params, limit, (page - 1) * limit);
  res.json({ items: withExtras(rows as { id: number }[], req.user?.id), total, page, pages: Math.max(1, Math.ceil(total / limit)) });
});

/* Metadados para filtros (cidades, bairros, faixas) */
propertiesRouter.get('/meta', (_req, res) => {
  const cities = all<{ city: string; state: string; n: number; cover: string | null }>(
    `SELECT p.city, p.state, COUNT(*) AS n,
       (SELECT url FROM property_images pi JOIN properties p2 ON p2.id = pi.property_id WHERE p2.city = p.city ORDER BY p2.featured DESC, pi.position LIMIT 1) AS cover
     FROM properties p WHERE p.status IN ('disponivel','reservado') GROUP BY p.city ORDER BY n DESC`,
  );
  const neighborhoods = all<{ neighborhood: string; city: string; n: number }>(
    "SELECT neighborhood, city, COUNT(*) AS n FROM properties WHERE status IN ('disponivel','reservado') AND neighborhood != '' GROUP BY neighborhood, city ORDER BY n DESC LIMIT 30",
  );
  const types = all("SELECT type, COUNT(*) AS n FROM properties WHERE status IN ('disponivel','reservado') GROUP BY type ORDER BY n DESC");
  res.json({ cities, neighborhoods, types });
});

/* ---------------- Detalhe ---------------- */
propertiesRouter.get('/:id', (req, res) => {
  const id = idParam(req.params.id);
  const p = get<any>(`SELECT ${PUBLIC_COLS}, p.description, p.address, p.zip, p.features, p.agent_id, p.owner_id FROM properties p WHERE p.id = ?`, id);
  const staff = isStaff(req.user);
  if (!p) throw notFound('Imóvel não encontrado.');
  const visible = ['disponivel', 'reservado'].includes(p.status) || staff || (req.user && p.owner_id === req.user.id);
  if (!visible) throw notFound('Imóvel não encontrado.');
  if (!staff) run('UPDATE properties SET views = views + 1 WHERE id = ?', id);
  const images = all<{ id: number; url: string }>('SELECT id, url FROM property_images WHERE property_id = ? ORDER BY position, id', id);
  const agent = p.agent_id
    ? get('SELECT id, name, email, phone, avatar, creci, bio FROM users WHERE id = ? AND active = 1', p.agent_id)
    : null;
  const similar = withExtras(
    all<{ id: number }>(
      `SELECT ${PUBLIC_COLS} FROM properties p WHERE p.id != ? AND p.status = 'disponivel' AND p.purpose = ? AND (p.city = ? OR p.type = ?)
       ORDER BY ABS(p.price - ?) LIMIT 6`,
      id, p.purpose, p.city, p.type, p.price,
    ),
    req.user?.id,
  );
  const favorite = req.user ? !!get('SELECT 1 FROM favorites WHERE user_id = ? AND property_id = ?', req.user.id, id) : false;
  // Endereço completo só é exibido para a equipe; o público vê bairro/cidade (privacidade do proprietário)
  if (!staff) delete p.address;
  delete p.owner_id;
  res.json({ ...p, features: JSON.parse(p.features), images, agent, similar, favorite });
});

/* ---------------- Favoritos ---------------- */
propertiesRouter.post('/:id/favorite', requireAuth, (req, res) => {
  const id = idParam(req.params.id);
  if (!get('SELECT 1 FROM properties WHERE id = ?', id)) throw notFound();
  const exists = get('SELECT 1 FROM favorites WHERE user_id = ? AND property_id = ?', req.user!.id, id);
  if (exists) run('DELETE FROM favorites WHERE user_id = ? AND property_id = ?', req.user!.id, id);
  else run('INSERT INTO favorites (user_id, property_id, created_at) VALUES (?,?,?)', req.user!.id, id, now());
  res.json({ favorite: !exists });
});

/* ---------------- Tenho interesse (gera lead) ---------------- */
propertiesRouter.post('/:id/interest', (req, res) => {
  const id = idParam(req.params.id);
  const prop = get<{ id: number; title: string; code: string }>('SELECT id, title, code FROM properties WHERE id = ?', id);
  if (!prop) throw notFound();
  const body = parse(
    z.object({
      name: zReqStr(100, 'Informe seu nome'),
      email: z.string().trim().toLowerCase().email('E-mail inválido').max(254),
      phone: zStr(20).optional(),
      message: zStr(1000).optional(),
      // honeypot anti-spam: humanos não preenchem este campo invisível
      website: z.string().max(0, 'spam').optional(),
    }),
    req.user ? { name: req.user.name, email: req.user.email, phone: req.user.phone ?? '', ...req.body } : req.body,
  );
  const lead = upsertLeadForClient({
    userId: req.user?.id, name: body.name, email: body.email, phone: body.phone, propertyId: id,
    source: req.user ? 'app' : 'site', message: body.message, activity: `Demonstrou interesse no imóvel ${prop.code} — ${prop.title}${body.message ? `: "${body.message}"` : ''}`,
  });
  res.status(201).json({ ok: true, leadId: lead.id });
});

/* ====================================================================== */
/* Gestão (CRM)                                                            */
/* ====================================================================== */
const propertySchema = z.object({
  title: zReqStr(140, 'Informe o título'),
  description: zStr(5000).default(''),
  purpose: z.enum(PURPOSES),
  type: z.enum(TYPES),
  status: z.enum(STATUSES).default('disponivel'),
  price: z.coerce.number().positive('Informe o valor'),
  condo_fee: z.coerce.number().min(0).default(0),
  iptu: z.coerce.number().min(0).default(0),
  bedrooms: z.coerce.number().int().min(0).max(50).default(0),
  suites: z.coerce.number().int().min(0).max(50).default(0),
  bathrooms: z.coerce.number().int().min(0).max(50).default(0),
  parking: z.coerce.number().int().min(0).max(50).default(0),
  area: z.coerce.number().min(0).default(0),
  land_area: z.coerce.number().min(0).default(0),
  address: zStr(200).default(''),
  neighborhood: zStr(80).default(''),
  city: zReqStr(80, 'Informe a cidade'),
  state: zStr(2).default(''),
  zip: zStr(10).default(''),
  lat: z.coerce.number().min(-90).max(90).nullable().optional(),
  lng: z.coerce.number().min(-180).max(180).nullable().optional(),
  features: z.array(zStr(60)).max(40).default([]),
  featured: z.boolean().default(false),
  accepts_financing: z.boolean().default(true),
  accepts_pets: z.boolean().default(false),
  furnished: z.boolean().default(false),
  agent_id: z.coerce.number().int().positive().nullable().optional(),
  images: z.array(z.string().max(500).regex(/^(\/uploads\/[\w.-]+|https:\/\/[\w.-]+\/[\w./%?=&-]*)$/, 'URL de imagem inválida')).max(30).optional(),
});

function nextCode() {
  const last = get<{ n: number }>("SELECT COALESCE(MAX(CAST(SUBSTR(code, 4) AS INTEGER)), 1000) AS n FROM properties WHERE code LIKE 'WI-%'")!.n;
  return `WI-${last + 1}`;
}

function saveImages(propertyId: number, images?: string[]) {
  if (!images) return;
  run('DELETE FROM property_images WHERE property_id = ?', propertyId);
  images.forEach((url, i) => run('INSERT INTO property_images (property_id, url, position) VALUES (?,?,?)', propertyId, url, i));
}

propertiesRouter.get('/manage/list', requireRole('corretor', 'admin'), (req, res) => {
  const f = parse(z.object({ q: zStr(100).optional(), status: z.enum(STATUSES).optional(), mine: zBool.optional() }), req.query);
  const where = ['1=1'];
  const params: (string | number)[] = [];
  if (f.q) { where.push('(p.title LIKE ? OR p.code LIKE ? OR p.neighborhood LIKE ? OR p.city LIKE ?)'); const l = `%${f.q}%`; params.push(l, l, l, l); }
  if (f.status) { where.push('p.status = ?'); params.push(f.status); }
  if (f.mine) { where.push('p.agent_id = ?'); params.push(req.user!.id); }
  const rows = all<{ id: number }>(
    `SELECT ${PUBLIC_COLS}, p.agent_id, a.name AS agent_name, o.name AS owner_name,
      (SELECT COUNT(*) FROM leads l WHERE l.property_id = p.id) AS leads_count,
      (SELECT COUNT(*) FROM favorites f WHERE f.property_id = p.id) AS favorites_count
     FROM properties p LEFT JOIN users a ON a.id = p.agent_id LEFT JOIN users o ON o.id = p.owner_id
     WHERE ${where.join(' AND ')} ORDER BY CASE p.status WHEN 'pendente' THEN 0 ELSE 1 END, p.updated_at DESC`,
    ...params,
  );
  res.json(withExtras(rows));
});

propertiesRouter.get('/manage/:id', requireRole('corretor', 'admin'), (req, res) => {
  const p = get<any>('SELECT * FROM properties WHERE id = ?', idParam(req.params.id));
  if (!p) throw notFound();
  const images = all<{ url: string }>('SELECT url FROM property_images WHERE property_id = ? ORDER BY position, id', p.id).map((i) => i.url);
  res.json({ ...p, features: JSON.parse(p.features), images, featured: !!p.featured, accepts_financing: !!p.accepts_financing, accepts_pets: !!p.accepts_pets, furnished: !!p.furnished });
});

propertiesRouter.post('/', requireRole('corretor', 'admin'), (req, res) => {
  const b = parse(propertySchema, req.body);
  const t = now();
  const agentId = req.user!.role === 'admin' ? (b.agent_id ?? req.user!.id) : req.user!.id;
  const id = tx(() => {
    const r = run(
      `INSERT INTO properties (code, title, description, purpose, type, status, price, condo_fee, iptu, bedrooms, suites, bathrooms, parking, area, land_area,
        address, neighborhood, city, state, zip, lat, lng, features, featured, accepts_financing, accepts_pets, furnished, agent_id, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      nextCode(), b.title, b.description, b.purpose, b.type, b.status, b.price, b.condo_fee, b.iptu, b.bedrooms, b.suites, b.bathrooms, b.parking,
      b.area, b.land_area, b.address, b.neighborhood, b.city, b.state.toUpperCase(), b.zip, b.lat ?? null, b.lng ?? null, JSON.stringify(b.features),
      b.featured ? 1 : 0, b.accepts_financing ? 1 : 0, b.accepts_pets ? 1 : 0, b.furnished ? 1 : 0, agentId, t, t,
    );
    saveImages(r.id, b.images);
    return r.id;
  });
  audit(req, 'property.create', { id, title: b.title });
  matchSavedSearches(id);
  res.status(201).json({ id });
});

propertiesRouter.put('/:id', requireRole('corretor', 'admin'), (req, res) => {
  const id = idParam(req.params.id);
  const cur = get<{ agent_id: number | null; status: string; owner_id: number | null; title: string; price: number }>('SELECT agent_id, status, owner_id, title, price FROM properties WHERE id = ?', id);
  if (!cur) throw notFound();
  if (req.user!.role !== 'admin' && cur.agent_id !== req.user!.id) throw forbidden('Apenas o corretor responsável ou um administrador pode editar este imóvel.');
  const b = parse(propertySchema, req.body);
  const agentId = req.user!.role === 'admin' ? (b.agent_id ?? cur.agent_id) : cur.agent_id;
  tx(() => {
    run(
      `UPDATE properties SET title=?, description=?, purpose=?, type=?, status=?, price=?, condo_fee=?, iptu=?, bedrooms=?, suites=?, bathrooms=?, parking=?,
        area=?, land_area=?, address=?, neighborhood=?, city=?, state=?, zip=?, lat=?, lng=?, features=?, featured=?, accepts_financing=?, accepts_pets=?,
        furnished=?, agent_id=?, updated_at=? WHERE id=?`,
      b.title, b.description, b.purpose, b.type, b.status, b.price, b.condo_fee, b.iptu, b.bedrooms, b.suites, b.bathrooms, b.parking, b.area, b.land_area,
      b.address, b.neighborhood, b.city, b.state.toUpperCase(), b.zip, b.lat ?? null, b.lng ?? null, JSON.stringify(b.features), b.featured ? 1 : 0,
      b.accepts_financing ? 1 : 0, b.accepts_pets ? 1 : 0, b.furnished ? 1 : 0, agentId, now(), id,
    );
    saveImages(id, b.images);
  });
  if (cur.status === 'pendente' && b.status === 'disponivel') {
    notify(cur.owner_id, { type: 'imovel', title: 'Seu imóvel foi aprovado e publicado!', body: b.title, link: `/imovel/${id}` });
    matchSavedSearches(id);
  }
  if (b.price < cur.price) {
    // avisa quem favoritou sobre redução de preço
    for (const f of all<{ user_id: number }>('SELECT user_id FROM favorites WHERE property_id = ?', id)) {
      notify(f.user_id, { type: 'preco', title: 'Preço reduzido em um favorito!', body: `${b.title} agora por ${b.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, link: `/imovel/${id}` });
    }
  }
  audit(req, 'property.update', { id, status: b.status });
  res.json({ ok: true });
});

propertiesRouter.delete('/:id', requireRole('admin'), (req, res) => {
  const id = idParam(req.params.id);
  run('DELETE FROM properties WHERE id = ?', id);
  audit(req, 'property.delete', { id });
  res.json({ ok: true });
});

/* ---------------- Proprietário: anunciar imóvel ---------------- */
propertiesRouter.post('/submit', requireAuth, (req, res) => {
  const b = parse(
    propertySchema.pick({ title: true, description: true, purpose: true, type: true, price: true, bedrooms: true, bathrooms: true, parking: true, area: true, address: true, neighborhood: true, city: true, state: true, images: true }),
    req.body,
  );
  const t = now();
  const agentId = null;
  const { id } = run(
    `INSERT INTO properties (code, title, description, purpose, type, status, price, bedrooms, bathrooms, parking, area, address, neighborhood, city, state, owner_id, agent_id, created_at, updated_at)
     VALUES (?,?,?,?,?, 'pendente', ?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    nextCode(), b.title, b.description, b.purpose, b.type, b.price, b.bedrooms, b.bathrooms, b.parking, b.area, b.address, b.neighborhood, b.city, b.state.toUpperCase(), req.user!.id, agentId, t, t,
  );
  saveImages(id, b.images);
  const lead = upsertLeadForClient({
    userId: req.user!.id, name: req.user!.name, email: req.user!.email, phone: req.user!.phone, source: 'captacao', interest: 'venda',
    activity: `Proprietário enviou imóvel para captação: ${b.title}`,
  });
  run('UPDATE properties SET agent_id = ? WHERE id = ?', lead.agent_id, id);
  notifyStaff({ type: 'captacao', title: 'Novo imóvel para avaliação', body: b.title, link: `/crm/imoveis/${id}` });
  audit(req, 'property.submit', { id });
  res.status(201).json({ id });
});

propertiesRouter.get('/mine/submissions', requireAuth, (req, res) => {
  res.json(withExtras(all<{ id: number }>(`SELECT ${PUBLIC_COLS} FROM properties p WHERE p.owner_id = ? ORDER BY p.created_at DESC`, req.user!.id)));
});

/* ---------------- Upload de fotos ---------------- */
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 12 } });

function detectImage(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null; // SVG e outros formatos são recusados (risco de XSS)
}

propertiesRouter.post('/upload', requireAuth, upload.array('files', 12), (req, res) => {
  const files = (req.files as Express.Multer.File[]) ?? [];
  if (!files.length) throw badRequest('Nenhum arquivo enviado.');
  const urls: string[] = [];
  for (const f of files) {
    // Valida pelo conteúdo (magic bytes), não pela extensão/MIME informados pelo navegador
    const ext = detectImage(f.buffer);
    if (!ext) throw badRequest(`"${f.originalname.slice(0, 60)}" não é uma imagem JPG, PNG ou WEBP válida.`);
    const name = `${crypto.randomUUID()}.${ext}`;
    fs.writeFileSync(path.join(config.uploadDir, name), f.buffer, { mode: 0o644 });
    urls.push(`/uploads/${name}`);
  }
  audit(req, 'upload.images', { count: urls.length });
  res.status(201).json({ urls });
});

/* ---------------- Alertas de busca ---------------- */
export function matchSavedSearches(propertyId: number) {
  const p = get<any>('SELECT * FROM properties WHERE id = ?', propertyId);
  if (!p || p.status !== 'disponivel') return;
  for (const s of all<{ id: number; user_id: number; name: string; filters: string }>('SELECT * FROM saved_searches WHERE alert = 1')) {
    const f = JSON.parse(s.filters);
    const ok =
      (!f.purpose || f.purpose === p.purpose) &&
      (!f.type || String(f.type).split(',').includes(p.type)) &&
      (!f.city || f.city === p.city) &&
      (!f.maxPrice || p.price <= Number(f.maxPrice)) &&
      (!f.minPrice || p.price >= Number(f.minPrice)) &&
      (!f.bedrooms || p.bedrooms >= Number(f.bedrooms));
    if (ok) notify(s.user_id, { type: 'alerta', title: `Novo imóvel no seu alerta "${s.name}"`, body: p.title, link: `/imovel/${p.id}` });
  }
}
