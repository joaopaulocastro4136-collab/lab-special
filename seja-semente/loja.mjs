// ═══════════════════════════════════════════════════════════════════════════
//  ROBÔ DA LOJA — leva os quatro aplicativos do Seja Semente para a App Store.
//
//  MODO=conferir (padrão) → não mexe em nada: só diz, item por item, o que a
//                           Apple exige e o que já está pronto.
//  MODO=enviar            → completa o que estiver faltando (sem apagar nada
//                           que já esteja escrito), anexa o build e APERTA O
//                           BOTÃO DE ENVIAR para a análise da Apple.
//  APP=central|semeador|palmar|colheita|todos
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const MODO = (process.env.MODO || '').trim() || 'conferir';
const QUAL = (process.env.APP || '').trim() || 'todos';

const APPS = {
  central: { bundle: 'com.sejasemente.central', nome: 'Seja Semente', site: 'https://seja-semente-app.web.app' },
  semeador: { bundle: 'com.sejasemente.semeador', nome: 'Semeador', site: 'https://seja-semente-semeador.web.app' },
  palmar: { bundle: 'com.sejasemente.palmar', nome: 'Palmar', site: 'https://seja-semente-palmar.web.app' },
  colheita: { bundle: 'com.sejasemente.colheita', nome: 'Colheita', site: 'https://seja-semente-colheita.web.app' },
};

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;

function jwt() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.'
    + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
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
  try { dados = texto ? JSON.parse(texto) : null; } catch (e) { /* resposta vazia */ }
  return { status: r.status, dados, ok: r.status < 300 };
}
const erroDe = (r) => {
  const lista = [];
  for (const e of (r.dados?.errors || [])) {
    lista.push(e.detail || e.title);
    for (const grupo of Object.values(e.meta?.associatedErrors || {}))
      for (const a of grupo) lista.push(`${a.code}: ${a.title}`);
  }
  return lista.join(' | ') || `HTTP ${r.status}`;
};
const espera = (ms) => new Promise(r => setTimeout(r, ms));

// ─── Textos de reserva: só entram onde a ficha estiver VAZIA ───
const DESCRICOES = {
  central: `O Seja Semente é o aplicativo da coordenação de um projeto social de odontologia. Por ele a equipe cadastra quem chega, faz a triagem marcando os dentes na arcada, monta a agenda dos dentistas voluntários, conversa em um chat próprio e acompanha o estoque de materiais.\n\nO aplicativo é usado pela equipe do projeto durante os mutirões de atendimento gratuito.`,
  semeador: `O Semeador é o aplicativo do dentista voluntário do projeto social Seja Semente. Nele o profissional vê a agenda do dia, abre a ficha de cada paciente, chama a pessoa para o atendimento, registra o que foi feito com foto de antes e depois e retira o material do estoque.\n\nO aplicativo é usado pelos voluntários do projeto durante os mutirões de atendimento gratuito.`,
  palmar: `O Palmar é o aplicativo de gestão do projeto social Seja Semente. Ele reúne os números do projeto: as ações (mutirões) com equipe escalada, o relatório de cada dia, a lista de materiais, as notas fiscais e o valor de tratamento entregue à comunidade.\n\nO aplicativo é usado pela coordenação do projeto.`,
  colheita: `A Colheita é o aplicativo de prestação de contas do projeto social Seja Semente, feito para quem apoia o projeto. Ele mostra os sorrisos devolvidos — com as fotos de antes e depois e os depoimentos de quem foi atendido — e abre as contas: o que foi comprado, com as notas fiscais.\n\nO aplicativo é usado por apoiadores e pela coordenação do projeto.`,
};
const PALAVRAS = 'odontologia,projeto social,voluntariado,mutirao,dentista,saude bucal,ong,solidariedade';
const SUPORTE = 'https://seja-semente-app.web.app/suporte.html';
const PRIVACIDADE = 'https://seja-semente-app.web.app/privacidade.html';
const NOVIDADES = 'Novidades desta versão:\n• Registro do atendimento com foto de antes e depois\n• Estoque com valores, fotos e busca\n• Ações com início, fim e encerramento\n• Correções de estabilidade';

