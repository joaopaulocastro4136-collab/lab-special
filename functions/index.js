// ─── Carteiro de notificações push (Lab Special ↔ Special Clinic) ───
// Observa a coleção de casos e envia avisos pro celular (mesmo bloqueado):
//   • clínica cria trabalho  → laboratório: "trabalho novo, já para retirada"
//   • lab cria trabalho      → dentista: "trabalho novo adicionado"
//   • trabalho fica Pronto   → dentista: "sai para entrega!"
//   • lab pede aprovação     → dentista: "o laboratório pediu sua aprovação"
//   • dentista aprova        → laboratório: "arquivo aprovado ✓"
// iPhone: direto pela Apple (APNs, chave nos secrets APNS_P8 / APNS_KEY_ID).
// Android: pelo Firebase Cloud Messaging.

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const http2 = require('http2');
const crypto = require('crypto');

admin.initializeApp();

const APNS_P8 = defineSecret('APNS_P8');
const APNS_KEY_ID = defineSecret('APNS_KEY_ID');
const TEAM_ID = 'L5NKZSS3J2';
const BUNDLES = { lab: 'com.laboratorio.special', clinica: 'com.laboratorio.specialclinic' };
const OPCOES = { region: 'southamerica-east1', secrets: [APNS_P8, APNS_KEY_ID] };

let jwtCache = { token: null, em: 0 };
function apnsJWT() {
  const agora = Math.floor(Date.now() / 1000);
  if (jwtCache.token && agora - jwtCache.em < 2400) return jwtCache.token;
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const semAssin = b64({ alg: 'ES256', kid: APNS_KEY_ID.value().trim() }) + '.' + b64({ iss: TEAM_ID, iat: agora });
  const assin = crypto.sign('sha256', Buffer.from(semAssin), { key: APNS_P8.value(), dsaEncoding: 'ieee-p1363' }).toString('base64url');
  jwtCache = { token: semAssin + '.' + assin, em: agora };
  return jwtCache.token;
}

function enviarAPNsPayload(tokenAparelho, bundle, payload) {
  return new Promise((resolve) => {
    const cliente = http2.connect('https://api.push.apple.com');
    let status = 0;
    let resposta = '';
    const req = cliente.request({
      ':method': 'POST',
      ':path': '/3/device/' + tokenAparelho,
      authorization: 'bearer ' + apnsJWT(),
      'apns-topic': bundle,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    });
    req.setEncoding('utf8');
    req.on('response', (h) => { status = h[':status']; });
    req.on('data', (c) => { resposta += c; });
    req.on('close', () => { cliente.close(); resolve({ status, resposta }); });
    req.on('error', (e) => { cliente.close(); resolve({ status: 0, resposta: String(e) }); });
    req.end(JSON.stringify(payload));
    setTimeout(() => { try { cliente.close(); } catch (e) { } resolve({ status: 0, resposta: 'timeout' }); }, 10000);
  });
}

function enviarAPNs(tokenAparelho, bundle, titulo, corpo, dados) {
  return enviarAPNsPayload(tokenAparelho, bundle,
    { aps: { alert: { title: titulo, body: corpo }, sound: 'default', badge: 1 }, ...(dados || {}) });
}

