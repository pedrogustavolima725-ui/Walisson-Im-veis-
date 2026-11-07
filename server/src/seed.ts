import { run, get, now, ready, tx } from './db.ts';
import { hashPassword } from './lib/crypto.ts';

const U = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=75`;

const EXTERIORS = [
  'photo-1600596542815-ffad4c1539a9', 'photo-1600585154340-be6161a56a0c', 'photo-1512917774080-9991f1c4c750',
  'photo-1613490493576-7fde63acd811', 'photo-1580587771525-78b9dba3b914', 'photo-1564013799919-ab600027ffc6',
  'photo-1568605114967-8130f3a36994', 'photo-1570129477492-45c003edd2be', 'photo-1613977257363-707ba9348227',
  'photo-1600047509807-ba8f99d2cdde', 'photo-1605276374104-dee2a0ed3cd6', 'photo-1583608205776-bfd35f0d9f83',
];
const APARTMENTS = ['photo-1545324418-cc1a3fa10c00', 'photo-1522708323590-d24dbb6b0267', 'photo-1502672260266-1c1ef2d93688', 'photo-1560448204-e02f11c3d0e2'];
const INTERIORS = [
  'photo-1600607687939-ce8a6c25118c', 'photo-1600566753190-17f0baa2a6c3', 'photo-1600210492486-724fe5c67fb0',
  'photo-1493809842364-78817add7ffb', 'photo-1484154218962-a197022b5858', 'photo-1586023492125-27b2c045efd7',
  'photo-1556909114-f6e7ad7d3136', 'photo-1560185007-cde436f6a4d0', 'photo-1507089947368-19c1da9775ae',
];

type P = {
  title: string; purpose: 'venda' | 'aluguel' | 'temporada'; type: string; price: number; condo?: number; iptu?: number;
  bed: number; suites?: number; bath: number; park: number; area: number; land?: number; nb: string; city: string; st: string;
  lat: number; lng: number; feat?: boolean; pets?: boolean; furn?: boolean; ext: 'house' | 'apt'; desc: string; features: string[];
};

const PROPS: P[] = [
  { title: 'Casa moderna com piscina no Alphaville', purpose: 'venda', type: 'casa', price: 2850000, iptu: 980, condo: 1450, bed: 4, suites: 4, bath: 5, park: 4, area: 420, land: 600, nb: 'Alphaville', city: 'Barueri', st: 'SP', lat: -23.4925, lng: -46.8499, feat: true, ext: 'house', desc: 'Projeto contemporâneo assinado, com pé-direito duplo, integração total da área social com o jardim e piscina aquecida. Automação residencial, energia solar e acabamentos de alto padrão em cada detalhe.', features: ['Piscina aquecida', 'Energia solar', 'Automação', 'Espaço gourmet', 'Condomínio fechado', 'Segurança 24h', 'Home office', 'Closet'] },
  { title: 'Cobertura duplex com vista para o mar', purpose: 'venda', type: 'cobertura', price: 4200000, condo: 3200, iptu: 1800, bed: 4, suites: 3, bath: 5, park: 3, area: 310, nb: 'Barra Sul', city: 'Balneário Camboriú', st: 'SC', lat: -26.9946, lng: -48.6319, feat: true, ext: 'apt', desc: 'Cobertura frente mar com terraço privativo, piscina com borda infinita e churrasqueira. Vista panorâmica de toda a orla, prédio com infraestrutura de clube.', features: ['Frente mar', 'Piscina privativa', 'Terraço', 'Churrasqueira', 'Academia', 'Sauna', 'Elevador privativo'] },
  { title: 'Apartamento 3 quartos no Jardins', purpose: 'venda', type: 'apartamento', price: 1890000, condo: 1900, iptu: 650, bed: 3, suites: 1, bath: 3, park: 2, area: 132, nb: 'Jardins', city: 'São Paulo', st: 'SP', lat: -23.5677, lng: -46.6626, feat: true, ext: 'apt', desc: 'Apartamento reformado em rua arborizada, próximo à Oscar Freire. Planta inteligente, varanda gourmet e vista livre.', features: ['Varanda gourmet', 'Reformado', 'Portaria 24h', 'Piscina', 'Academia', 'Próximo ao metrô'] },
  { title: 'Studio mobiliado na Vila Madalena', purpose: 'aluguel', type: 'studio', price: 3200, condo: 650, iptu: 90, bed: 1, bath: 1, park: 1, area: 38, nb: 'Vila Madalena', city: 'São Paulo', st: 'SP', lat: -23.5559, lng: -46.6916, pets: true, furn: true, ext: 'apt', desc: 'Studio completo e mobiliado, ideal para quem busca praticidade. Prédio novo com lavanderia coletiva, coworking e rooftop.', features: ['Mobiliado', 'Coworking', 'Rooftop', 'Lavanderia', 'Pet friendly', 'Bicicletário'] },
  { title: 'Casa térrea em condomínio no Jardim Botânico', purpose: 'venda', type: 'casa', price: 1350000, condo: 780, iptu: 420, bed: 3, suites: 1, bath: 3, park: 2, area: 210, land: 360, nb: 'Jardim Botânico', city: 'Ribeirão Preto', st: 'SP', lat: -21.2134, lng: -47.8094, ext: 'house', desc: 'Casa térrea aconchegante, com jardim amplo, varanda e área de churrasqueira. Condomínio com lazer completo e muito verde.', features: ['Jardim', 'Churrasqueira', 'Condomínio fechado', 'Playground', 'Quadra'] },
  { title: 'Apartamento com varanda em Copacabana', purpose: 'aluguel', type: 'apartamento', price: 6800, condo: 1400, iptu: 280, bed: 2, suites: 1, bath: 2, park: 1, area: 85, nb: 'Copacabana', city: 'Rio de Janeiro', st: 'RJ', lat: -22.9711, lng: -43.1822, feat: true, furn: true, ext: 'apt', desc: 'A uma quadra da praia, apartamento claro e ventilado com varanda. Mobiliado com bom gosto, pronto para morar.', features: ['Vista parcial mar', 'Varanda', 'Mobiliado', 'Portaria 24h', 'Próximo ao metrô'] },
  { title: 'Sobrado contemporâneo no Santa Felicidade', purpose: 'venda', type: 'sobrado', price: 980000, iptu: 310, bed: 3, suites: 1, bath: 3, park: 2, area: 168, land: 220, nb: 'Santa Felicidade', city: 'Curitiba', st: 'PR', lat: -25.4013, lng: -49.3337, ext: 'house', desc: 'Sobrado novo com acabamento moderno, cozinha americana, lareira e quintal. Bairro tranquilo e gastronômico.', features: ['Lareira', 'Quintal', 'Cozinha americana', 'Novo'] },
  { title: 'Casa de praia pé na areia em Jurerê', purpose: 'temporada', type: 'casa', price: 2500, bed: 5, suites: 4, bath: 6, park: 4, area: 380, land: 700, nb: 'Jurerê Internacional', city: 'Florianópolis', st: 'SC', lat: -27.4396, lng: -48.4943, feat: true, pets: true, furn: true, ext: 'house', desc: 'Casa de temporada pé na areia, com piscina, deck e acesso direto à praia. Valor por diária, mínimo de 3 noites.', features: ['Pé na areia', 'Piscina', 'Deck', 'Wi-Fi', 'Ar-condicionado', 'Pet friendly', 'Churrasqueira'] },
  { title: 'Apartamento compacto no Savassi', purpose: 'aluguel', type: 'apartamento', price: 2900, condo: 520, iptu: 110, bed: 2, bath: 1, park: 1, area: 62, nb: 'Savassi', city: 'Belo Horizonte', st: 'MG', lat: -19.9385, lng: -43.9334, pets: true, ext: 'apt', desc: 'Apartamento bem localizado, próximo a bares, restaurantes e comércio. Sol da manhã e prédio com elevador.', features: ['Sol da manhã', 'Elevador', 'Pet friendly', 'Próximo ao comércio'] },
  { title: 'Terreno plano em condomínio de alto padrão', purpose: 'venda', type: 'terreno', price: 620000, condo: 450, bed: 0, bath: 0, park: 0, area: 0, land: 520, nb: 'Swiss Park', city: 'Campinas', st: 'SP', lat: -22.9516, lng: -47.1093, ext: 'house', desc: 'Terreno plano, pronto para construir, em condomínio com lago, trilhas e segurança 24h.', features: ['Plano', 'Condomínio fechado', 'Lago', 'Trilhas', 'Segurança 24h'] },
  { title: 'Sala comercial na Avenida Paulista', purpose: 'aluguel', type: 'comercial', price: 8500, condo: 2100, iptu: 640, bed: 0, bath: 2, park: 2, area: 120, nb: 'Bela Vista', city: 'São Paulo', st: 'SP', lat: -23.5613, lng: -46.6565, ext: 'apt', desc: 'Conjunto comercial em edifício corporativo AAA, com recepção, controle de acesso e ar-condicionado central.', features: ['Ar central', 'Recepção', 'Controle de acesso', 'Gerador', 'Próximo ao metrô'] },
  { title: 'Mansão com vista para o lago', purpose: 'venda', type: 'casa', price: 6900000, iptu: 2600, bed: 6, suites: 6, bath: 8, park: 6, area: 850, land: 2000, nb: 'Lago Sul', city: 'Brasília', st: 'DF', lat: -15.8424, lng: -47.8722, feat: true, ext: 'house', desc: 'Residência de alto luxo à beira do Lago Paranoá, com píer privativo, cinema, adega climatizada e paisagismo assinado.', features: ['Píer privativo', 'Cinema', 'Adega', 'Piscina', 'Sauna', 'Quadra de tênis', 'Casa de hóspedes'] },
  { title: 'Apartamento garden em Moema', purpose: 'venda', type: 'apartamento', price: 1450000, condo: 1300, iptu: 520, bed: 3, suites: 2, bath: 3, park: 2, area: 118, nb: 'Moema', city: 'São Paulo', st: 'SP', lat: -23.6006, lng: -46.6650, pets: true, ext: 'apt', desc: 'Garden com amplo quintal privativo, perfeito para quem tem pets ou crianças. Próximo ao Parque Ibirapuera.', features: ['Quintal privativo', 'Pet friendly', 'Piscina', 'Academia', 'Próximo ao parque'] },
  { title: 'Casa colonial no Centro Histórico', purpose: 'venda', type: 'casa', price: 890000, iptu: 280, bed: 4, suites: 1, bath: 3, park: 1, area: 240, land: 300, nb: 'Centro Histórico', city: 'Paraty', st: 'RJ', lat: -23.2178, lng: -44.7131, ext: 'house', desc: 'Charmosa casa colonial restaurada, com pátio interno e potencial para pousada.', features: ['Restaurada', 'Pátio interno', 'Potencial comercial'] },
  { title: 'Loft industrial no Bom Fim', purpose: 'aluguel', type: 'studio', price: 2600, condo: 380, iptu: 70, bed: 1, bath: 1, park: 0, area: 55, nb: 'Bom Fim', city: 'Porto Alegre', st: 'RS', lat: -30.0331, lng: -51.2108, furn: true, ext: 'apt', desc: 'Loft com pé-direito alto, tijolinho aparente e mezanino. Ao lado do Parque da Redenção.', features: ['Pé-direito alto', 'Mezanino', 'Mobiliado', 'Próximo ao parque'] },
  { title: 'Chácara com pomar e lago', purpose: 'venda', type: 'chacara', price: 1150000, bed: 4, suites: 2, bath: 3, park: 6, area: 280, land: 20000, nb: 'Zona Rural', city: 'Atibaia', st: 'SP', lat: -23.1171, lng: -46.5503, pets: true, ext: 'house', desc: 'Chácara de 2 hectares com casa sede, pomar formado, lago com peixes e área de lazer completa.', features: ['Pomar', 'Lago', 'Piscina', 'Churrasqueira', 'Casa de caseiro', 'Pet friendly'] },
  { title: 'Apartamento alto padrão no Batel', purpose: 'venda', type: 'apartamento', price: 2350000, condo: 2400, iptu: 820, bed: 3, suites: 3, bath: 4, park: 3, area: 186, nb: 'Batel', city: 'Curitiba', st: 'PR', lat: -25.4413, lng: -49.2900, ext: 'apt', desc: 'Apartamento de um por andar, com hall privativo, living amplo e cozinha gourmet. Lazer completo e vagas cobertas.', features: ['Um por andar', 'Hall privativo', 'Cozinha gourmet', 'Piscina', 'Spa', 'Brinquedoteca'] },
  { title: 'Flat para temporada em Porto de Galinhas', purpose: 'temporada', type: 'apartamento', price: 480, condo: 0, bed: 2, bath: 2, park: 1, area: 70, nb: 'Porto de Galinhas', city: 'Ipojuca', st: 'PE', lat: -8.5039, lng: -35.0047, furn: true, ext: 'apt', desc: 'Flat com vista para as piscinas naturais, em resort com café da manhã incluso. Diária para até 5 pessoas.', features: ['Vista mar', 'Resort', 'Café da manhã', 'Piscina', 'Wi-Fi'] },
  { title: 'Casa em condomínio no Recreio', purpose: 'aluguel', type: 'casa', price: 12000, condo: 1100, iptu: 450, bed: 4, suites: 3, bath: 4, park: 3, area: 300, land: 450, nb: 'Recreio dos Bandeirantes', city: 'Rio de Janeiro', st: 'RJ', lat: -23.0170, lng: -43.4623, pets: true, ext: 'house', desc: 'Casa ampla em condomínio com segurança, a poucos minutos da praia. Piscina e espaço gourmet.', features: ['Piscina', 'Espaço gourmet', 'Condomínio fechado', 'Pet friendly', 'Próximo à praia'] },
  { title: 'Apartamento 2 quartos no Centro', purpose: 'venda', type: 'apartamento', price: 420000, condo: 450, iptu: 120, bed: 2, bath: 1, park: 1, area: 58, nb: 'Centro', city: 'Florianópolis', st: 'SC', lat: -27.5954, lng: -48.5480, ext: 'apt', desc: 'Ótima opção para investimento ou primeiro imóvel, perto da UFSC e de todo o comércio central.', features: ['Aceita financiamento', 'Elevador', 'Portaria'] },
];

const AGENT_BIOS = [
  'Especialista em imóveis de alto padrão, 12 anos de mercado.',
  'Foco em locação residencial e primeiro imóvel. Atendimento ágil e humanizado.',
  'Corretor de lançamentos e imóveis litorâneos, apaixonado por arquitetura.',
];

export async function seed() {
  const t = now();
  const day = 86400_000;
  const password = await hashPassword('Demo@2026');

  const user = async (name: string, email: string, role: string, extra: { phone?: string; creci?: string; bio?: string; createdAgo?: number } = {}) =>
    (await run(
      'INSERT INTO users (name, email, phone, password_hash, role, creci, bio, terms_accepted_at, created_at, updated_at, last_login_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      name, email, extra.phone ?? null, password, role, extra.creci ?? null, extra.bio ?? null, t, t - (extra.createdAgo ?? 200) * day, t, t - 2 * day,
    )).id;

  await tx(async () => {
    const admin = await user('Walisson Oliveira', 'admin@walissonimoveis.com.br', 'admin', { phone: '(11) 99999-0000', creci: 'CRECI 123456-F', bio: 'Fundador da Walisson Imóveis.' });
    const agents = [
      await user('Mariana Costa', 'mariana@walissonimoveis.com.br', 'corretor', { phone: '(11) 98888-1111', creci: 'CRECI 234567-F', bio: AGENT_BIOS[0] }),
      await user('Rafael Souza', 'rafael@walissonimoveis.com.br', 'corretor', { phone: '(11) 97777-2222', creci: 'CRECI 345678-F', bio: AGENT_BIOS[1] }),
      await user('Juliana Alves', 'juliana@walissonimoveis.com.br', 'corretor', { phone: '(48) 96666-3333', creci: 'CRECI 456789-F', bio: AGENT_BIOS[2] }),
    ];
    const clients = [
      await user('Ana Beatriz Lima', 'cliente@walissonimoveis.com.br', 'cliente', { phone: '(11) 95555-4444', createdAgo: 40 }),
      await user('Carlos Mendes', 'carlos.mendes@email.com', 'cliente', { phone: '(21) 94444-5555', createdAgo: 25 }),
      await user('Fernanda Rocha', 'fernanda.rocha@email.com', 'cliente', { phone: '(41) 93333-6666', createdAgo: 12 }),
      await user('Lucas Pereira', 'lucas.pereira@email.com', 'cliente', { phone: '(31) 92222-7777', createdAgo: 6 }),
    ];

    const propIds: number[] = [];
    for (const [i, p] of PROPS.entries()) {
      const agent = agents[i % agents.length];
      const id = (await run(
        `INSERT INTO properties (code, title, description, purpose, type, status, price, condo_fee, iptu, bedrooms, suites, bathrooms, parking, area, land_area,
          address, neighborhood, city, state, zip, lat, lng, features, featured, accepts_financing, accepts_pets, furnished, views, agent_id, created_at, updated_at)
         VALUES (?,?,?,?,?, 'disponivel', ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        `WI-${1001 + i}`, p.title, p.desc, p.purpose, p.type, p.price, p.condo ?? 0, p.iptu ?? 0, p.bed, p.suites ?? 0, p.bath, p.park, p.area, p.land ?? 0,
        `Rua Exemplo, ${100 + i * 7}`, p.nb, p.city, p.st, '', p.lat, p.lng, JSON.stringify(p.features), p.feat ? 1 : 0, p.purpose === 'venda' ? 1 : 0,
        p.pets ? 1 : 0, p.furn ? 1 : 0, 40 + ((i * 137) % 900), agent, t - (60 - i * 2) * day, t - i * day,
      )).id;
      propIds.push(id);
      const main = p.ext === 'house' ? EXTERIORS[i % EXTERIORS.length] : APARTMENTS[i % APARTMENTS.length];
      const gallery = [main, INTERIORS[i % INTERIORS.length], INTERIORS[(i + 3) % INTERIORS.length], INTERIORS[(i + 6) % INTERIORS.length], p.ext === 'house' ? EXTERIORS[(i + 5) % EXTERIORS.length] : INTERIORS[(i + 1) % INTERIORS.length]];
      for (const [pos, g] of gallery.entries()) await run('INSERT INTO property_images (property_id, url, position) VALUES (?,?,?)', id, U(g), pos);
    }

    // Imóvel enviado por proprietário aguardando aprovação
    const pend = (await run(
      `INSERT INTO properties (code, title, description, purpose, type, status, price, bedrooms, bathrooms, parking, area, neighborhood, city, state, owner_id, agent_id, created_at, updated_at)
       VALUES ('WI-1100', 'Casa com quintal na Granja Viana', 'Casa que estou vendendo por mudança de cidade.', 'venda', 'casa', 'pendente', 1100000, 3, 2, 2, 190, 'Granja Viana', 'Cotia', 'SP', ?, ?, ?, ?)`,
      clients[2], agents[0], t - day, t - day,
    )).id;
    await run('INSERT INTO property_images (property_id, url, position) VALUES (?,?,0)', pend, U(EXTERIORS[7]));

    // Favoritos
    for (const [c, p] of [[0, 0], [0, 2], [0, 5], [0, 12], [1, 5], [1, 18], [2, 6], [3, 3], [3, 8]])
      await run('INSERT INTO favorites (user_id, property_id, created_at) VALUES (?,?,?)', clients[c], propIds[p], t - p * day);

    // Leads espalhados pelo funil + histórico de 12 meses
    const names = ['Paulo Henrique', 'Beatriz Santos', 'Rodrigo Martins', 'Camila Ferreira', 'Thiago Ribeiro', 'Larissa Gomes', 'Eduardo Nunes', 'Patrícia Duarte',
      'Gustavo Barros', 'Renata Carvalho', 'Felipe Araújo', 'Aline Moreira', 'Marcelo Teixeira', 'Vanessa Pinto', 'Bruno Cardoso', 'Tatiane Freitas',
      'Diego Monteiro', 'Priscila Ramos', 'Leonardo Castro', 'Juliana Dias', 'André Lopes', 'Isabela Melo', 'Ricardo Azevedo', 'Natália Correia'];
    const sources = ['site', 'app', 'whatsapp', 'instagram', 'indicacao', 'portal', 'facebook', 'telefone'];
    const stages = ['novo', 'novo', 'contato', 'contato', 'visita', 'visita', 'proposta', 'negociacao', 'ganho', 'perdido'];
    const temps = ['quente', 'morno', 'frio'];
    const leadIds: number[] = [];
    for (const [i, name] of names.entries()) {
      const stage = stages[i % stages.length];
      const pIdx = (i * 3) % PROPS.length;
      const created = t - ((i * 13) % 330) * day - (i % 5) * 3600_000;
      const agent = agents[i % agents.length];
      const id = (await run(
        `INSERT INTO leads (name, email, phone, source, stage, temperature, interest, budget, message, property_id, agent_id, lost_reason, created_at, updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        name, `${name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '.')}@email.com`, `(11) 9${String(8000 + i * 37).padStart(4, '0')}-${String(1000 + i * 91).slice(0, 4)}`,
        sources[i % sources.length], stage, temps[i % 3], PROPS[pIdx].purpose === 'venda' ? 'compra' : 'aluguel', PROPS[pIdx].price, 'Gostaria de mais informações sobre o imóvel.',
        propIds[pIdx], agent, stage === 'perdido' ? 'Comprou com outra imobiliária' : null, created, created + 2 * day,
      )).id;
      leadIds.push(id);
      await run("INSERT INTO lead_activities (lead_id, user_id, type, content, created_at) VALUES (?, NULL, 'sistema', ?, ?)", id, `Lead criado via ${sources[i % sources.length]}`, created);
      if (stage !== 'novo') await run("INSERT INTO lead_activities (lead_id, user_id, type, content, created_at) VALUES (?, ?, 'ligacao', 'Primeiro contato realizado. Cliente demonstrou interesse e pediu mais fotos.', ?)", id, agent, created + day);
      if (['visita', 'proposta', 'negociacao', 'ganho'].includes(stage)) await run("INSERT INTO lead_activities (lead_id, user_id, type, content, created_at) VALUES (?, ?, 'whatsapp', 'Enviado vídeo do imóvel e confirmada disponibilidade para visita.', ?)", id, agent, created + 2 * day);
      if (['proposta', 'negociacao', 'ganho'].includes(stage) || i % 4 === 0) {
        const value = Math.round(PROPS[pIdx].price * (0.9 + (i % 3) * 0.04));
        const st = stage === 'ganho' ? 'aceita' : stage === 'negociacao' ? 'contraproposta' : stage === 'perdido' ? 'recusada' : 'enviada';
        await run(
          'INSERT INTO proposals (lead_id, property_id, agent_id, value, payment, status, notes, valid_until, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
          id, propIds[pIdx], agent, value, i % 2 ? 'financiamento' : 'a_vista', st, 'Proposta registrada pelo corretor.', created + 10 * day, created + 3 * day, created + 4 * day,
        );
      }
    }

    // Negócios fechados nos últimos meses (para o gráfico de desempenho)
    for (let m = 0; m <= 11; m++) {
      const pIdx = (m * 5) % PROPS.length;
      const when = t - m * 30 * day + (m % 3) * day;
      const value = PROPS[pIdx].purpose === 'venda' ? Math.round(PROPS[pIdx].price * (0.92 + (m % 4) * 0.02)) : PROPS[pIdx].price * 12;
      await run(
        "INSERT INTO proposals (lead_id, property_id, agent_id, value, payment, status, notes, created_at, updated_at) VALUES (NULL, ?, ?, ?, 'financiamento', 'aceita', 'Negócio fechado', ?, ?)",
        propIds[pIdx], agents[m % agents.length], value, when - 5 * day, when,
      );
    }

    // Lead e histórico do cliente demo
    const demoLead = (await run(
      `INSERT INTO leads (name, email, phone, source, stage, temperature, interest, budget, message, property_id, agent_id, user_id, created_at, updated_at)
       VALUES ('Ana Beatriz Lima', 'cliente@walissonimoveis.com.br', '(11) 95555-4444', 'app', 'visita', 'quente', 'compra', 1890000, 'Procuro apartamento de 3 quartos perto do metrô.', ?, ?, ?, ?, ?)`,
      propIds[2], agents[2], clients[0], t - 10 * day, t - day,
    )).id;
    await run("INSERT INTO lead_activities (lead_id, user_id, type, content, created_at) VALUES (?, NULL, 'sistema', 'Lead criado via app', ?)", demoLead, t - 10 * day);
    await run("INSERT INTO lead_activities (lead_id, user_id, type, content, created_at) VALUES (?, ?, 'whatsapp', 'Cliente prefere visitas aos sábados pela manhã.', ?)", demoLead, agents[2], t - 8 * day);

    // Visitas
    const at = (daysFromNow: number, hour: number) => { const d = new Date(t + daysFromNow * day); d.setHours(hour, 0, 0, 0); return +d; };
    const visit = async (p: number, c: number | null, a: number, lead: number | null, when: number, status: string, feedback?: string, rating?: number) =>
      await run('INSERT INTO visits (property_id, client_id, agent_id, lead_id, scheduled_at, status, feedback, rating, created_at) VALUES (?,?,?,?,?,?,?,?,?)', propIds[p], c, a, lead, when, status, feedback ?? null, rating ?? null, t - 5 * day);
    await visit(2, clients[0], agents[2], demoLead, at(2, 10), 'confirmada');
    await visit(12, clients[0], agents[0], demoLead, at(5, 15), 'agendada');
    await visit(5, clients[0], agents[2], demoLead, at(-6, 11), 'realizada', 'Gostei muito da localização, mas achei a cozinha pequena.', 4);
    await visit(18, clients[1], agents[0], leadIds[4], at(1, 14), 'agendada');
    await visit(0, clients[3], agents[0], leadIds[5], at(3, 9), 'confirmada');
    await visit(6, null, agents[0], leadIds[14], at(4, 16), 'confirmada');
    await visit(16, clients[2], agents[0], null, at(-12, 10), 'realizada', 'Excelente atendimento!', 5);
    await visit(3, clients[3], agents[0], null, at(-3, 17), 'cancelada');

    // Proposta do cliente demo
    await run(
      "INSERT INTO proposals (lead_id, property_id, agent_id, client_id, value, payment, status, notes, valid_until, created_at, updated_at) VALUES (?,?,?,?,?, 'financiamento', 'contraproposta', 'Proprietário aceita R$ 6.500 com contrato de 30 meses.', ?, ?, ?)",
      demoLead, propIds[5], agents[2], clients[0], 6200, t + 5 * day, t - 3 * day, t - 2 * day,
    );

    // Conversas
    const conv = (await run('INSERT INTO conversations (client_id, agent_id, property_id, created_at, last_message_at) VALUES (?,?,?,?,?)', clients[0], agents[2], propIds[2], t - 9 * day, t - 3600_000)).id;
    const msgs: [number, string, number][] = [
      [clients[0], 'Olá! Tenho interesse no apartamento do Jardins. Ele ainda está disponível?', 9 * day],
      [agents[2], 'Olá, Ana! Está sim 😊 Quer agendar uma visita? Tenho horários no sábado de manhã.', 9 * day - 1800_000],
      [clients[0], 'Perfeito, sábado às 10h funciona para mim.', 8 * day],
      [agents[2], 'Combinado! Já deixei agendado. Te envio a localização no dia.', 8 * day - 600_000],
      [agents[2], 'Ana, o proprietário aceitou conversar sobre o valor. Posso te ligar hoje?', 3600_000],
    ];
    for (const [s, b, ago] of msgs) await run('INSERT INTO messages (conversation_id, sender_id, body, read_at, created_at) VALUES (?,?,?,?,?)', conv, s, b, ago > 3600_000 ? t - ago + 60_000 : null, t - ago);
    const conv2 = (await run('INSERT INTO conversations (client_id, agent_id, property_id, created_at, last_message_at) VALUES (?,?,?,?,?)', clients[1], agents[0], propIds[5], t - 2 * day, t - 2 * day)).id;
    await run('INSERT INTO messages (conversation_id, sender_id, body, created_at) VALUES (?,?,?,?)', conv2, clients[1], 'Boa tarde! O apartamento em Copacabana aceita pets?', t - 2 * day);

    // Tarefas
    const task = async (title: string, due: number, prio: string, lead: number | null, a: number, done = 0) =>
      await run('INSERT INTO tasks (title, due_at, done, priority, lead_id, assigned_to, created_by, created_at) VALUES (?,?,?,?,?,?,?,?)', title, due, done, prio, lead, a, admin, t - day);
    await task('Ligar para confirmar visita de sábado', at(1, 9), 'alta', demoLead, agents[2]);
    await task('Enviar documentação do imóvel WI-1003', at(2, 12), 'media', demoLead, agents[2]);
    await task('Retornar contato do Paulo Henrique', at(0, 18), 'alta', leadIds[0], agents[0]);
    await task('Atualizar fotos da cobertura em BC', at(4, 12), 'baixa', null, agents[1]);
    await task('Avaliar imóvel enviado na Granja Viana', at(1, 15), 'alta', null, agents[0]);
    await task('Preparar contrato de locação', at(-1, 12), 'media', leadIds[8], agents[2], 1);

    // Notificações
    const note = async (u: number, type: string, title: string, body: string, link: string, read = false) =>
      await run('INSERT INTO notifications (user_id, type, title, body, link, read_at, created_at) VALUES (?,?,?,?,?,?,?)', u, type, title, body, link, read ? t : null, t - 3600_000);
    await note(clients[0], 'visita', 'Visita confirmada', 'Apartamento 3 quartos no Jardins — sábado às 10h', '/visitas');
    await note(clients[0], 'preco', 'Preço reduzido em um favorito!', 'Apartamento garden em Moema', `/imovel/${propIds[12]}`);
    await note(clients[0], 'proposta', 'Sua proposta recebeu uma contraproposta', 'Apartamento com varanda em Copacabana', '/propostas', true);
    await note(admin, 'captacao', 'Novo imóvel para avaliação', 'Casa com quintal na Granja Viana', `/crm/imoveis/${pend}`);
    await note(agents[0], 'visita', 'Nova visita agendada', 'Carlos Mendes — Casa em condomínio no Recreio', '/crm/agenda');

    // Busca salva
    await run('INSERT INTO saved_searches (user_id, name, filters, alert, created_at) VALUES (?,?,?,1,?)', clients[0], 'Apês 3 quartos em SP', JSON.stringify({ purpose: 'venda', type: 'apartamento', city: 'São Paulo', bedrooms: 3 }), t - 7 * day);

    // Auditoria inicial
    await run("INSERT INTO audit_logs (user_id, action, ip, user_agent, meta, created_at) VALUES (?, 'system.seed', '127.0.0.1', 'seed', '{}', ?)", admin, t);
  });
  console.log('Dados de demonstração criados. Senha de todas as contas demo: Demo@2026');
}

// Execução direta: npm run seed:demo (recria os dados)
if (process.argv[1]?.endsWith('seed.ts')) {
  await ready;
  const has = await get('SELECT id FROM users LIMIT 1');
  if (has) {
    for (const tbl of ['audit_logs', 'saved_searches', 'notifications', 'messages', 'conversations', 'proposals', 'visits', 'tasks', 'lead_activities', 'leads', 'favorites', 'property_images', 'properties', 'files', 'password_resets', 'sessions', 'users']) {
      await run(`DELETE FROM ${tbl}`);
    }
    await run("DELETE FROM sqlite_sequence");
  }
  await seed();
}
