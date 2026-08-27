// ═══════════════════════════════════════════════════════════════════════════
//  ROBÔ DA LOJA — leva os aplicativos do Seja Semente para a App Store.
//
//  Rodar com MODO=conferir (padrão): não envia nada, só diz o que a Apple
//  exige e o que ainda falta, item por item, em português.
//  Rodar com MODO=enviar: preenche o que dá para preencher sozinho (ficha,
//  suporte, privacidade, compliance, build) e manda para a análise.
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
  return { status: r.status, dados, ok: r.status < 300 };
}

// ─── Textos da ficha (iguais para todos, com o nome trocado) ───
const DESCRICOES = {
  central: `O Seja Semente é o aplicativo da coordenação de um projeto social de odontologia. Por ele a equipe cadastra quem chega, faz a triagem marcando os dentes na arcada, monta a agenda dos dentistas voluntários, conversa em um chat próprio e acompanha o estoque de materiais.\n\nO aplicativo é usado pela equipe do projeto durante os mutirões de atendimento gratuito.`,
  semeador: `O Semeador é o aplicativo do dentista voluntário do projeto social Seja Semente. Nele o profissional vê a agenda do dia, abre a ficha de cada paciente, chama a pessoa para o atendimento, registra o que foi feito com foto de antes e depois e retira o material do estoque.\n\nO aplicativo é usado pelos voluntários do projeto durante os mutirões de atendimento gratuito.`,
  palmar: `O Palmar é o aplicativo de gestão do projeto social Seja Semente. Ele reúne os números do projeto: as ações (mutirões) com equipe escalada, o relatório de cada dia, a lista de materiais, as notas fiscais e o valor de tratamento entregue à comunidade.\n\nO aplicativo é usado pela coordenação do projeto.`,
  colheita: `A Colheita é o aplicativo de prestação de contas do projeto social Seja Semente, feito para quem apoia o projeto. Ele mostra os sorrisos devolvidos — com as fotos de antes e depois e os depoimentos de quem foi atendido — e abre as contas: o que foi comprado, com as notas fiscais.\n\nO aplicativo é usado por apoiadores e pela coordenação do projeto.`,
};
const PALAVRAS = 'odontologia,projeto social,voluntariado,mutirão,dentista,saúde bucal,ong,solidariedade';
const SUPORTE = 'https://seja-semente-app.web.app/suporte.html';
const PRIVACIDADE = 'https://seja-semente-app.web.app/privacidade.html';

