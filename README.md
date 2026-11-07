# Walisson Imóveis

App completo de imobiliária: **portal do cliente** (mobile-first, funciona como app no celular), **CRM para corretores e administradores** e uma camada de **segurança** de verdade (2FA, bloqueio de força bruta, CSRF, auditoria, LGPD).

Visual inspirado em apps imobiliários premium: tema escuro café/dourado com tema claro creme, cartões com foto em tela cheia, vidro fosco e navegação em pílula.

---

## Como rodar

Requisitos: **Node.js 22.13 ou superior** (usa o SQLite embutido do Node, sem instalar banco).

```bash
npm install
npm run dev        # API em :3333 + front em http://localhost:5173
```

Na primeira execução o banco é criado em `data/walisson.db` e populado com dados de demonstração.

| Conta | E-mail | Senha |
|---|---|---|
| Administrador | `admin@walissonimoveis.com.br` | `Demo@2026` |
| Corretor(a) | `mariana@walissonimoveis.com.br` | `Demo@2026` |
| Cliente | `cliente@walissonimoveis.com.br` | `Demo@2026` |

Na tela de login há atalhos para preencher essas contas.

Outros comandos:

```bash
npm run build      # compila o front-end para dist/
npm start          # produção: API + front compilado em http://localhost:3333
npm run seed       # recria os dados de demonstração (apaga o banco atual)
npm test           # testes automatizados de segurança e regras de negócio
npm run typecheck
```

---

## Funcionalidades

### Portal do cliente
- **Onboarding** em 3 telas, **cadastro**, **login**, **recuperação de senha** e **verificação em duas etapas**.
- **Início**: busca, atalhos (Comprar / Alugar / Temporada / Corretores), carrossel de destaques, cidades populares, novidades por tipo.
- **Busca avançada**: finalidade, tipo, cidade, bairro, faixa de preço, quartos, banheiros, vagas, área, pets, mobiliado, financiamento; ordenação; visualização em **grade, lista ou mapa**.
- **Página do imóvel**: galeria com tela cheia, características, custos (condomínio/IPTU), diferenciais, mapa, corretor responsável (chat, WhatsApp, ligação), imóveis semelhantes, compartilhar.
- **Agendamento de visitas** com escolha de dia/horário e bloqueio de horários ocupados.
- **Propostas** com forma de pagamento e acompanhamento do status.
- **Simulador de financiamento** SAC × Price com renda sugerida.
- **Favoritos** (com aviso de redução de preço), **comparador** de até 3 imóveis, **alertas de busca** (notifica quando entra imóvel compatível).
- **Chat** com o corretor, **notificações**, **avaliação da visita**.
- **Anunciar imóvel**: o proprietário envia dados e fotos; vira lead de captação no CRM.
- **Minha conta**: perfil e foto, tema claro/escuro, segurança e privacidade.

### CRM (corretor e administrador)
- **Dashboard**: leads do mês, VGV e comissão estimada, visitas, conversão, gráfico de 12 meses (VGV/leads/visitas), funil, próximas visitas, tarefas, leads quentes, origem dos leads, imóveis em alta e ranking de corretores.
- **Leads & Funil**: kanban com arrastar e soltar (Novo → Contato → Visita → Proposta → Negociação → Ganho/Perdido), lista com filtros, motivo de perda obrigatório, distribuição automática em rodízio.
- **Ficha do lead**: contato rápido, temperatura, orçamento, imóvel de interesse, favoritos do cliente, tarefas, visitas, propostas e histórico de interações (nota, ligação, WhatsApp, e-mail, reunião).
- **Agenda**: semana com visitas, confirmação/cancelamento, tarefas com prioridade e prazo.
- **Imóveis**: cadastro/edição completo com upload e ordenação de fotos, aprovação de imóveis enviados por proprietários, destaque na vitrine.
- **Propostas**: aceitar, recusar ou contrapropor; aceitar fecha o negócio (imóvel vendido/alugado, lead ganho, demais propostas recusadas).
- **Clientes**, **mensagens**, **exportação CSV** (leads, imóveis, propostas).
- **Equipe** (admin): criar corretores/admins, alterar papel, desativar, desbloquear contas.
- **Central de segurança** (admin): indicadores e trilha de auditoria completa.

