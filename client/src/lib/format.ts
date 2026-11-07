export const brl = (v: number | null | undefined, compact = false) =>
  v == null
    ? '—'
    : compact && Math.abs(v) >= 1_000_000
      ? `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mi`
      : compact && Math.abs(v) >= 10_000
        ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })} mil`
        : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v % 1 ? 2 : 0 });

export const num = (v: number) => v.toLocaleString('pt-BR');

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
export const dateTime = (ms: number) =>
  new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '').replace(' de ', ' ').replace(',', ' ·');
export const dateShort = (ms: number) => new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
export const time = (ms: number) => new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export const weekday = (ms: number) => cap(new Date(ms).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''));

export function relative(ms: number) {
  const diff = Date.now() - ms;
  const abs = Math.abs(diff);
  const fut = diff < 0;
  const m = Math.round(abs / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return fut ? `em ${m} min` : `há ${m} min`;
  const h = Math.round(m / 60);
  if (h < 24) return fut ? `em ${h} h` : `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return fut ? `em ${d} dia${d > 1 ? 's' : ''}` : `há ${d} dia${d > 1 ? 's' : ''}`;
  return dateShort(ms);
}

export const PURPOSE_LABEL: Record<string, string> = { venda: 'Venda', aluguel: 'Aluguel', temporada: 'Temporada' };
export const TYPE_LABEL: Record<string, string> = {
  casa: 'Casa', apartamento: 'Apartamento', cobertura: 'Cobertura', sobrado: 'Sobrado', studio: 'Studio',
  terreno: 'Terreno', comercial: 'Comercial', chacara: 'Chácara',
};
export const STATUS_LABEL: Record<string, string> = {
  disponivel: 'Disponível', reservado: 'Reservado', vendido: 'Vendido', alugado: 'Alugado', inativo: 'Inativo', pendente: 'Em análise',
};
export const STAGE_LABEL: Record<string, string> = {
  novo: 'Novo', contato: 'Em contato', visita: 'Visita', proposta: 'Proposta', negociacao: 'Negociação', ganho: 'Ganho', perdido: 'Perdido',
};
export const STAGES = ['novo', 'contato', 'visita', 'proposta', 'negociacao', 'ganho', 'perdido'] as const;
export const SOURCE_LABEL: Record<string, string> = {
  site: 'Site', app: 'App', chat: 'Chat', whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', indicacao: 'Indicação',
  portal: 'Portal', captacao: 'Captação', telefone: 'Telefone', placa: 'Placa',
};
export const PAYMENT_LABEL: Record<string, string> = { a_vista: 'À vista', financiamento: 'Financiamento', permuta: 'Permuta', consorcio: 'Consórcio' };
export const PROPOSAL_LABEL: Record<string, string> = { rascunho: 'Rascunho', enviada: 'Enviada', contraproposta: 'Contraproposta', aceita: 'Aceita', recusada: 'Recusada' };
export const VISIT_LABEL: Record<string, string> = { agendada: 'Aguardando', confirmada: 'Confirmada', realizada: 'Realizada', cancelada: 'Cancelada' };
export const ROLE_LABEL: Record<string, string> = { cliente: 'Cliente', corretor: 'Corretor', admin: 'Administrador' };

export const priceSuffix = (purpose: string) => (purpose === 'aluguel' ? '/mês' : purpose === 'temporada' ? '/diária' : '');

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

export const onlyDigits = (s: string) => s.replace(/\D/g, '');
export const whatsappLink = (phone: string | null | undefined, text: string) =>
  phone ? `https://wa.me/55${onlyDigits(phone)}?text=${encodeURIComponent(text)}` : undefined;

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function passwordStrength(pw: string) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  const level = Math.min(4, s);
  return { level, label: ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'][level] };
}

export function deviceName(ua: string) {
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Dispositivo';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /curl/.test(ua) ? 'curl' : 'Navegador';
  return `${br} · ${os}`;
}
