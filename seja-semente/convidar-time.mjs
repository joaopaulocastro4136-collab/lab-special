// Torna uma conta testadora INTERNA dos apps do Seja Semente (recebe builds
// na hora, sem análise beta): 1) convida o e-mail para o time do App Store
// Connect (se ainda não for membro); 2) tenta colocar o e-mail nos grupos
// internos dos dois apps (só funciona depois que a pessoa aceita o convite
// no e-mail — rodar de novo depois do aceite completa o serviço).
import crypto from 'crypto';

const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const EMAIL = 'joaopaulocastro41@gmail.com';

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

// 1. Já é membro do time? Já tem convite pendente?
const membros = await api('GET', `/v1/users?filter[username]=${encodeURIComponent(EMAIL)}`);
const membro = (membros.dados?.data || [])[0];
if (membro) {
  console.log(`✓ ${EMAIL} já é membro do time (${membro.attributes.roles.join(', ')})`);
} else {
  const convites = await api('GET', `/v1/userInvitations?filter[email]=${encodeURIComponent(EMAIL)}`);
  const pendente = (convites.dados?.data || [])[0];
  if (pendente) {
    console.log(`• Convite de time já enviado para ${EMAIL} (aguardando aceite no e-mail; vence ${(pendente.attributes.expirationDate || '').slice(0, 10)})`);
  } else {
    const novo = await api('POST', '/v1/userInvitations', {
      data: {
        type: 'userInvitations',
        attributes: {
          email: EMAIL,
          firstName: 'João Paulo',
          lastName: 'Castro',
          roles: ['DEVELOPER'],
          allAppsVisible: true,
          provisioningAllowed: false,
        },
      },
    });
    if (novo.status >= 200 && novo.status < 300) {
      console.log(`✓ Convite de time enviado para ${EMAIL} — abrir o e-mail da Apple e aceitar`);
    } else {
      console.log(`✗ Falha ao convidar (${novo.status}): ${JSON.stringify(novo.dados?.errors || novo.dados).slice(0, 300)}`);
    }
  }
}

// 2. Tenta colocar nos grupos internos (só dá certo depois do aceite)
for (const [nome, appId] of [['Seja semente', '6792989095'], ['Semeador', '6792989190']]) {
  const grupos = await api('GET', `/v1/betaGroups?filter[app]=${appId}&filter[isInternalGroup]=true`);
  const grupo = grupos.dados?.data?.[0];
  if (!grupo) { console.log(`${nome}: sem grupo interno`); continue; }

  const atuais = await api('GET', `/v1/betaGroups/${grupo.id}/betaTesters?fields[betaTesters]=email&limit=50`);
  if ((atuais.dados?.data || []).some(t => (t.attributes.email || '').toLowerCase() === EMAIL)) {
    console.log(`✓ ${nome}: ${EMAIL} já está no grupo interno "${grupo.attributes.name}"`);
    continue;
  }

  const busca = await api('GET', `/v1/betaTesters?filter[email]=${encodeURIComponent(EMAIL)}&filter[apps]=${appId}`);
  const tester = (busca.dados?.data || [])[0];
  if (!tester) { console.log(`• ${nome}: ${EMAIL} ainda não aparece como testador do time — rodar de novo depois do aceite`); continue; }

  const liga = await api('POST', `/v1/betaGroups/${grupo.id}/relationships/betaTesters`, {
    data: [{ type: 'betaTesters', id: tester.id }],
  });
  console.log(liga.status === 204
    ? `✓ ${nome}: ${EMAIL} entrou no grupo interno "${grupo.attributes.name}"`
    : `• ${nome}: ainda não deu para entrar no grupo interno (${liga.status}) — rodar de novo depois do aceite`);
}
console.log('\nFim.');