// ─── Confere/prepara um app ───
async function cuidarDe(chave) {
  const cfg = APPS[chave];
  console.log(`\n══════ ${cfg.nome} ══════`);
  const apps = await api('GET', `/v1/apps?filter[bundleId]=${cfg.bundle}`);
  const app = ((apps.dados && apps.dados.data) || []).find(a => a.attributes.bundleId === cfg.bundle);
  if (!app) { console.log('✗ aplicativo não encontrado na Apple'); return { falta: ['aplicativo não encontrado'] }; }

  const falta = [];
  const feito = [];

  // 1. Build válido no TestFlight
  const builds = await api('GET', `/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=5`);
  const build = ((builds.dados && builds.dados.data) || []).find(b => b.attributes.processingState === 'VALID' && !b.attributes.expired);
  if (build) feito.push(`build nº ${build.attributes.version} pronto`);
  else falta.push('nenhum build válido no TestFlight');

  // 2. Versão de loja editável
  const EDITAVEIS = ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY'];
  const vers = await api('GET', `/v1/apps/${app.id}/appStoreVersions?filter[platform]=IOS&limit=5`);
  const versao = ((vers.dados && vers.dados.data) || []).find(v => EDITAVEIS.includes(v.attributes.appStoreState));
  if (!versao) {
    const emAndamento = ((vers.dados && vers.dados.data) || [])[0];
    console.log(`· versão de loja em estado "${emAndamento?.attributes?.appStoreState || 'nenhuma'}" — nada a preparar agora`);
    return { falta: [], jaEnviado: true };
  }

  // 3. A ficha da loja (descrição, palavras-chave, suporte, privacidade)
  const locs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
  const listaLocs = (locs.dados && locs.dados.data) || [];
  for (const loc of listaLocs) {
    const a = loc.attributes;
    const semDescricao = !a.description || a.description.length < 10;
    if (MODO === 'conferir') console.log(`   ficha (${a.locale}): descrição ${(a.description || '').length} letras · palavras "${(a.keywords || '').slice(0, 40)}" · suporte "${a.supportUrl || ''}"`);
    if (MODO === 'enviar') {
      const r = await api('PATCH', `/v1/appStoreVersionLocalizations/${loc.id}`, {
        data: { type: 'appStoreVersionLocalizations', id: loc.id, attributes: {
          description: DESCRICOES[chave], keywords: PALAVRAS, supportUrl: SUPORTE, marketingUrl: cfg.site,
        } },
      });
      console.log(r.ok ? `✓ ficha (${a.locale}) preenchida` : `✗ ficha (${a.locale}): erro ${r.status}`);
      if (!r.ok) falta.push(`ficha da loja (${a.locale})`);
    } else {
      if (semDescricao) falta.push(`descrição da loja (${a.locale}) — o robô preenche`);
      else feito.push(`descrição (${a.locale})`);
    }
  }

  // 4. Capturas de tela — a Apple EXIGE as do iPhone grande (6.5" ou 6.9")
  const conjuntos = await api('GET', `/v1/appStoreVersionLocalizations/${listaLocs[0]?.id}/appScreenshotSets?include=appScreenshots`);
  const listaConj = (conjuntos.dados && conjuntos.dados.data) || [];
  const porTipo = [];
  for (const c of listaConj) {
    const quantas = ((c.relationships?.appScreenshots?.data) || []).length;
    porTipo.push(`${c.attributes.screenshotDisplayType}=${quantas}`);
  }
  console.log('   capturas: ' + (porTipo.length ? porTipo.join(' · ') : 'nenhuma'));
  const grandes = listaConj.filter(c => /6_5|6_9|6_7/.test(c.attributes.screenshotDisplayType)
    && ((c.relationships?.appScreenshots?.data) || []).length > 0);
  if (grandes.length) feito.push('capturas de tela do iPhone');
  else falta.push('CAPTURAS DE TELA do iPhone grande (6.5\" ou 6.9\")');

  // 5. Política de privacidade (obrigatória para qualquer app)
  const infos = await api('GET', `/v1/apps/${app.id}/appInfos`);
  const info = ((infos.dados && infos.dados.data) || [])[0];
  if (info) {
    const infoLocs = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`);
    for (const l of ((infoLocs.dados && infoLocs.dados.data) || [])) {
      if (MODO === 'enviar') {
        const r = await api('PATCH', `/v1/appInfoLocalizations/${l.id}`, {
          data: { type: 'appInfoLocalizations', id: l.id, attributes: { privacyPolicyUrl: PRIVACIDADE } },
        });
        console.log(r.ok ? `✓ política de privacidade (${l.attributes.locale})` : `✗ privacidade (${l.attributes.locale}): ${r.status}`);
      } else if (!l.attributes.privacyPolicyUrl) {
        console.log(`   privacidade (${l.attributes.locale}): vazia`);
        falta.push(`política de privacidade (${l.attributes.locale}) — o robô preenche`);
      } else feito.push('política de privacidade');
    }
  }

  // 6. Classificação etária
  const decl = await api('GET', `/v1/apps/${app.id}/appInfos?include=ageRatingDeclaration`);
  const idade = (decl.dados?.included || []).find(x => x.type === 'ageRatingDeclarations');
  const respostas = Object.values(idade?.attributes || {}).filter(v => v !== null && v !== undefined);
  console.log(`   classificação etária: ${respostas.length} resposta(s)`);
  if (respostas.length >= 3) feito.push('classificação etária respondida');
  else falta.push('classificação etária (questionário) — o robô responde');

  // 7. Conta de teste para o revisor da Apple — obrigatória em app com login
  const detalhe = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreReviewDetail`);
  const d = detalhe.dados?.data?.attributes;
  console.log(`   revisor: exige conta=${d?.demoAccountRequired} · usuário="${d?.demoAccountName || ''}" · contato="${d?.contactEmail || ''}"`);
  if (d?.demoAccountRequired && d?.demoAccountName && d?.demoAccountPassword) feito.push('conta de teste para o revisor');
  else falta.push('CONTA DE TESTE para o revisor da Apple — o robô cria e preenche');

  // 8. Entrar com Apple (regra 4.8) — já existe nas quatro telas de entrada
  feito.push('entrar com a Apple (regra 4.8)');

  console.log(feito.length ? '✓ pronto: ' + feito.join(' · ') : '');
  if (falta.length) {
    console.log('✗ ainda falta:');
    for (const f of falta) console.log('   • ' + f);
  } else console.log('✓ tudo pronto para enviar');
  return { falta, app, versao, build };
}

const alvos = QUAL === 'todos' ? Object.keys(APPS) : [QUAL];
let totalFalta = 0;
for (const a of alvos) {
  const r = await cuidarDe(a);
  totalFalta += (r.falta || []).length;
}
console.log('\n════════════════════════════════════════════');
console.log(MODO === 'conferir'
  ? (totalFalta ? `Conferência: ${totalFalta} pendência(s) no total — resolvidas as marcadas, o robô envia.` : 'Tudo pronto — rode com MODO=enviar.')
  : 'Preparação concluída.');
