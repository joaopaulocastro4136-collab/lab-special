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

function enviarAPNs(tokenAparelho, bundle, titulo, corpo) {
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
    req.end(JSON.stringify({ aps: { alert: { title: titulo, body: corpo }, sound: 'default', badge: 1 } }));
    setTimeout(() => { try { cliente.close(); } catch (e) { } resolve({ status: 0, resposta: 'timeout' }); }, 10000);
  });
}

// Envia p/ todos os aparelhos do destino: 'lab' (equipe) ou 'clinica' (um dentista)
async function notificar(destino, dentista, titulo, corpo) {
  const db = admin.firestore();
  let consulta = db.collection('labs/principal/pushTokens').where('tipo', '==', destino);
  if (destino === 'clinica') consulta = consulta.where('dentista', '==', dentista);
  const snap = await consulta.get();
  console.log(`notificar ${destino}${dentista ? ' (' + dentista + ')' : ''}: ${snap.size} aparelho(s) — ${titulo}`);
  const invalidos = [];
  for (const d of snap.docs) {
    const t = d.data();
    try {
      if (t.plataforma === 'ios') {
        const r = await enviarAPNs(t.token, BUNDLES[destino], titulo, corpo);
        console.log(`  ios ${t.token.slice(0, 12)}…: ${r.status} ${r.resposta || ''}`);
        if (r.status === 400 || r.status === 410) invalidos.push(d.ref);
      } else {
        await admin.messaging().send({ token: t.token, notification: { title: titulo, body: corpo }, android: { priority: 'high' } });
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

exports.aoCriarCaso = onDocumentCreated({ ...OPCOES, document: 'labs/principal/casos/{id}' }, async (event) => {
  const c = event.data && event.data.data();
  if (!c) return;
  if (c.origem === 'clinica') {
    await notificar('lab', null, '🆕 Trabalho novo da clínica', `${c.dentista} enviou: ${c.paciente} (${c.tipoTrabalho}) — já está para retirada.`);
  } else if (c.dentista) {
    await notificar('clinica', c.dentista, 'Trabalho novo no laboratório', `${c.paciente} (${c.tipoTrabalho}) foi adicionado pelo Laboratório Special.`);
  }
});

exports.aoMudarCaso = onDocumentUpdated({ ...OPCOES, document: 'labs/principal/casos/{id}' }, async (event) => {
  const antes = event.data && event.data.before.data();
  const depois = event.data && event.data.after.data();
  if (!antes || !depois) return;

  // Ficou pronto → avisa o dentista que sai para entrega
  if (antes.status !== 'Pronto' && depois.status === 'Pronto' && depois.dentista) {
    await notificar('clinica', depois.dentista, 'Pronto para entrega! 🎉', `${depois.paciente} (${depois.tipoTrabalho}) ficou pronto e sai para entrega.`);
  }

  // Aprovações de arquivo: compara os anexos de antes e de depois
  const mapaAntes = {};
  (antes.anexos || []).forEach((a) => { mapaAntes[a.id] = a; });
  for (const a of (depois.anexos || [])) {
    const statusNovo = a.aprovacao && a.aprovacao.status;
    const statusVelho = mapaAntes[a.id] && mapaAntes[a.id].aprovacao && mapaAntes[a.id].aprovacao.status;
    if (statusNovo === 'pendente' && statusVelho !== 'pendente' && depois.dentista) {
      await notificar('clinica', depois.dentista, 'Aprovação solicitada 👍', `O laboratório pediu sua aprovação: "${a.nome}" — ${depois.paciente}. Abra para ver e aprovar.`);
    }
    if (statusNovo === 'aprovado' && statusVelho !== 'aprovado') {
      await notificar('lab', null, 'Arquivo aprovado ✓', `${depois.dentista} aprovou "${a.nome}" (${depois.paciente}).`);
    }
  }
});

// ─── IA Special: transformador de sorriso (Special Clinic) ───
// Recebe a foto do sorriso, redesenha os dentes com IA generativa (Gemini) —
// alinhamento, simetria, proporção e o tom de cor escolhido — e devolve a foto.
// Chave nos secrets: GEMINI_API_KEY (criada em aistudio.google.com/apikey).
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const TONS_DENTE = {
  claro: 'a bright whitened "Hollywood white" (BL1 dental shade), while still looking like real natural enamel',
  natural: 'a healthy natural white (A1 dental shade), with realistic enamel translucency',
  escuro: 'a discreet, slightly warmer natural ivory (A2-A3 dental shade), realistic and understated',
};

exports.transformarSorriso = onCall(
  { region: 'southamerica-east1', secrets: [GEMINI_API_KEY], timeoutSeconds: 120, memory: '512MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Entre na sua conta para usar a IA Special.');
    const foto = String((request.data && request.data.foto) || '');
    const tom = TONS_DENTE[request.data && request.data.tom] ? request.data.tom : 'natural';
    if (foto.length < 100) throw new HttpsError('invalid-argument', 'Foto não recebida.');
    if (foto.length > 6000000) throw new HttpsError('invalid-argument', 'Foto grande demais.');

    const prompt = `Edit this photo: perform a photorealistic cosmetic dental smile makeover.
Redesign ONLY the teeth: make them well aligned and symmetric, with beautiful natural proportions and smooth healthy edges — close gaps, fix chips and worn edges, correct crowding and rotated teeth. Set the tooth color to ${TONS_DENTE[tom]}.
Keep EVERYTHING else exactly the same: the person's identity, face, skin, lips, gums, expression, framing, lighting and background must not change at all. The result must look like a real photograph of the same person after high-end dental treatment — realistic, never artificial or cartoonish.`;

    const resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=' + GEMINI_API_KEY.value().trim(), {
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
    if (!resp.ok) {
      const txt = await resp.text();
      console.error('Gemini falhou', resp.status, txt.slice(0, 500));
      if (resp.status === 429) throw new HttpsError('resource-exhausted', 'A IA atingiu o limite de agora. Tente de novo em alguns minutos.');
      throw new HttpsError('internal', 'A IA não conseguiu processar esta foto. Tente outra.');
    }
    const dados = await resp.json();
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