// Envia p/ todos os aparelhos do destino: 'lab' (equipe) ou 'clinica' (um dentista),
// dentro do laboratório indicado. "dados" vai junto no aviso (ex.: casoId).
async function notificar(lab, destino, dentista, titulo, corpo, dados) {
  const db = admin.firestore();
  let consulta = db.collection(`labs/${lab}/pushTokens`).where('tipo', '==', destino);
  if (destino === 'clinica') consulta = consulta.where('dentista', '==', dentista);
  const snap = await consulta.get();
  console.log(`notificar ${destino}${dentista ? ' (' + dentista + ')' : ''}: ${snap.size} aparelho(s) — ${titulo}`);
  const invalidos = [];
  for (const d of snap.docs) {
    const t = d.data();
    try {
      if (t.plataforma === 'ios') {
        const r = await enviarAPNs(t.token, BUNDLES[destino], titulo, corpo, dados);
        console.log(`  ios ${t.token.slice(0, 12)}…: ${r.status} ${r.resposta || ''}`);
        if (r.status === 400 || r.status === 410) invalidos.push(d.ref);
      } else {
        const dadosTexto = {};
        Object.entries(dados || {}).forEach(([k, v]) => { dadosTexto[k] = String(v); });
        await admin.messaging().send({ token: t.token, notification: { title: titulo, body: corpo }, data: dadosTexto, android: { priority: 'high' } });
        console.log(`  android ${t.token.slice(0, 12)}…: ok`);
      }
    } catch (e) {
      const msg = String((e && e.message) || e);
      console.error(`  falha ${t.token.slice(0, 12)}…: ${msg}`);
      if (msg.includes('registration-token-not-registered') || msg.includes('invalid-registration-token')) invalidos.push(d.ref);
    }
  }
  await Promise.all(invalidos.map((r) => r.delete().catch(() => { })));
}

exports.aoCriarCaso = onDocumentCreated({ ...OPCOES, document: 'labs/{lab}/casos/{id}' }, async (event) => {
  const c = event.data && event.data.data();
  if (!c) return;
  const lab = event.params.lab;
  const casoId = (event.params && event.params.id) || c.id;
  if (c.origem === 'clinica') {
    await notificar(lab, 'lab', null, '🆕 Trabalho novo da clínica', `${c.dentista} enviou: ${c.paciente} (${c.tipoTrabalho}) — já está para retirada.`, { casoId });
  } else if (c.dentista) {
    await notificar(lab, 'clinica', c.dentista, 'Trabalho novo no laboratório', `${c.paciente} (${c.tipoTrabalho}) foi adicionado pelo laboratório.`, { casoId });
  }
});

exports.aoMudarCaso = onDocumentUpdated({ ...OPCOES, document: 'labs/{lab}/casos/{id}' }, async (event) => {
  const antes = event.data && event.data.before.data();
  const depois = event.data && event.data.after.data();
  if (!antes || !depois) return;
  const lab = event.params.lab;
  const casoId = (event.params && event.params.id) || depois.id;

  // Ficou pronto → avisa o dentista que sai para entrega
  if (antes.status !== 'Pronto' && depois.status === 'Pronto' && depois.dentista) {
    await notificar(lab, 'clinica', depois.dentista, 'Pronto para entrega! 🎉', `${depois.paciente} (${depois.tipoTrabalho}) ficou pronto e sai para entrega.`, { casoId });
  }

  // Dentista devolveu a prova → avisa o laboratório que tem busca na clínica
  if (!antes.retornoSolicitado && depois.retornoSolicitado && depois.dentista) {
    await notificar(lab, 'lab', null, '🔁 Buscar na clínica', `${depois.dentista} avisou: ${depois.paciente} (${depois.tipoTrabalho}) está pronto para o laboratório buscar.`, { casoId });
  }

  // Prova saiu da bancada rumo à clínica → avisa o dentista que está a caminho
  if (!antes.provaPendente && depois.provaPendente && !depois.naClinica && depois.dentista) {
    await notificar(lab, 'clinica', depois.dentista, '🦷 Prova a caminho', `${depois.paciente} (${depois.tipoTrabalho}): a prova saiu do laboratório e está a caminho da sua clínica.`, { casoId });
  }

  // Aprovações de arquivo: compara os anexos de antes e de depois
  const mapaAntes = {};
  (antes.anexos || []).forEach((a) => { mapaAntes[a.id] = a; });
  for (const a of (depois.anexos || [])) {
    const statusNovo = a.aprovacao && a.aprovacao.status;
    const statusVelho = mapaAntes[a.id] && mapaAntes[a.id].aprovacao && mapaAntes[a.id].aprovacao.status;
    if (statusNovo === 'pendente' && statusVelho !== 'pendente' && depois.dentista) {
      // Se o canal reserva (avisosAprovacao) já avisou este pedido há pouco, não repete
      let jaAvisado = false;
      try {
        const corte = new Date(Date.now() - 3 * 60000).toISOString();
        const avs = await admin.firestore().collection(`labs/${lab}/avisosAprovacao`).where('casoId', '==', casoId).get();
        jaAvisado = avs.docs.some((x) => { const v = x.data(); return v.anexoNome === a.nome && String(v.em) > corte; });
      } catch (e) { console.error('dedupe aviso', e); }
      if (!jaAvisado) {
        await notificar(lab, 'clinica', depois.dentista, 'Aprovação solicitada 👍', `O laboratório pediu sua aprovação: "${a.nome}" — ${depois.paciente}. Abra para ver e aprovar.`, { casoId });
      }
    }
    if (statusNovo === 'aprovado' && statusVelho !== 'aprovado') {
      await notificar(lab, 'lab', null, 'Arquivo aprovado ✓', `${depois.dentista} aprovou "${a.nome}" (${depois.paciente}).`, { casoId });
    }
  }
});

