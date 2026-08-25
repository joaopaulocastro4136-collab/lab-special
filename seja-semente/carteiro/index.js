// O "carteiro" do Seja Semente: quando alguém cria uma chamada (paciente ou
// staff), esta função manda a notificação push da Apple (APNs) para os
// iPhones certos — mesmo com o app fechado e a tela bloqueada. Enquanto
// ninguém atende (ativa: true), ele reenvia o aviso a cada ~8 segundos por
// até ~50 segundos, para insistir igual uma ligação.
//
// Os aparelhos ficam na coleção `aparelhos/{token}` (veja a PONTE.md):
// cada app logado grava seu token de push com o uid do dono, qual app é
// (central|semeador) e o idAparelho local (para não avisar quem chamou).
//
// A chave APNs (.p8) chega por variáveis de ambiente no deploy:
// APNS_KEY_P8, APNS_KEY_ID, APPLE_TEAM_ID. Sem elas, a função só loga e sai.
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const http2 = require('http2');
const crypto = require('crypto');

admin.initializeApp();

const BUNDLES = {
  central: 'com.sejasemente.central',
  semeador: 'com.sejasemente.semeador',
  palmar: 'com.sejasemente.palmar',
};

function jwtApns(p8, keyId, teamId) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'ES256', kid: keyId }) + '.' + b64({ iss: teamId, iat: Math.floor(Date.now() / 1000) });
  const assin = crypto.sign('sha256', Buffer.from(corpo), { key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  return corpo + '.' + assin;
}

// Manda um push para um aparelho; devolve o status da Apple (200 = ok,
// 410/400 BadDeviceToken = token morto, bom para limpar).
// tipo 'alert' = notificação comum; tipo 'voip' = LIGAÇÃO (CallKit): o
// iPhone mostra a tela de chamada de verdade, tocando até atender.
function empurrar(cliente, jwt, alvo, payload, tipo = 'alert', token = null) {
  const st = {};
  return new Promise((resolve) => {
    const req = cliente.request({
      ':method': 'POST',
      ':path': '/3/device/' + (token || alvo.token),
      authorization: 'bearer ' + jwt,
      'apns-topic': (BUNDLES[alvo.app] || BUNDLES.semeador) + (tipo === 'voip' ? '.voip' : ''),
      'apns-push-type': tipo,
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 120),
    });
    let corpo = '';
    req.setEncoding('utf8');
    req.on('response', (h) => { st.status = h[':status']; });
    req.on('data', (c) => { corpo += c; });
    req.on('end', () => resolve({ status: st.status, corpo }));
    req.on('error', () => resolve({ status: 0, corpo: 'erro de rede' }));
    req.end(JSON.stringify(payload));
  });
}

exports.carteiroChamadas = onDocumentCreated(
  { document: 'chamadas/{id}', region: 'southamerica-east1', timeoutSeconds: 70, memory: '256MiB', maxInstances: 3 },
  async (event) => {
    const chamada = event.data?.data();
    if (!chamada || chamada.ativa === false) return;

    const P8 = (process.env.APNS_KEY_P8 || '').replace(/\\n/g, '\n');
    const KEY_ID = process.env.APNS_KEY_ID || '';
    const TEAM = process.env.APPLE_TEAM_ID || '';
    if (!P8 || !KEY_ID || !TEAM) { console.log('Sem chave APNs configurada — carteiro dormindo.'); return; }

    const db = admin.firestore();
    const docs = await db.collection('aparelhos').get();
    let alvos = docs.docs.map((d) => ({ token: d.id, ...d.data() }));
    // Staff: só os aparelhos da pessoa escolhida. Paciente: todo mundo.
    if (chamada.tipo === 'staff') alvos = alvos.filter((a) => a.uid === chamada.paraUid);
    // Nunca avisar o aparelho de quem fez a chamada
    alvos = alvos.filter((a) => !chamada.chamadoPorAparelho || a.aparelho !== chamada.chamadoPorAparelho);
    if (!alvos.length) { console.log('Nenhum aparelho para avisar.'); return; }

    const titulo = chamada.tipo === 'staff'
      ? (chamada.motivo ? `📣 ${chamada.motivo}` : `📣 ${chamada.chamadoPorNome || 'Alguém da equipe'} está chamando VOCÊ`)
      : `📣 Chamando paciente: ${chamada.pacienteNome || ''}`;
    const texto = chamada.tipo === 'staff'
      ? (chamada.motivo
        ? `${chamada.chamadoPorNome || 'A equipe'} está chamando você — toque para responder "Estou indo".`
        : 'Toque para responder "Estou indo" — a equipe está te esperando.')
      : `${chamada.chamadoPorNome || 'Alguém'} chamou — abra para avisar "OK, estou levando".`;
    const payload = {
      aps: {
        alert: { title: titulo, body: texto },
        sound: 'default',
        'interruption-level': 'time-sensitive',
        'thread-id': 'chamada-' + event.params.id,
      },
      chamadaId: event.params.id,
    };

    const jwt = jwtApns(P8, KEY_ID, TEAM);
    const cliente = http2.connect('https://api.push.apple.com');
    cliente.on('error', (e) => console.log('http2:', String(e)));

    // Aparelho com token de LIGAÇÃO (app 6.10+): recebe a tela de chamada
    // do iPhone (CallKit), que toca sozinha até atender — um envio basta.
    // Os demais recebem a notificação comum, repetida a cada 8s.
    const comLigacao = alvos.filter((a) => a.voipToken);
    const soAviso = alvos.filter((a) => !a.voipToken);
    const quem = chamada.tipo === 'staff'
      ? (chamada.motivo || chamada.chamadoPorNome || 'Equipe Seja Semente')
      : `Paciente: ${chamada.pacienteNome || ''}`;
    for (const alvo of comLigacao) {
      const r = await empurrar(cliente, jwt, alvo, { chamadaId: event.params.id, quem }, 'voip', alvo.voipToken);
      if (r.status !== 200) console.log(`ligação ${String(alvo.voipToken).slice(0, 8)}…: ${r.status} ${r.corpo}`);
    }
    console.log(`liguei para ${comLigacao.length} aparelho(s) com tela de chamada`);

    // Insiste enquanto ninguém atende: reenvia a cada 8s, até 6 vezes
    let restantes = soAviso;
    for (let rodada = 0; rodada < 6; rodada++) {
      if (!restantes.length) break;
      const mortos = [];
      for (const alvo of restantes) {
        const r = await empurrar(cliente, jwt, alvo, payload);
        if (r.status === 410 || (r.status === 400 && r.corpo.includes('BadDeviceToken'))) mortos.push(alvo.token);
        else if (r.status !== 200) console.log(`push ${alvo.token.slice(0, 8)}…: ${r.status} ${r.corpo}`);
      }
      // Token morto (app removido, aparelho trocado): limpa da coleção
      for (const t of mortos) { db.collection('aparelhos').doc(t).delete().catch(() => {}); restantes = restantes.filter((a) => a.token !== t); }
      console.log(`rodada ${rodada + 1}: avisei ${restantes.length} aparelho(s)`);
      if (rodada === 5 || !restantes.length) break;
      await new Promise((r) => setTimeout(r, 8000));
      const denovo = await db.collection('chamadas').doc(event.params.id).get();
      if (!denovo.exists || denovo.data().ativa === false) { console.log('Chamada atendida — parando de insistir.'); break; }
    }
    cliente.close();
  }
);
