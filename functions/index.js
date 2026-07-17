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