// ─── Canal reserva do pedido de aprovação ───
// O Lab grava um doc em avisosAprovacao a cada pedido; aqui a notificação
// dispara SEMPRE, mesmo se a gravação do caso falhar por qualquer motivo.
exports.aoPedirAprovacao = onDocumentCreated({ ...OPCOES, document: 'labs/{lab}/avisosAprovacao/{id}' }, async (event) => {
  const d = event.data && event.data.data();
  if (!d || !d.dentista) return;
  await notificar(event.params.lab, 'clinica', d.dentista, 'Aprovação solicitada 👍',
    `O laboratório pediu sua aprovação: "${d.anexoNome || 'arquivo'}" — ${d.paciente || ''}. Abra para ver e aprovar.`,
    d.casoId ? { casoId: d.casoId } : undefined);
});

// ─── Bancada de teste do push ───
// O robô grava um doc em testesPush dizendo o formato; o carteiro envia na hora.
// Serve pra descobrir qual formato de aviso o iPhone aceita mostrar na barra.
exports.aoTestarPush = onDocumentCreated({ ...OPCOES, document: 'labs/principal/testesPush/{id}' }, async (event) => {
  const d = event.data && event.data.data();
  if (!d) return;
  const destino = d.destino === 'lab' ? 'lab' : 'clinica';
  let consulta = admin.firestore().collection('labs/principal/pushTokens').where('tipo', '==', destino);
  if (destino === 'clinica' && d.dentista) consulta = consulta.where('dentista', '==', d.dentista);
  const snap = await consulta.get();
  const aps = { alert: { title: d.titulo || 'TESTE', body: d.corpo || '' } };
  if (d.som !== false) aps.sound = 'default';
  if (d.badge) aps.badge = 1;
  if (d.urgente) aps['interruption-level'] = 'time-sensitive';
  const payload = { aps, ...(d.dados || {}) };
  console.log(`teste push "${aps.alert.title}" → ${destino}: ${snap.size} aparelho(s) | payload=${JSON.stringify(payload)}`);
  for (const doc of snap.docs) {
    const t = doc.data();
    if (t.plataforma !== 'ios') continue;
    const r = await enviarAPNsPayload(t.token, BUNDLES[destino], payload);
    console.log(`  ios ${t.token.slice(0, 12)}…: ${r.status} ${r.resposta || ''}`);
  }
});

