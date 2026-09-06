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
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { extrairCampos } = require('./documento.js');
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

    // O nome do paciente aparece na tela BLOQUEADA de quem receber. Então,
    // antes de mandar, o carteiro confere aparelho por aparelho se aquela
    // pessoa é mesmo da equipe: voluntário aprovado, coordenação ou gestor.
    // Quem está esperando aprovação, foi recusado ou saiu não recebe nada.
    const daEquipe = async (uid) => {
      if (!uid) return false;
      const [vol, central, gestor] = await Promise.all([
        db.collection('voluntarios').doc(uid).get(),
        db.collection('central-usuarios').doc(uid).get(),
        db.collection('palmar-usuarios').doc(uid).get(),
      ]);
      if (central.exists || gestor.exists) return true;
      return vol.exists && vol.data().status === 'ativo';
    };
    const permitidos = await Promise.all(alvos.map((a) => daEquipe(a.uid)));
    const barrados = alvos.filter((a, i) => !permitidos[i]);
    alvos = alvos.filter((a, i) => permitidos[i]);
    if (barrados.length) console.log(`Barrados (não são da equipe): ${barrados.length}`);

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

// ─── LEITOR DE DOCUMENTO: a foto do RG/CNH/CPF vira cadastro ───
// O aplicativo manda a foto; o leitor de imagens do Google (Cloud Vision)
// devolve o texto; daqui saem nome, CPF, nascimento e número do documento.
// Só quem é da equipe pode usar. A foto NÃO fica guardada aqui — o app é
// que decide o que anexar à ficha do paciente.
exports.lerDocumento = onCall(
  { region: 'southamerica-east1', memory: '512MiB', timeoutSeconds: 60, maxInstances: 5, cors: true },
  async (req) => {
    if (!req.auth) throw new HttpsError('unauthenticated', 'Entre no aplicativo primeiro.');
    const uid = req.auth.uid;
    const db = admin.firestore();
    const [c, g, v] = await Promise.all([
      db.doc('central-usuarios/' + uid).get(), db.doc('palmar-usuarios/' + uid).get(), db.doc('voluntarios/' + uid).get(),
    ]);
    const equipe = c.exists || g.exists || (v.exists && (v.data().status === 'ativo' || v.data().ativo === true));
    if (!equipe) throw new HttpsError('permission-denied', 'Só a equipe pode ler documentos.');

    const imagem = String(req.data?.imagem || '').replace(/^data:image\/\w+;base64,/, '');
    if (!imagem || imagem.length > 7000000) throw new HttpsError('invalid-argument', 'Foto inválida ou grande demais.');

    const cred = admin.app().options.credential || admin.credential.applicationDefault();
    const tk = await cred.getAccessToken();
    const r = await fetch('https://vision.googleapis.com/v1/images:annotate', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + tk.access_token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: [{ image: { content: imagem }, features: [{ type: 'DOCUMENT_TEXT_DETECTION' }], imageContext: { languageHints: ['pt'] } }] }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.log('leitor de imagem', r.status, JSON.stringify(j).slice(0, 300));
      throw new HttpsError('unavailable', 'O leitor de documentos não respondeu (' + r.status + ').');
    }
    const texto = j.responses?.[0]?.fullTextAnnotation?.text || '';
    const campos = extrairCampos(texto);
    console.log(`documento lido por ${uid.slice(0, 6)}…: ${texto.split('\n').length} linhas; achou ${Object.entries(campos).filter(([, x]) => x).map(([k]) => k).join(', ') || 'nada'}`);
    return { campos, linhas: texto ? texto.split('\n').length : 0 };
  }
);
