import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';

type Param = string | number | bigint | null | Uint8Array;

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });

export const db = new DatabaseSync(process.env.NODE_TEST ? ':memory:' : config.databasePath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente','corretor','admin')),
  avatar TEXT,
  creci TEXT,
  bio TEXT,
  totp_secret TEXT,
  totp_enabled INTEGER NOT NULL DEFAULT 0,
  recovery_codes TEXT,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0,
  terms_accepted_at INTEGER,
  last_login_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT NOT NULL UNIQUE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  mfa_pending INTEGER NOT NULL DEFAULT 0,
  ip TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL CHECK (purpose IN ('venda','aluguel','temporada')),
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel','reservado','vendido','alugado','inativo','pendente')),
  price REAL NOT NULL,
  condo_fee REAL NOT NULL DEFAULT 0,
  iptu REAL NOT NULL DEFAULT 0,
  bedrooms INTEGER NOT NULL DEFAULT 0,
  suites INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 0,
  parking INTEGER NOT NULL DEFAULT 0,
  area REAL NOT NULL DEFAULT 0,
  land_area REAL NOT NULL DEFAULT 0,
  address TEXT NOT NULL DEFAULT '',
  neighborhood TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  lat REAL,
  lng REAL,
  features TEXT NOT NULL DEFAULT '[]',
  featured INTEGER NOT NULL DEFAULT 0,
  accepts_financing INTEGER NOT NULL DEFAULT 1,
  accepts_pets INTEGER NOT NULL DEFAULT 0,
  furnished INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_properties_search ON properties(status, purpose, type, city);

CREATE TABLE IF NOT EXISTS property_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, property_id)
);

CREATE TABLE IF NOT EXISTS leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  source TEXT NOT NULL DEFAULT 'site',
  stage TEXT NOT NULL DEFAULT 'novo' CHECK (stage IN ('novo','contato','visita','proposta','negociacao','ganho','perdido')),
  temperature TEXT NOT NULL DEFAULT 'morno' CHECK (temperature IN ('quente','morno','frio')),
  interest TEXT NOT NULL DEFAULT 'compra',
  budget REAL,
  message TEXT,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  lost_reason TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_agent ON leads(agent_id, stage);

CREATE TABLE IF NOT EXISTS lead_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  due_at INTEGER,
  done INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'media',
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  scheduled_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada','confirmada','realizada','cancelada')),
  notes TEXT,
  feedback TEXT,
  rating INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  value REAL NOT NULL,
  payment TEXT NOT NULL DEFAULT 'financiamento',
  status TEXT NOT NULL DEFAULT 'enviada' CHECK (status IN ('rascunho','enviada','contraproposta','aceita','recusada')),
  notes TEXT,
  valid_until INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
  created_at INTEGER NOT NULL,
  last_message_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  read_at INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read_at);

CREATE TABLE IF NOT EXISTS saved_searches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters TEXT NOT NULL,
  alert INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  meta TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
`;

db.exec(SCHEMA);

export function all<T = any>(sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T = any>(sql: string, ...params: Param[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: Param[]) {
  const r = db.prepare(sql).run(...params);
  return { id: Number(r.lastInsertRowid), changes: Number(r.changes) };
}
export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}
export const now = () => Date.now();