// ─── Cobrador: verifica todo dia de manhã se há pagamento vencido ───
// Usa o combinado de cada dentista (data marcada OU dias após a entrega, gravado
// em dentistasAcesso pelo Lab). Pagamentos registrados quitam as entregas mais
// antigas primeiro (mesma conta do app). Se sobrou valor vencido sem baixa:
//   • dentista recebe push "Pagamento em atraso — por favor, regularize"
//     (tocar no aviso abre direto o Financeiro do Special Clinic)
//   • laboratório recebe um resumo de quem está em atraso
exports.cobrancaAtrasada = onSchedule({ ...OPCOES, schedule: '0 9 * * *', timeZone: 'America/Recife' }, async () => {
  const db = admin.firestore();
  const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().split('T')[0]; // dia em Recife (UTC-3)
  const fmt = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
  const somaDias = (iso, n) => {
    const d = new Date(iso + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().split('T')[0];
  };
  // Percorre todos os laboratórios (o principal + os criados pelo app)
  const labsConhecidos = new Set(['principal']);
  try {
    const idx = await db.collection('labsIndex').get();
    idx.forEach((d) => labsConhecidos.add(d.id));
  } catch (e) { console.error('labsIndex', e); }
  for (const lab of labsConhecidos) {
  const acessos = await db.collection(`labs/${lab}/dentistasAcesso`).get();
  const vistos = new Set();
  const atrasados = [];
  for (const docAcesso of acessos.docs) {
    const cfg = docAcesso.data();
    const nome = cfg.nome;
    if (!nome || vistos.has(nome)) continue;
    vistos.add(nome);
    const temDias = Number.isFinite(cfg.diasPagamento);
    const temData = typeof cfg.dataPagamento === 'string' && cfg.dataPagamento;
    if (!temDias && !temData) continue; // sem combinado → sem cobrança automática
    const casosSnap = await db.collection(`labs/${lab}/casos`)
      .where('dentista', '==', nome).where('status', '==', 'Entregue').get();
    const entregues = [];
    casosSnap.forEach((d) => {
      const c = d.data();
      if ((c.valor || 0) > 0 && c.dataSaida) entregues.push(c);
    });
    entregues.sort((a, b) => String(a.dataSaida).localeCompare(String(b.dataSaida)));
    const fin = await db.doc(`labs/${lab}/financeiroClinica/` + nome.replace(/\//g, '-')).get();
    let restante = (fin.exists && fin.data().totalPago) || 0;
    let vencido = 0;
    for (const c of entregues) {
      if (restante >= c.valor - 0.005) { restante -= c.valor; continue; }
      let vence = null;
      if (temData && c.dataSaida <= cfg.dataPagamento) vence = cfg.dataPagamento;
      else if (temDias) vence = somaDias(c.dataSaida, cfg.diasPagamento);
      if (vence && vence < hoje) vencido += c.valor;
    }
    vencido = Math.round(vencido * 100) / 100;
    if (vencido > 0) {
      atrasados.push({ nome, vencido });
      await notificar(lab, 'clinica', nome, '🔴 Pagamento em atraso',
        `Há ${fmt(vencido)} vencido com o laboratório. Por favor, regularize — toque aqui para abrir o Financeiro e pagar via Pix.`,
        { abrirAba: 'financeiro' });
    }
  }
  if (atrasados.length > 0) {
    const lista = atrasados.map((a) => `${a.nome} (${fmt(a.vencido)})`).join(', ');
    await notificar(lab, 'lab', null, '💰 Pagamentos em atraso',
      `${atrasados.length === 1 ? '1 dentista está' : atrasados.length + ' dentistas estão'} com pagamento vencido: ${lista}.`);
  }
  console.log(`cobrança (${lab}): ${atrasados.length} dentista(s) em atraso`);
  }
});

// ─── IA Special: transformador de sorriso (Special Clinic) ───
// Recebe a foto do sorriso, redesenha os dentes com IA generativa (Gemini) —
// alinhamento, simetria, proporção e o tom de cor escolhido — e devolve a foto.
// A chave chega por variável de ambiente (functions/.env, escrita pelo robô de
// publicação a partir do segredo GEMINI_API_KEY do GitHub — nunca vai pro git).

// Escala de cor odontológica (VITA) que o dentista escolhe no app
const TONS_DENTE = {
  bl: 'a very bright bleached "Hollywood white" (VITA BL1 bleach shade) — clearly and strongly whitened, yet still looking like real polished enamel, never chalky or fake',
  b1: 'a bright natural white (VITA B1 shade) — luminous and clean, the brightest tone that still reads as natural teeth',
  a1: 'a healthy classic natural white (VITA A1 shade) — realistic enamel translucency with a subtle warm undertone',
  a2: 'a warm natural ivory (VITA A2 shade) — noticeably yellower, like healthy natural teeth that were never bleached',
  // nomes antigos (apps anteriores) continuam funcionando
  claro: 'a bright whitened "Hollywood white" (VITA BL1 bleach shade), while still looking like real natural enamel',
  natural: 'a healthy natural white (VITA A1 shade), with realistic enamel translucency',
  escuro: 'a discreet, slightly warmer natural ivory (VITA A2-A3 shade), realistic and understated',
};

exports.transformarSorriso = onCall(
  { region: 'southamerica-east1', timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para usar a IA Special.');
    const chave = (process.env.GEMINI_API_KEY || '').trim();
    if (!chave) throw new HttpsError('failed-precondition', 'A IA Special ainda está sendo ativada pelo laboratório.');
    const foto = String((request.data && request.data.foto) || '');
    const tom = TONS_DENTE[request.data && request.data.tom] ? request.data.tom : 'a1';
    if (foto.length < 100) throw new HttpsError('invalid-argument', 'Foto não recebida.');
    if (foto.length > 6000000) throw new HttpsError('invalid-argument', 'Foto grande demais.');

    // Limite diário por pessoa: protege o custo (IA_LIMITE_DIA no functions/.env; padrão 15/dia)
    const LIMITE_DIA = parseInt(process.env.IA_LIMITE_DIA || '15', 10);
    const quem = String(request.auth.token.email || request.auth.uid).toLowerCase().replace(/[^\w@.-]/g, '_');
    const dia = new Date().toISOString().slice(0, 10);
    const refUso = admin.firestore().doc(`labs/principal/iaUso/${dia}_${quem}`);
    const usoOk = await admin.firestore().runTransaction(async (tx) => {
      const s = await tx.get(refUso);
      const n = (s.exists ? (s.data().n || 0) : 0) + 1;
      if (n > LIMITE_DIA) return false;
      tx.set(refUso, { n, quem, dia }, { merge: true });
      return true;
    });
    if (!usoOk) throw new HttpsError('resource-exhausted', 'Você atingiu o limite diário da IA Special. Amanhã pode transformar mais sorrisos! ✨');

    const prompt = `Edit this photo: perform a photorealistic cosmetic dental smile makeover.
Redesign ONLY the teeth: make them well aligned and symmetric, with beautiful natural proportions and smooth healthy edges — close gaps, fix chips and worn edges, correct crowding and rotated teeth. Set the tooth color to ${TONS_DENTE[tom]}.
Keep EVERYTHING else exactly the same: the person's identity, face, skin, lips, gums, expression, framing, lighting and background must not change at all. The result must look like a real photograph of the same person after high-end dental treatment — realistic, never artificial or cartoonish.`;

    // Tenta os modelos em sequência: cada um tem cota própria — se um esgotar, o próximo assume
    const MODELOS = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'];
    let dados = null;
    let esgotados = 0;
    for (const modelo of MODELOS) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=` + chave, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: 'image/jpeg', data: foto } },
            { text: prompt },
          ] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'] },
        }),
      });
      if (resp.ok) { dados = await resp.json(); console.log(`Modelo usado: ${modelo}`); break; }
      const txt = await resp.text();
      console.error(`Gemini ${modelo} falhou`, resp.status, txt.slice(0, 300));
      if (resp.status === 429) { esgotados++; continue; }
      throw new HttpsError('internal', 'A IA não conseguiu processar esta foto. Tente outra.');
    }
    if (!dados) {
      if (esgotados === MODELOS.length) throw new HttpsError('resource-exhausted', 'A IA Special está sem créditos no Google neste momento. Avise o laboratório para reativar.');
      throw new HttpsError('internal', 'A IA não conseguiu processar esta foto. Tente outra.');
    }
    const partes = (dados.candidates && dados.candidates[0] && dados.candidates[0].content && dados.candidates[0].content.parts) || [];
    const parteImg = partes.map((p) => p.inlineData || p.inline_data).find((d) => d && d.data);
    if (!parteImg) {
      console.error('Gemini respondeu sem imagem:', JSON.stringify(dados).slice(0, 500));
      throw new HttpsError('internal', 'A IA não devolveu a imagem. Tente uma foto mais nítida do sorriso.');
    }
    console.log(`transformarSorriso ok: ${request.auth.token.email || '?'} | tom ${tom} | ${Math.round(parteImg.data.length / 1024)}KB`);
    return { foto: parteImg.data, mime: parteImg.mimeType || parteImg.mime_type || 'image/png' };
  }
);

// ─── IA Special: perguntas com foto (Special Clinic) ───
// Chat de dúvidas do dentista: identifica implantes/componentes por foto,
// responde sobre odontologia e dá passo a passo. Texto é barato (fração de centavo).
exports.perguntarIA = onCall(
  { region: 'southamerica-east1', timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para usar a IA Special.');
    const chave = (process.env.GEMINI_API_KEY || '').trim();
    if (!chave) throw new HttpsError('failed-precondition', 'A IA Special ainda está sendo ativada pelo laboratório.');
    const pergunta = String((request.data && request.data.pergunta) || '').slice(0, 4000);
    const foto = String((request.data && request.data.foto) || '');
    if (!pergunta.trim() && !foto) throw new HttpsError('invalid-argument', 'Escreva a pergunta (pode anexar foto).');
    if (foto.length > 4000000) throw new HttpsError('invalid-argument', 'Foto grande demais.');

    // Limite diário por pessoa (separado do limite de transformações)
    const LIMITE_DIA = parseInt(process.env.IA_PERGUNTAS_DIA || '40', 10);
    const quem = String(request.auth.token.email || request.auth.uid).toLowerCase().replace(/[^\w@.-]/g, '_');
    const dia = new Date().toISOString().slice(0, 10);
    const refUso = admin.firestore().doc(`labs/principal/iaUso/perguntas_${dia}_${quem}`);
    const usoOk = await admin.firestore().runTransaction(async (tx) => {
      const s = await tx.get(refUso);
      const n = (s.exists ? (s.data().n || 0) : 0) + 1;
      if (n > LIMITE_DIA) return false;
      tx.set(refUso, { n, quem, dia }, { merge: true });
      return true;
    });
    if (!usoOk) throw new HttpsError('resource-exhausted', 'Você atingiu o limite diário de perguntas. Amanhã tem mais! ✨');

    const INSTRUCAO = `Você é a IA Special, assistente do Laboratório Special (prótese dental, Petrolina/PE) para dentistas parceiros.
Responda SEMPRE em português do Brasil, com precisão técnica e objetividade, em texto corrido ou listas curtas (sem markdown pesado).
Você ajuda a: identificar implantes, componentes protéticos e materiais a partir de fotos (indique marca/modelo prováveis e o grau de certeza); responder dúvidas de odontologia e prótese; dar passo a passo clínico/laboratorial quando pedido.
Se a foto não permitir identificação segura, diga o que daria para afirmar e o que verificar (ex.: radiografia, plataforma, conexão).
Você também pode ILUSTRAR: se um desenho/esquema ajudar muito a entender (anatomia, componente protético, conexão de implante, passo técnico), ou se o usuário pedir uma imagem/desenho/esquema/exemplo visual, termine a resposta com UMA linha exatamente neste formato: [ILUSTRAR: detailed English description of a clean professional dental illustration]. Use no máximo uma ilustração por resposta e apenas quando agregar de verdade.
Encerre respostas sobre casos clínicos lembrando, em uma linha, que a conduta final deve ser confirmada com o laboratório/planejamento clínico.`;

    // Histórico curto para dar contexto à conversa
    const historico = Array.isArray(request.data && request.data.historico) ? request.data.historico.slice(-6) : [];
    const contents = historico
      .filter(m => m && m.texto)
      .map(m => ({ role: m.de === 'ia' ? 'model' : 'user', parts: [{ text: String(m.texto).slice(0, 1500) }] }));
    const partes = [];
    if (foto) partes.push({ inline_data: { mime_type: 'image/jpeg', data: foto } });
    partes.push({ text: pergunta.trim() || 'Analise esta foto.' });
    contents.push({ role: 'user', parts: partes });

    const MODELOS = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
    for (const modelo of MODELOS) {
      const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=` + chave, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: INSTRUCAO }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 1400 },
        }),
      });
      if (!resp.ok) {
        console.error(`perguntarIA ${modelo}`, resp.status, (await resp.text()).slice(0, 200));
        if (resp.status === 429) continue;
        throw new HttpsError('internal', 'A IA não conseguiu responder agora. Tente de novo.');
      }
      const dados = await resp.json();
      const texto = (((dados.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('').trim();
      if (texto) {
        console.log(`perguntarIA ok: ${quem} | ${modelo} | ${texto.length} chars`);
        // A resposta pediu uma ilustração? Gera a imagem (com limite diário próprio, pra segurar custo)
        const m = texto.match(/\[ILUSTRAR:\s*([^\]]+)\]/i);
        const resposta = texto.replace(/\[ILUSTRAR:[^\]]*\]/gi, '').trim();
        if (m) {
          const LIMITE_ILUSTRA = parseInt(process.env.IA_ILUSTRA_DIA || '12', 10);
          const refIlustra = admin.firestore().doc(`labs/principal/iaUso/ilustra_${dia}_${quem}`);
          const podeIlustrar = await admin.firestore().runTransaction(async (tx) => {
            const s = await tx.get(refIlustra);
            const n = (s.exists ? (s.data().n || 0) : 0) + 1;
            if (n > LIMITE_ILUSTRA) return false;
            tx.set(refIlustra, { n, quem, dia }, { merge: true });
            return true;
          });
          if (podeIlustrar) {
            const promptImg = `Clean, professional dental/prosthodontic educational illustration, neutral light background, no watermark, no text labels unless essential: ${m[1].trim()}`;
            const MODELOS_IMG = ['gemini-2.5-flash-image', 'gemini-3.1-flash-image-preview', 'gemini-3-pro-image-preview'];
            for (const mImg of MODELOS_IMG) {
              try {
                const ri = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mImg}:generateContent?key=` + chave, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: promptImg }] }] }),
                });
                if (!ri.ok) { console.error(`ilustrar ${mImg}`, ri.status, (await ri.text()).slice(0, 160)); continue; }
                const di = await ri.json();
                const parteImg = ((((di.candidates || [])[0] || {}).content || {}).parts || []).find(p => p.inline_data || p.inlineData);
                const inl = parteImg && (parteImg.inline_data || parteImg.inlineData);
                if (inl && inl.data) {
                  console.log(`ilustrar ok: ${quem} | ${mImg}`);
                  return { resposta, imagem: inl.data, imagemMime: inl.mime_type || inl.mimeType || 'image/png' };
                }
              } catch (e) { console.error(`ilustrar ${mImg}`, String(e).slice(0, 160)); }
            }
          }
        }
        return { resposta };
      }
    }
    throw new HttpsError('resource-exhausted', 'A IA está sem créditos neste momento. Tente mais tarde.');
  }
);