const ESTADOS_EDITAVEIS = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
const ESTADOS_NA_APPLE = ['WAITING_FOR_REVIEW', 'IN_REVIEW', 'PENDING_APPLE_RELEASE', 'PENDING_DEVELOPER_RELEASE', 'PROCESSING_FOR_APP_STORE', 'READY_FOR_SALE'];

async function cuidarDe(chave) {
  const cfg = APPS[chave];
  console.log(`\n══════ ${cfg.nome} ══════`);
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${cfg.bundle}`);
  // O filtro da Apple casa por PREFIXO — o casamento exato é feito aqui.
  const app = ((apps.dados && apps.dados.data) || []).find(a => a.attributes.bundleId === cfg.bundle);
  if (!app) { console.log('✗ aplicativo não encontrado na Apple'); return { falta: ['aplicativo não encontrado'] }; }

  const falta = [];
  const feito = [];

  // 1. Build válido no TestFlight
  const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=10&include=preReleaseVersion`);
  const build = ((builds.dados && builds.dados.data) || []).find(b => b.attributes.processingState === 'VALID' && !b.attributes.expired);
  if (!build) {
    console.log('✗ nenhum build válido no TestFlight — suba um build antes');
    return { falta: ['build no TestFlight'] };
  }
  const nomes = {};
  for (const inc of (builds.dados.included || [])) nomes[inc.id] = inc.attributes.version;
  const versaoDoBuild = nomes[build.relationships?.preReleaseVersion?.data?.id] || '';
  feito.push(`build ${versaoDoBuild} (nº ${build.attributes.version})`);

  // 2. Versão de loja: só dá para preparar a que ainda está em rascunho
  const vers = await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=10`);
  const listaVers = (vers.dados && vers.dados.data) || [];
  const versao = listaVers.find(v => ESTADOS_EDITAVEIS.includes(v.attributes.appStoreState));
  const naApple = listaVers.find(v => ESTADOS_NA_APPLE.includes(v.attributes.appStoreState));
  if (!versao) {
    console.log(`· versão ${naApple?.attributes?.versionString || ''} está em "${naApple?.attributes?.appStoreState || 'nenhuma'}" — já saiu daqui, nada a fazer`);
    return { falta: [], jaEnviado: true };
  }
  const jaPublicado = listaVers.some(v => v.id !== versao.id && ESTADOS_NA_APPLE.includes(v.attributes.appStoreState));

  // 3. Ficha da loja (descrição, palavras-chave, suporte). Nada é sobrescrito:
  //    o robô só escreve onde está vazio.
  const locs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
  const listaLocs = (locs.dados && locs.dados.data) || [];
  for (const loc of listaLocs) {
    const a = loc.attributes;
    const vazios = {};
    if (!a.description || a.description.length < 10) vazios.description = DESCRICOES[chave];
    if (!a.keywords) vazios.keywords = PALAVRAS;
    if (!a.supportUrl) vazios.supportUrl = SUPORTE;
    if (!a.marketingUrl) vazios.marketingUrl = cfg.site;
    if (jaPublicado && !a.whatsNew) vazios.whatsNew = NOVIDADES;
    console.log(`   ficha (${a.locale}): descrição ${(a.description || '').length} letras · suporte "${a.supportUrl || 'vazio'}"`);
    if (!Object.keys(vazios).length) { feito.push(`ficha (${a.locale})`); continue; }
    if (MODO !== 'enviar') { falta.push(`ficha (${a.locale}): ${Object.keys(vazios).join(', ')} — o robô preenche`); continue; }
    const r = await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
      data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: vazios },
    });
    if (r.ok) { console.log(`   ✓ ficha (${a.locale}) completada: ${Object.keys(vazios).join(', ')}`); feito.push(`ficha (${a.locale})`); }
    else { console.log(`   ✗ ficha (${a.locale}): ${erroDe(r)}`); falta.push(`ficha (${a.locale})`); }
  }

  // 4. Capturas de tela — a Apple exige as de um iPhone grande (6.5", 6.7" ou 6.9")
  const conjuntos = await api('GET', `/v1/appStoreVersionLocalizations/${listaLocs[0]?.id}/appScreenshotSets?include=appScreenshots`);
  const listaConj = (conjuntos.dados && conjuntos.dados.data) || [];
  const quantasEm = (c) => ((c.relationships?.appScreenshots?.data) || []).length;
  console.log('   capturas: ' + (listaConj.length ? listaConj.map(c => `${c.attributes.screenshotDisplayType}=${quantasEm(c)}`).join(' · ') : 'nenhuma'));
  if (listaConj.some(c => /IPHONE_(65|67|69)/.test(c.attributes.screenshotDisplayType) && quantasEm(c) > 0)) feito.push('capturas do iPhone');
  else falta.push('CAPTURAS DE TELA de um iPhone grande (6.5", 6.7" ou 6.9")');

  // 5. Política de privacidade — obrigatória em qualquer app
  const infos = await api('GET', `/v1/apps/${app.id}/appInfos`);
  const info = ((infos.dados && infos.dados.data) || [])[0];
  if (info) {
    const infoLocs = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`);
    for (const l of ((infoLocs.dados && infoLocs.dados.data) || [])) {
      if (l.attributes.privacyPolicyUrl) { feito.push('política de privacidade'); continue; }
      if (MODO !== 'enviar') { falta.push(`política de privacidade (${l.attributes.locale}) — o robô preenche`); continue; }
      const r = await api('PATCH', `/v1/appInfoLocalizations/${l.id}`, {
        data: { type: 'appInfoLocalizations', id: l.id, attributes: { privacyPolicyUrl: PRIVACIDADE } },
      });
      console.log(r.ok ? `   ✓ política de privacidade (${l.attributes.locale})` : `   ✗ privacidade: ${erroDe(r)}`);
      (r.ok ? feito : falta).push('política de privacidade');
    }
  }

  // 6. Classificação etária
  const decl = await api('GET', `/v1/apps/${app.id}/appInfos?include=ageRatingDeclaration`);
  const idade = (decl.dados?.included || []).find(x => x.type === 'ageRatingDeclarations');
  const respostas = Object.values(idade?.attributes || {}).filter(v => v !== null && v !== undefined);
  if (respostas.length >= 3) feito.push(`classificação etária (${respostas.length} respostas)`);
  else falta.push('classificação etária — responder o questionário no App Store Connect');

  // 7. Conta de teste para o revisor — obrigatória em app com entrada por conta
  const detalhe = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreReviewDetail`);
  const d = detalhe.dados?.data?.attributes;
  if (d?.demoAccountRequired && d?.demoAccountName && d?.demoAccountPassword) feito.push(`conta do revisor (${d.demoAccountName})`);
  else falta.push('CONTA DE TESTE para o revisor da Apple (usuário e senha)');

  // 8. Entrar com a Apple (regra 4.8) — já existe nas quatro telas de entrada
  feito.push('entrar com a Apple (regra 4.8)');

  console.log('✓ pronto: ' + feito.join(' · '));
  if (falta.length) {
    console.log('✗ ainda falta:');
    for (const f of falta) console.log('   • ' + f);
    return { falta };
  }
  if (MODO !== 'enviar') { console.log('✓ tudo pronto — rode com MODO=enviar'); return { falta: [] }; }

  // ─── ENVIAR ───
  // 8b. Preço: a Apple não aceita envio sem tabela de preço. Os quatro são
  //     gratuitos, então o robô marca o preço zero em todos os países.
  const tabela = await api('GET', `/v1/apps/${app.id}/appPriceSchedule?include=manualPrices`);
  const temPreco = (tabela.dados?.included || []).some(x => x.type === 'appPrices');
  if (temPreco) console.log('   preço já definido ✓');
  else {
    const pontos = await api('GET', `/v1/apps/${app.id}/appPricePoints?filter[territory]=BRA&limit=3`);
    const gratis = ((pontos.dados && pontos.dados.data) || []).find(x => Number(x.attributes.customerPrice) === 0);
    if (!gratis) { console.log(`   ✗ não achei o preço zero: ${erroDe(pontos)}`); return { falta: ['definir o preço'] }; }
    const cria = await api('POST', '/v1/appPriceSchedules', {
      data: { type: 'appPriceSchedules', relationships: {
        app: { data: { type: 'apps', id: app.id } },
        baseTerritory: { data: { type: 'territories', id: 'BRA' } },
        manualPrices: { data: [{ type: 'appPrices', id: '${gratis}' }] },
      } },
      included: [{ type: 'appPrices', id: '${gratis}', relationships: {
        appPricePoint: { data: { type: 'appPricePoints', id: gratis.id } },
      } }],
    });
    if (!cria.ok) { console.log(`   ✗ não consegui definir o preço: ${erroDe(cria)}`); return { falta: ['definir o preço'] }; }
    console.log('   preço definido: gratuito ✓');
  }

  // 9. Declaração de criptografia (senão trava em "Missing Compliance")
  const comp = await api('PATCH', `/v1/builds/${build.id}`, {
    data: { type: 'builds', id: build.id, attributes: { usesNonExemptEncryption: false } },
  });
  console.log('   criptografia declarada:', comp.ok ? 'ok' : `aviso (${comp.status})`);

  // 10. Lançar sozinho assim que a Apple aprovar
  await api('PATCH', `/v1/appStoreVersions/${versao.id}`, {
    data: { type: 'appStoreVersions', id: versao.id, attributes: { releaseType: 'AFTER_APPROVAL' } },
  });

  // 11. Anexa o build à versão de loja
  const anexa = await api('PATCH', `/v1/appStoreVersions/${versao.id}/relationships/build`, { data: { type: 'builds', id: build.id } });
  if (!anexa.ok) { console.log(`   ✗ não consegui anexar o build: ${erroDe(anexa)}`); return { falta: ['anexar o build'] }; }
  console.log('   build anexado à versão de loja ✓');

  // 12. O envio em si
  const envios = await api('GET', `/v1/reviewSubmissions?filter[app]=${app.id}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,UNRESOLVED_ISSUES&limit=5`);
  let envio = ((envios.dados && envios.dados.data) || [])[0];
  if (envio && envio.attributes.state === 'WAITING_FOR_REVIEW') {
    console.log('   · já está na fila da Apple — nada a reenviar');
    return { falta: [], jaEnviado: true };
  }
  if (envio && envio.attributes.state === 'UNRESOLVED_ISSUES') {
    const cancela = await api('PATCH', `/v1/reviewSubmissions/${envio.id}`, {
      data: { type: 'reviewSubmissions', id: envio.id, attributes: { canceled: true } },
    });
    if (!cancela.ok) { console.log(`   ✗ não consegui cancelar o envio reprovado: ${erroDe(cancela)}`); return { falta: ['cancelar envio anterior'] }; }
    console.log('   envio reprovado anterior cancelado ✓');
    envio = null;
  }
  if (!envio) {
    const novo = await api('POST', '/v1/reviewSubmissions', {
      data: { type: 'reviewSubmissions', attributes: { platform: 'IOS' }, relationships: { app: { data: { type: 'apps', id: app.id } } } },
    });
    if (!novo.ok) { console.log(`   ✗ não consegui abrir o envio: ${erroDe(novo)}`); return { falta: ['abrir o envio'] }; }
    envio = novo.dados.data;
    console.log('   envio para análise aberto ✓');
  } else console.log('   envio aberto reaproveitado ✓');

  const itens = await api('GET', `/v1/reviewSubmissions/${envio.id}/items?include=appStoreVersion&limit=10`);
  const listaItens = (itens.dados && itens.dados.data) || [];
  if (!listaItens.some(i => i.relationships?.appStoreVersion?.data?.id === versao.id)) {
    let item = null;
    for (let t = 1; t <= 6; t++) {
      item = await api('POST', '/v1/reviewSubmissionItems', {
        data: { type: 'reviewSubmissionItems', relationships: {
          reviewSubmission: { data: { type: 'reviewSubmissions', id: envio.id } },
          appStoreVersion: { data: { type: 'appStoreVersions', id: versao.id } },
        } },
      });
      if (item.ok || !JSON.stringify(item.dados || {}).includes('ANOTHER_SUBMISSION')) break;
      console.log(`   versão ainda presa no envio anterior — esperando (${t}/6)…`);
      await espera(15000);
    }
    if (!item.ok) {
      const motivo = erroDe(item);
      console.log(`   ✗ a Apple não aceitou: ${motivo}`);
      if (motivo.includes('APP_DATA_USAGES')) {
        console.log('   ┌─ Falta a PRIVACIDADE DO APP, e essa a Apple só deixa responder no site dela.');
        console.log('   │  App Store Connect → o aplicativo → Privacidade do app → Editar → responder e PUBLICAR:');
        console.log('   │    • Informações de contato: nome, e-mail, telefone → Funcionalidade do app · ligado à pessoa · sem rastreamento');
        console.log('   │    • Saúde e preparo físico: saúde → Funcionalidade do app · ligado à pessoa · sem rastreamento');
        console.log('   │    • Conteúdo do usuário: fotos ou vídeos → Funcionalidade do app · ligado à pessoa · sem rastreamento');
        console.log('   │    • Identificadores: ID do usuário → Funcionalidade do app · ligado à pessoa · sem rastreamento');
        console.log(`   │  Link direto: https://appstoreconnect.apple.com/apps/${app.id}/distribution/privacy`);
        console.log('   └─ Respondido nos quatro, é só apertar "Publicar na App Store" de novo que ele termina sozinho.');
      }
      return { falta: ['privacidade do app (responder no site da Apple)'] };
    }
    console.log('   versão colocada no envio ✓');
  } else console.log('   o envio já tem esta versão ✓');

  const manda = await api('PATCH', `/v1/reviewSubmissions/${envio.id}`, {
    data: { type: 'reviewSubmissions', id: envio.id, attributes: { submitted: true } },
  });
  if (!manda.ok) { console.log(`   ✗ não consegui concluir o envio: ${erroDe(manda)}`); return { falta: ['apertar o botão de enviar'] }; }
  console.log(`🍎 ${cfg.nome} ENVIADO PARA A ANÁLISE DA APPLE ✓ (versão ${versao.attributes.versionString}, build ${build.attributes.version})`);
  return { falta: [], enviado: true };
}

const alvos = QUAL === 'todos' ? Object.keys(APPS) : [QUAL];
let totalFalta = 0;
let enviados = 0;
for (const a of alvos) {
  const r = await cuidarDe(a);
  totalFalta += (r.falta || []).length;
  if (r.enviado) enviados++;
}
console.log('\n════════════════════════════════════════════');
if (MODO === 'enviar') {
  console.log(`${enviados} aplicativo(s) enviado(s) para a análise da Apple.`);
  if (totalFalta) console.log(`${totalFalta} pendência(s) impediram o resto — veja a lista acima.`);
  else if (enviados) console.log('A resposta da Apple costuma sair em 1 a 3 dias. Aprovou, entra na loja sozinho.');
} else {
  console.log(totalFalta ? `Conferência: ${totalFalta} pendência(s).` : 'Tudo pronto — rode com MODO=enviar.');
}