---

## Segurança

| Proteção | Como |
|---|---|
| Senhas | `scrypt` (memory-hard) com salt por usuário; política de senha forte; nunca expostas pela API |
| Força bruta | rate limit por IP em login/cadastro/recuperação/2FA + bloqueio da conta após 5 falhas (15 min) |
| Enumeração de usuários | mesma mensagem e mesmo tempo de resposta para e-mail inexistente ou senha errada |
| Sessões | token aleatório (só o hash SHA-256 fica no banco), cookie `HttpOnly` + `SameSite=Lax` (+ `Secure`/`__Host-` em produção), rotação no login, expiração, "sair dos outros dispositivos" |
| CSRF | token sincronizado exigido no header `X-CSRF-Token` em toda requisição que altera dados |
| 2FA | TOTP (Google Authenticator, Authy…) com QR Code e 8 códigos de recuperação de uso único |
| Autorização | papéis (cliente/corretor/admin) + escopo de carteira (corretor só vê os próprios leads); troca de papel ou desativação derruba as sessões |
| Headers | Helmet: CSP restritiva, HSTS (produção), `frame-ancestors 'none'`, `nosniff`, Referrer-Policy, Permissions-Policy |
| Entradas | validação com Zod em todas as rotas; SQL sempre parametrizado; limite de tamanho do corpo |
| Uploads | só JPG/PNG/WEBP validados pela assinatura binária (SVG/HTML recusados), nome aleatório, 8 MB |
| CSV | neutraliza injeção de fórmulas (`=`, `+`, `-`, `@`) |
| Privacidade | endereço exato do imóvel só para a equipe; honeypot anti-spam no formulário de contato |
| LGPD | aceite de termos registrado, consentimento de marketing opcional, exportação dos dados (JSON) e exclusão/anonimização da conta |
| Auditoria | logins, falhas, bloqueios, 2FA, alterações de usuários/imóveis/leads/propostas e exportações |

Os testes em `server/test/security.test.ts` cobrem esses pontos (senha fraca, escalada de privilégio, bloqueio, CSRF, permissões, 2FA, reset de senha, upload malicioso, injeção em CSV, fluxo de negócio e LGPD).

---

## Estrutura

```
client/                 front-end (React 19 + Vite + Tailwind CSS 4)
  src/pages/            telas do portal (home, busca, imóvel, conta…)
  src/pages/crm/        telas do CRM (dashboard, leads, imóveis, agenda, admin)
  src/components/       UI, cartões de imóvel, mapa, gráficos, layouts
server/                 API (Express 5 + SQLite nativo do Node)
  src/routes/           auth, imóveis, área do cliente, CRM
  src/lib/              criptografia/TOTP, sessões/CSRF, auditoria/notificações
  src/seed.ts           dados de demonstração
  test/                 testes de integração
data/                   banco SQLite e fotos enviadas (fora do git)
```

---

## Colocando em produção

1. Copie `.env.example` para `.env` e ajuste `APP_URL`, `NODE_ENV=production` e `TRUST_PROXY` (1 se estiver atrás de Nginx/Cloudflare).
2. `npm ci && npm run build && npm start`.
3. Sirva **sempre via HTTPS** (o cookie de sessão usa `Secure` e prefixo `__Host-` em produção).
4. Faça backup periódico da pasta `data/` (banco + fotos).

Pontos de integração deixados prontos:
- **E-mail** (recuperação de senha): em `server/src/routes/auth.ts`, rota `/forgot`, troque o `console.log` pelo seu provedor (SES, SendGrid, Resend…). Em desenvolvimento o link aparece na própria tela.
- **Fotos de demonstração**: o seed usa imagens do Unsplash por URL; os imóveis reais usam o upload próprio do app.
- **Mapa**: OpenStreetMap/CARTO via Leaflet, sem chave de API.
- **Termos de uso**: o texto em `/termos` é um modelo — revise com sua assessoria jurídica.
