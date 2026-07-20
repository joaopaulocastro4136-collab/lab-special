// Ajusta a ficha do Lab Special para refletir o modo multi-laboratório
// (resposta à regra 3.2 da Apple): descrição de produto aberto a qualquer
// laboratório + notas ao analista respondendo as perguntas da recusa.
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const BUNDLE = 'com.laboratorio.special';

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return semAssin + '.' + assin;
}
async function api(metodo, caminho, corpo) {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + jwt(), 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const texto = await r.text();
  let dados = null;
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* vazio */ }
  return { status: r.status, dados };
}
function falha(msg, resp) {
  console.error('ERRO: ' + msg, resp ? JSON.stringify(resp.dados || {}).slice(0, 400) : '');
  process.exit(1);
}

const DESCRICAO = `O Special Lab é o sistema de gestão completo para laboratórios de prótese dentária — qualquer laboratório pode criar sua conta gratuitamente e começar a usar na hora.

CRIE A CONTA DO SEU LABORATÓRIO
Entre com Apple ou Google e o espaço de trabalho do seu laboratório é criado automaticamente. Sem convite, sem cadastro prévio, sem custo.

PRODUÇÃO ORGANIZADA
• Casos com etapas por tipo de trabalho e cronômetro de execução
• Agenda de entregas com prazos que respeitam seus dias de trabalho
• Fotos, vídeos e arquivos anexados a cada trabalho

CONECTADO AO DENTISTA
• Convide seus dentistas parceiros: eles acompanham tudo pelo aplicativo Special Clinic
• Pedidos chegam do consultório com fotos e arquivos
• Aprovação de provas com aviso no celular do dentista

FINANCEIRO SEM PLANILHA
• Fechamento do mês por dentista e por tipo de trabalho
• Comissões da equipe calculadas automaticamente
• Recebimentos com Pix

E AINDA
• Notificações no celular a cada acontecimento importante
• IA Special: simulação do novo sorriso a partir da foto do paciente
• Funciona no iPhone, iPad, Android e no navegador

Feito por quem vive a rotina de laboratório, para laboratórios de todos os tamanhos.`;

const NOTAS = `Lab Special is a management platform for ANY dental prosthesis laboratory - it is NOT restricted to a single business or organization.

Answers to the review questions:
1. The app is NOT restricted to users of a single company. Any dental laboratory can create its own account.
2. It is not limited to a specific group of companies: any dental prosthesis laboratory can become a user. Each one gets its own independent workspace.
3. All features are available to the general public: production management (cases, steps, schedule), team commissions, finances, and integration with partner dentists via the companion app Special Clinic (already live on the App Store).
4. HOW TO GET AN ACCOUNT: simply sign in with Apple or Google on the first screen - a brand-new laboratory workspace is created automatically. No invitation, no pre-approved registration, no affiliation required. The reviewer can test this right now: tap "Continuar com Apple" and a fresh workspace opens immediately.
5. The app is completely free. There is no paid content.

The app description has been updated to reflect this open registration model.`;

// 1. App e versão editável
const apps = await api('GET', `/v1/apps?filter[bundleId]=${BUNDLE}`);
const app = ((apps.dados && apps.dados.data) || []).find(a => a.attributes.bundleId === BUNDLE);
if (!app) falha('app não encontrado');
console.log(`App: ${app.attributes.name}`);
const ESTADOS = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'WAITING_FOR_REVIEW', 'IN_REVIEW'];
const vers = await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`);
const versao = ((vers.dados && vers.dados.data) || []).find(v => ESTADOS.includes(v.attributes.appStoreState));
if (!versao) falha('nenhuma versão editável');
console.log(`Versão: ${versao.attributes.versionString} (${versao.attributes.appStoreState})`);

// 2. Descrição nova em todos os idiomas da ficha
const locs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
for (const loc of ((locs.dados && locs.dados.data) || [])) {
  const r = await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
    data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: { description: DESCRICAO } },
  });
  if (r.status >= 300) falha(`descrição (${loc.attributes.locale})`, r);
  console.log(`Descrição (${loc.attributes.locale}) atualizada ✓`);
}

// 3. Notas ao analista (as respostas das 5 perguntas ficam na revisão)
const det = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreReviewDetail`);
if (det.dados && det.dados.data) {
  const d = det.dados.data;
  const r = await api('PATCH', `/v1/appStoreReviewDetails/${d.id}`, {
    data: { type: 'appStoreReviewDetails', id: d.id, attributes: { notes: NOTAS, demoAccountRequired: false } },
  });
  if (r.status >= 300) falha('notas ao analista', r);
  console.log('Notas ao analista atualizadas ✓');
} else {
  const r = await api('POST', '/v1/appStoreReviewDetails', {
    data: {
      type: 'appStoreReviewDetails',
      attributes: { notes: NOTAS, demoAccountRequired: false, contactFirstName: 'Joao Paulo', contactLastName: 'de Castro', contactEmail: 'joaopaulocastro41@gmail.com', contactPhone: '+5574999999999' },
      relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versao.id } } },
    },
  });
  if (r.status >= 300) falha('notas ao analista (criação)', r);
  console.log('Notas ao analista criadas ✓');
}

console.log('\nFICHA AJUSTADA PARA O MODO MULTI-LABORATÓRIO ✓');
