import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ShieldCheck } from 'lucide-react';
import { COMPANY } from '../lib/company';
import { Card, PageHeader } from '../components/ui';
import { Page } from '../components/layout';

/* Blocos de texto dos documentos legais */
function Doc({ children }: { children: ReactNode }) {
  return <Card className="space-y-8 p-5 text-[15px] leading-relaxed text-muted md:p-8">{children}</Card>;
}
function Sec({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-text">{n}. {title}</h2>
      {children}
    </section>
  );
}
function List({ items }: { items: ReactNode[] }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">{items.map((it, i) => <li key={i}>{it}</li>)}</ul>;
}
const B = ({ children }: { children: ReactNode }) => <b className="font-semibold text-text">{children}</b>;

function Toc({ items }: { items: [string, string][] }) {
  return (
    <nav aria-label="Sumário" className="rounded-2xl bg-surface-2 p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Sumário</p>
      <ol className="grid gap-1 text-sm sm:grid-cols-2">
        {items.map(([id, t], i) => (
          <li key={id}>
            <button onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })} className="text-left text-muted hover:text-accent">
              {i + 1}. {t}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Identity() {
  const lines = [
    COMPANY.legalName ? `${COMPANY.legalName} (nome fantasia ${COMPANY.name})` : COMPANY.name,
    COMPANY.document && `${COMPANY.document.length > 14 ? 'CNPJ' : 'CPF'} ${COMPANY.document}`,
    COMPANY.address,
  ].filter(Boolean);
  return <>{lines.join(' · ')}</>;
}

function ContactBox() {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-2 p-4 sm:flex-row sm:items-center">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent"><Mail className="size-5" /></span>
      <div className="min-w-0 text-sm">
        <p className="font-semibold text-text">Encarregado pelo tratamento de dados (DPO){COMPANY.dpoName ? `: ${COMPANY.dpoName}` : ''}</p>
        <p className="select-all break-all">{COMPANY.email}</p>
      </div>
    </div>
  );
}

/* ============================ Política de Privacidade ============================ */
const PRIVACY_TOC: [string, string][] = [
  ['quem-somos', 'Quem somos'],
  ['dados', 'Dados que coletamos'],
  ['finalidades', 'Para que usamos e bases legais'],
  ['compartilhamento', 'Com quem compartilhamos'],
  ['internacional', 'Transferência internacional'],
  ['cookies', 'Cookies e armazenamento local'],
  ['notificacoes', 'Notificações e comunicações'],
  ['retencao', 'Por quanto tempo guardamos'],
  ['direitos', 'Seus direitos'],
  ['seguranca', 'Como protegemos seus dados'],
  ['menores', 'Crianças e adolescentes'],
  ['alteracoes', 'Alterações desta política'],
  ['contato', 'Contato'],
];

export function PrivacyPolicy() {
  return (
    <Page>
      <PageHeader back title="Política de Privacidade" subtitle={`Última atualização: ${COMPANY.privacyUpdatedAt}`} />
      <Doc>
        <div className="space-y-4">
          <p>
            Esta política explica como a <B>{COMPANY.name}</B> coleta, usa, compartilha e protege os dados pessoais de quem usa o nosso site e o
            aplicativo para Android, em conformidade com a <B>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</B> e o
            Marco Civil da Internet (Lei nº 12.965/2014).
          </p>
          <div className="flex items-start gap-2 rounded-2xl bg-success-soft p-4 text-sm text-text">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-success" />
            <span>Resumo: usamos seus dados só para o atendimento imobiliário que você pediu. <B>Não vendemos dados</B>, não usamos
            anúncios nem rastreadores de terceiros, e você pode baixar ou apagar seus dados a qualquer momento pelo próprio app.</span>
          </div>
          <Toc items={PRIVACY_TOC} />
        </div>

        <Sec id="quem-somos" n={1} title="Quem somos">
          <p>
            O controlador dos dados é a <Identity />. Somos uma imobiliária que divulga imóveis para venda, locação e temporada, agenda visitas,
            intermedeia propostas e mantém o relacionamento com clientes e proprietários.
          </p>
        </Sec>

        <Sec id="dados" n={2} title="Dados que coletamos">
          <p><B>Informados por você</B></p>
          <List items={[
            <>Cadastro: nome, e-mail, celular e senha (a senha é guardada apenas como código criptografado irreversível — ninguém, nem nossa equipe, consegue lê-la).</>,
            <>Perfil: foto (opcional) e, para corretores, número do CRECI e apresentação.</>,
            <>Interesse em imóveis: mensagens enviadas pelo formulário “Fale com um corretor”, orçamento e tipo de interesse.</>,
            <>Visitas: data e horário escolhidos, observações, avaliação e comentário sobre a visita.</>,
            <>Propostas: valor oferecido, forma de pagamento e condições.</>,
            <>Conversas com corretores pelo chat do app.</>,
            <>Alertas de busca salvos (filtros como cidade, faixa de preço e número de quartos) e imóveis favoritos.</>,
            <>Anúncio de imóvel (proprietários): dados do imóvel, endereço e fotos enviadas.</>,
          ]} />
          <p><B>Gerados pelo uso</B></p>
          <List items={[
            <>Registros de acesso e segurança: endereço IP, navegador/aparelho, data e hora de login, tentativas de login malsucedidas e ações sensíveis (como troca de senha).</>,
            <>Sessão de login: um identificador aleatório para manter você conectado.</>,
            <>Aplicativo Android: um identificador do aparelho para notificações (token do Firebase Cloud Messaging), usado apenas para enviar avisos à sua conta.</>,
            <>Registros internos de atendimento: anotações da equipe sobre o andamento do seu atendimento (ligações, visitas, etapas da negociação).</>,
          ]} />
          <p>
            <B>Não coletamos</B> dados sensíveis (como origem racial, religião ou saúde), não usamos sua localização GPS e não acessamos seus contatos.
            Documentos pessoais para contratos (RG, CPF, comprovantes) não são pedidos pelo app; quando necessários, são tratados diretamente com o corretor.
          </p>
        </Sec>

        <Sec id="finalidades" n={3} title="Para que usamos e bases legais">
          <div className="grid gap-2">
            {[
                  ['Criar e manter sua conta; mostrar favoritos, visitas, propostas e mensagens', 'Execução de contrato e de procedimentos preliminares (inciso V)'],
                  ['Responder seu interesse, agendar visitas e intermediar propostas com o corretor e o proprietário', 'Execução de contrato e de procedimentos preliminares (V)'],
                  ['Avisar sobre visitas, mensagens, propostas, redução de preço e novos imóveis do seu alerta', 'Execução de contrato (V) e legítimo interesse (IX); você pode desligar push e e-mail'],
                  ['Distribuir contatos entre os corretores e registrar o andamento do atendimento (CRM)', 'Legítimo interesse (IX)'],
                  ['Segurança: impedir acessos indevidos, bloquear tentativas repetidas de senha, registrar acessos', 'Legítimo interesse (IX) e obrigação legal — guarda de registros de acesso (II; Marco Civil, art. 15)'],
                  ['Cumprir exigências legais do setor imobiliário e responder a autoridades', 'Cumprimento de obrigação legal ou regulatória (II) e exercício regular de direitos (VI)'],
                  ['Enviar novidades e oportunidades por e-mail', 'Consentimento (I) — opcional, pode ser retirado a qualquer momento'],
                ].map(([a, b]) => (
              <div key={a} className="rounded-2xl border border-line bg-surface-2 p-4">
                <p className="font-medium text-text">{a}</p>
                <p className="mt-1 text-sm"><span className="text-faint">Base legal: </span>{b}</p>
              </div>
            ))}
          </div>
          <p>Não tomamos decisões automatizadas que produzam efeitos jurídicos sobre você. A distribuição automática de contatos entre corretores serve apenas para organizar o atendimento.</p>
        </Sec>

        <Sec id="compartilhamento" n={4} title="Com quem compartilhamos">
          <p><B>Não vendemos nem alugamos dados pessoais.</B> Compartilhamos apenas o necessário com:</p>
          <List items={[
            <><B>Corretor responsável</B> pelo imóvel ou pelo seu atendimento, que faz parte da nossa equipe.</>,
            <><B>Proprietário do imóvel</B>, quando necessário para a negociação (por exemplo, ao encaminhar uma proposta).</>,
            <><B>Instituições financeiras</B> ou correspondentes, somente se você pedir uma simulação ou análise de crédito.</>,
            <><B>Fornecedores de tecnologia</B> que operam o app em nosso nome (operadores), seguindo nossas instruções:
              <List items={[
                <>Render (hospedagem do servidor) — Estados Unidos;</>,
                <>Turso (banco de dados, onde ficam os dados e as fotos) — Estados Unidos;</>,
                <>Google Firebase Cloud Messaging (envio de notificações push no Android) — Estados Unidos;</>,
                <>Brevo (envio de e-mails transacionais) — União Europeia;</>,
                <>Google Fonts (tipografia) e CARTO/OpenStreetMap (mapas) — recebem o endereço IP do aparelho ao carregar fontes e mapas.</>,
              ]} />
            </>,
            <><B>Autoridades públicas</B>, quando exigido por lei ou ordem judicial.</>,
          ]} />
          <p>Ao tocar em links de WhatsApp, telefone ou e-mail, você sai do nosso app e passa a usar o serviço escolhido, sujeito à política de privacidade dele.</p>
        </Sec>

        <Sec id="internacional" n={5} title="Transferência internacional">
          <p>
            Alguns fornecedores armazenam ou processam dados fora do Brasil (Estados Unidos e União Europeia). Essas transferências ocorrem para a execução
            do serviço que você contratou e com fornecedores que adotam salvaguardas de segurança e proteção de dados compatíveis com a LGPD (art. 33).
          </p>
        </Sec>

        <Sec id="cookies" n={6} title="Cookies e armazenamento local">
          <List items={[
            <><B>Cookie de sessão</B> (necessário): mantém você conectado com segurança. É protegido contra acesso por scripts e expira em até 12 horas, ou 30 dias se você marcar “Manter conectado”.</>,
            <><B>Armazenamento local do navegador</B>: guarda apenas preferências do aparelho — tema claro/escuro, se você já viu a apresentação inicial e a lista de imóveis para comparar.</>,
          ]} />
          <p><B>Não usamos</B> cookies de publicidade, de redes sociais nem ferramentas de análise de terceiros.</p>
        </Sec>

        <Sec id="notificacoes" n={7} title="Notificações e comunicações">
          <p>
            Enviamos avisos sobre a sua conta e o seu atendimento (visitas, mensagens, propostas, alertas de imóveis e segurança) dentro do app, por
            notificação push no Android e por e-mail. Você escolhe os canais em <B>Minha conta → Notificações</B>. E-mails de segurança, como a redefinição
            de senha, são sempre enviados quando você os solicita. Mensagens de marketing só são enviadas se você autorizar, e você pode cancelar quando quiser.
          </p>
        </Sec>

        <Sec id="retencao" n={8} title="Por quanto tempo guardamos">
          <List items={[
            <>Dados da conta e do atendimento: enquanto a conta estiver ativa ou enquanto durar o relacionamento.</>,
            <>Ao excluir a conta: os dados pessoais são apagados ou anonimizados imediatamente; registros ligados a negociações podem ser mantidos de forma anonimizada.</>,
            <>Registros de acesso: no mínimo 6 meses, como exige o Marco Civil da Internet (art. 15).</>,
            <>Registros de transações imobiliárias: pelo prazo exigido pela legislação aplicável ao setor (por exemplo, 5 anos, conforme a Lei nº 9.613/1998), quando houver negociação.</>,
            <>Sessões de login expiram automaticamente; links de redefinição de senha valem 30 minutos.</>,
            <>Fotos de anúncios: apagadas quando o imóvel é excluído ou a foto é removida.</>,
          ]} />
        </Sec>

        <Sec id="direitos" n={9} title="Seus direitos">
          <p>Pela LGPD (art. 18), você pode, a qualquer momento:</p>
          <List items={[
            'confirmar se tratamos seus dados e acessá-los;',
            'corrigir dados incompletos, inexatos ou desatualizados;',
            'pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;',
            'receber seus dados em formato portável;',
            'saber com quem compartilhamos seus dados;',
            'retirar o consentimento e saber as consequências de não fornecê-lo;',
            'opor-se a tratamentos feitos com base em legítimo interesse;',
            'apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).',
          ]} />
          <p>
            Muitos desses direitos estão disponíveis direto no app: <B>Minha conta</B> (editar dados), <B>Notificações</B> (canais de aviso) e{' '}
            <B>Privacidade e dados</B> (baixar todos os seus dados e excluir a conta). Para os demais, escreva para o e-mail abaixo — respondemos em até 15 dias.
          </p>
        </Sec>

        <Sec id="seguranca" n={10} title="Como protegemos seus dados">
          <List items={[
            'conexão sempre criptografada (HTTPS);',
            'senhas guardadas com criptografia irreversível (scrypt), nunca em texto;',
            'bloqueio temporário após tentativas repetidas de senha e limite de requisições;',
            'verificação em duas etapas opcional (app autenticador) com códigos de recuperação;',
            'cookies de sessão protegidos e proteção contra requisições forjadas (CSRF);',
            'acesso da equipe limitado por função — cada corretor vê apenas os próprios atendimentos;',
            'fotos enviadas são verificadas pelo conteúdo e guardadas com nomes aleatórios;',
            'registro de auditoria das ações sensíveis.',
          ]} />
          <p>Nenhum sistema é 100% invulnerável. Se ocorrer um incidente de segurança que possa trazer risco relevante, avisaremos você e a ANPD, como prevê a LGPD.</p>
        </Sec>

        <Sec id="menores" n={11} title="Crianças e adolescentes">
          <p>O app é destinado a maiores de 18 anos. Não coletamos intencionalmente dados de menores; se identificarmos uma conta de menor, ela será excluída.</p>
        </Sec>

        <Sec id="alteracoes" n={12} title="Alterações desta política">
          <p>Podemos atualizar esta política para refletir mudanças no app ou na lei. A data no topo indica a versão atual; mudanças relevantes serão avisadas no próprio app.</p>
        </Sec>

        <Sec id="contato" n={13} title="Contato">
          <p>Dúvidas, pedidos ou reclamações sobre seus dados:</p>
          <ContactBox />
          <p className="text-sm">Veja também os <Link to="/termos" className="font-semibold text-accent hover:underline">Termos de Uso</Link>.</p>
        </Sec>
      </Doc>
    </Page>
  );
}

/* ============================ Termos de Uso ============================ */
export function Terms() {
  return (
    <Page>
      <PageHeader back title="Termos de Uso" subtitle={`Última atualização: ${COMPANY.termsUpdatedAt}`} />
      <Doc>
        <p>Estes termos regem o uso do site e do aplicativo da <B><Identity /></B>. Ao criar uma conta ou usar o app, você concorda com eles e com a nossa{' '}
          <Link to="/privacidade" className="font-semibold text-accent hover:underline">Política de Privacidade</Link>.</p>
        <Sec id="servico" n={1} title="O serviço">
          <p>O app permite buscar imóveis, salvar favoritos, agendar visitas, conversar com corretores, enviar propostas, simular financiamentos e anunciar imóveis para avaliação. O uso é gratuito para clientes.</p>
        </Sec>
        <Sec id="conta" n={2} title="Sua conta">
          <List items={[
            'Você deve ter 18 anos ou mais e informar dados verdadeiros.',
            'Você é responsável por manter sua senha em sigilo. Recomendamos ativar a verificação em duas etapas.',
            'Podemos suspender contas usadas para fraude, spam, assédio ou violação destes termos.',
            'Você pode excluir sua conta a qualquer momento em Minha conta → Privacidade e dados.',
          ]} />
        </Sec>
        <Sec id="anuncios" n={3} title="Anúncios e informações dos imóveis">
          <List items={[
            'As informações dos anúncios são fornecidas pelos proprietários e conferidas pela nossa equipe, mas podem sofrer alterações de valor, disponibilidade e condições sem aviso prévio.',
            'Fotos, plantas e descrições são ilustrativas. Confirme os detalhes na visita e na documentação do imóvel.',
            'A localização no mapa é aproximada; o endereço exato é informado pelo corretor.',
            'Ao anunciar um imóvel, você declara ter direito de oferecê-lo e autoriza a publicação das fotos e informações após nossa avaliação.',
          ]} />
        </Sec>
        <Sec id="propostas" n={4} title="Visitas, propostas e simulações">
          <List items={[
            'Agendamentos são solicitações e dependem de confirmação do corretor.',
            'Propostas enviadas pelo app não são vinculantes: a negociação só se conclui com a assinatura do contrato.',
            'O simulador de financiamento é ilustrativo e não substitui a análise de crédito da instituição financeira.',
          ]} />
        </Sec>
        <Sec id="conduta" n={5} title="Uso adequado">
          <p>Não é permitido usar o app para enviar conteúdo ilegal, ofensivo ou enganoso, tentar acessar contas ou dados de terceiros, burlar mecanismos de segurança ou coletar dados de forma automatizada.</p>
        </Sec>
        <Sec id="responsabilidade" n={6} title="Responsabilidades">
          <p>Trabalhamos para manter o app disponível e seguro, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros. Não nos responsabilizamos por serviços externos acessados por links (como WhatsApp) nem por informações fornecidas por terceiros, respeitados os direitos previstos no Código de Defesa do Consumidor.</p>
        </Sec>
        <Sec id="alteracoes-termos" n={7} title="Alterações e foro">
          <p>Estes termos podem ser atualizados; a versão vigente fica sempre nesta página. Aplica-se a legislação brasileira. Fica eleito o foro {COMPANY.forum ? `da comarca de ${COMPANY.forum}` : 'do domicílio do consumidor'} para resolver eventuais controvérsias.</p>
          <ContactBox />
        </Sec>
      </Doc>
    </Page>
  );
}
