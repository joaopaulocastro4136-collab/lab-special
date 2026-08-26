// ═══════════════════════════════════════════════════════════════════════════
//  A DECLARAÇÃO DE PRIVACIDADE DA LOJA (as "etiquetas" da App Store)
//
//  A Apple exige que se declare, item por item, que dado o aplicativo
//  recolhe, para quê, e se dá para ligar o dado à pessoa. Sem isso ela
//  RECUSA o envio — e a mensagem dela não diz que é isso que falta.
//
//  Aqui vai a verdade sobre cada um dos quatro. Nada de rastreamento, nada
//  de propaganda, nada de análise de comportamento: tudo o que é recolhido
//  serve para o aplicativo funcionar.
//
//  Rodar pelo robô: ativar-apple.yml com seja-semente/privacidade-loja.mjs
//  Só listar o que a Apple aceita, sem gravar: SO_LISTAR=1
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const SO_LISTAR = !!process.env.SO_LISTAR;
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: process.env.ASC_KEY_P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { cru: t.slice(0, 200) }; }
  return { status: r.status, json: j };
};
const porque = (r) => (r.json?.errors || []).map(e => `[${e.code || '?'}] ${e.detail || e.title}`).join(' · ') || JSON.stringify(r.json).slice(0, 250);

// A Apple não deixa listar as categorias por fora ("resource does not
// exist"), então usamos os nomes dela mesma. Se algum não servir, ela diz
// qual é na resposta e o robô mostra — melhor do que ficar no escuro.
const LIGADO = 'DATA_LINKED_TO_YOU';
const FUNCIONAR = 'APP_FUNCTIONALITY';
if (SO_LISTAR) { console.log('A Apple não deixa listar; o robô usa os nomes dela.'); process.exit(0); }

// O que cada aplicativo recolhe DE VERDADE
const COMUM = ['NAME', 'EMAIL_ADDRESS', 'USER_ID'];
const APPS = [
  { bundle: 'com.sejasemente.central',
    // Cadastra quem chega, guarda contato, condição de saúde e foto do
    // tratamento, e tem conversa da equipe
    dados: [...COMUM, 'PHONE_NUMBER', 'HEALTH', 'PHOTOS_OR_VIDEOS', 'OTHER_USER_CONTENT'] },
  { bundle: 'com.sejasemente.semeador',
    dados: [...COMUM, 'PHONE_NUMBER', 'HEALTH', 'PHOTOS_OR_VIDEOS', 'OTHER_USER_CONTENT'] },
  { bundle: 'com.sejasemente.palmar',
    // Sem ficha de paciente: só a equipe, o estoque e as notas fiscais
    dados: [...COMUM, 'PHONE_NUMBER', 'PHOTOS_OR_VIDEOS'] },
  { bundle: 'com.sejasemente.colheita',
    // Recebe o primeiro nome, a foto do tratamento e o depoimento
    dados: [...COMUM, 'HEALTH', 'PHOTOS_OR_VIDEOS'] },
];

for (const app of APPS) {
  console.log(`\n══════ ${app.bundle} ══════`);
  const r = await api('GET', `/v1/apps?filter[bundleId]=${app.bundle}`);
  const ficha = (r.json.data || []).find(a => a.attributes.bundleId === app.bundle);
  if (!ficha) { console.log('  ✗ sem ficha'); continue; }

  // Limpa o que já estivesse lá, para não duplicar
  const antes = await api('GET', `/v1/apps/${ficha.id}/appDataUsages?limit=200`);
  for (const u of (antes.json.data || [])) await api('DELETE', `/v1/appDataUsages/${u.id}`);
  if ((antes.json.data || []).length) console.log(`  (limpei ${antes.json.data.length} resposta(s) antiga(s))`);

  let deu = 0, nao = 0;
  for (const categoria of app.dados) {
    // Cada dado precisa de DOIS registros: para que serve, e se dá para
    // ligar à pessoa. A Apple recusa se faltar um dos dois.
    for (const [rel, valor] of [['purpose', FUNCIONAR], ['dataProtection', LIGADO]]) {
      const p = await api('POST', '/v1/appDataUsages', {
        data: {
          type: 'appDataUsages',
          relationships: {
            app: { data: { type: 'apps', id: ficha.id } },
            category: { data: { type: 'appDataUsageCategories', id: categoria } },
            [rel]: { data: { type: rel === 'purpose' ? 'appDataUsagePurposes' : 'appDataUsageDataProtections', id: valor } },
          },
        },
      });
      if (p.status < 300) deu++;
      else { nao++; console.log(`  ✗ ${categoria}/${valor}: ${p.status} ${porque(p)}`); }
    }
  }
  console.log(`  ${nao ? '✗' : '✓'} ${deu} resposta(s) gravada(s)${nao ? `, ${nao} falharam` : ''}`);

  // Publicar: sem isto a declaração fica de rascunho e não vale
  // O endereço desse estado mudou de nome entre versões da API; tenta os dois
  let idPub = null, ondeAchou = '';
  for (const caminho of ['appDataUsagesPublishState', 'appDataUsagePublishState']) {
    const e = await api('GET', `/v1/apps/${ficha.id}/${caminho}`);
    if (e.json.data?.id) { idPub = e.json.data.id; ondeAchou = caminho; break; }
  }
  if (!idPub) { console.log('  ✗ não achei o estado de publicação por nenhum caminho'); continue; }
  console.log(`  (estado de publicação em ${ondeAchou})`);
  const pub = await api('PATCH', `/v1/appDataUsagesPublishState/${idPub}`, {
    data: { type: 'appDataUsagesPublishState', id: idPub, attributes: { published: true } },
  });
  console.log(`  ${pub.status < 300 ? '✓ privacidade PUBLICADA' : '✗ não publicou: ' + pub.status + ' ' + porque(pub)}`);
}
console.log('\n✓ Fim');
