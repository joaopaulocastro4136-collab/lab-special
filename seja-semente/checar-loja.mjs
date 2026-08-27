// Confere se algum aplicativo do Seja Semente está indo (ou já foi) para a
// LOJA da Apple. O combinado do projeto é ficar só no TestFlight — este
// script é a conferência: mostra o estado da versão de loja de cada app e
// se existe alguma submissão para análise em andamento.
import crypto from 'crypto';

const APPS = [
  ['com.sejasemente.central', 'Seja Semente'],
  ['com.sejasemente.semeador', 'Semeador'],
  ['com.sejasemente.palmar', 'Palmar'],
  ['com.sejasemente.colheita', 'Colheita'],
];

// O que cada estado quer dizer, em português
const ESTADOS = {
  PREPARE_FOR_SUBMISSION: 'rascunho (NÃO enviado — só um espaço em branco na loja)',
  DEVELOPER_REMOVED_FROM_SALE: 'retirada da loja',
  DEVELOPER_REJECTED: 'cancelada pelo desenvolvedor',
  IN_REVIEW: '⚠ EM ANÁLISE NA APPLE',
  INVALID_BINARY: 'binário inválido',
  METADATA_REJECTED: 'recusada por dados da ficha',
  PENDING_APPLE_RELEASE: '⚠ aprovada, esperando a Apple publicar',
  PENDING_CONTRACT: 'esperando contrato',
  PENDING_DEVELOPER_RELEASE: '⚠ APROVADA — esperando você mandar publicar',
  PREPARE_FOR_UPLOAD: 'preparando envio',
  PROCESSING_FOR_DISTRIBUTION: 'processando para distribuição',
  READY_FOR_DISTRIBUTION: '⚠ pronta para distribuir',
  READY_FOR_SALE: '⚠ PUBLICADA NA LOJA',
  REJECTED: 'recusada pela Apple',
  REPLACED_WITH_NEW_VERSION: 'trocada por uma versão nova',
  WAITING_FOR_EXPORT_COMPLIANCE: 'esperando declaração de criptografia',
  WAITING_FOR_REVIEW: '⚠ NA FILA DA ANÁLISE DA APPLE',
};

const KEY = process.env.ASC_KEY_P8.replace(/\\n/g, '\n');
function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const cab = b64({ alg: 'ES256', kid: process.env.ASC_KEY_ID, typ: 'JWT' });
  const corpo = b64({ iss: process.env.ASC_ISSUER_ID, iat: agora, exp: agora + 900, aud: 'appstoreconnect-v1' });
  const assin = crypto.sign('SHA256', Buffer.from(`${cab}.${corpo}`), { key: KEY, dsaEncoding: 'ieee-p1363' });
  return `${cab}.${corpo}.${assin.toString('base64url')}`;
}
const TK = token();
const api = async (caminho) => {
  const r = await fetch('https://api.appstoreconnect.apple.com/v1' + caminho, { headers: { Authorization: 'Bearer ' + TK } });
  return r.ok ? r.json() : { erro: r.status };
};

let indoParaLoja = 0;
for (const [bundle, nome] of APPS) {
  const apps = await api(`/apps?filter[bundleId]=${bundle}`);
  const app = apps.data?.[0];
  if (!app) { console.log(`· ${nome}: aplicativo não encontrado`); continue; }

  const versoes = await api(`/apps/${app.id}/appStoreVersions?limit=3`);
  if (versoes.erro) { console.log(`· ${nome}: não consegui consultar (${versoes.erro})`); continue; }
  const lista = versoes.data || [];
  if (!lista.length) {
    console.log(`✓ ${nome}: NENHUMA versão de loja criada — está só no TestFlight`);
    continue;
  }
  for (const v of lista) {
    const est = v.attributes.appStoreState || v.attributes.appVersionState || '?';
    const alerta = String(ESTADOS[est] || est).startsWith('⚠');
    if (alerta) indoParaLoja++;
    console.log(`${alerta ? '⚠' : '✓'} ${nome} ${v.attributes.versionString}: ${ESTADOS[est] || est}`);
  }
  // Existe uma submissão de loja em andamento?
  const sub = await api(`/apps/${app.id}/appStoreVersions?limit=1&include=appStoreVersionSubmission`);
  const temSub = (sub.included || []).some(x => x.type === 'appStoreVersionSubmissions');
  if (temSub) { indoParaLoja++; console.log(`   ⚠ ${nome}: existe uma SUBMISSÃO para a loja registrada`); }
}

console.log('');
console.log(indoParaLoja
  ? `⚠ ATENÇÃO: ${indoParaLoja} situação(ões) apontando para a LOJA — confira acima.`
  : '✓ Nada indo para a loja: os quatro aplicativos estão só no TestFlight, como combinado.');
