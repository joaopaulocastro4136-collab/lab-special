// Confere se os segredos da chave APNs chegaram ao robô e, se chegaram,
// TESTA a chave na porta da Apple (com um token de aparelho falso):
//   resposta "BadDeviceToken"      → chave e Key ID VÁLIDOS ✅
//   resposta "InvalidProviderToken" → chave e Key ID não combinam ✗
// Nunca imprime o valor dos segredos — só o tamanho e o veredito.
import crypto from 'crypto';
import { execSync } from 'child_process';

const p8 = (process.env.APNS_KEY_P8 || '').replace(/\r/g, '');
const id = (process.env.APNS_KEY_ID || '').trim();
console.log(`APNS_KEY_P8: ${p8.length} caracteres${p8.includes('BEGIN PRIVATE KEY') ? ' (formato ok)' : p8 ? ' (⚠ sem BEGIN PRIVATE KEY)' : ''}`);
console.log(`APNS_KEY_ID: ${id.length} caracteres${/^[A-Z0-9]{10}$/.test(id) ? ' (formato ok)' : id ? ' (⚠ formato estranho)' : ''}`);
if (!p8 || !id) { console.log('\nSem os dois segredos ainda — nada para testar.'); process.exit(0); }

const TEAM = 'L5NKZSS3J2';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
let jwt;
try {
  const corpo = b64({ alg: 'ES256', kid: id }) + '.' + b64({ iss: TEAM, iat: Math.floor(Date.now() / 1000) });
  const assin = crypto.sign('sha256', Buffer.from(corpo), { key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  jwt = corpo + '.' + assin;
} catch (e) {
  console.log(`\n✗ A chave não é uma chave privada válida (${String(e.message).slice(0, 60)})`);
  process.exit(1);
}
const tokenFalso = '0'.repeat(64);
const resp = execSync(
  `curl -s --http2 -o /tmp/apns.txt -w "%{http_code}" -X POST ` +
  `-H "authorization: bearer ${jwt}" -H "apns-topic: com.sejasemente.semeador" -H "apns-push-type: alert" ` +
  `-d '{"aps":{"alert":"teste"}}' https://api.push.apple.com/3/device/${tokenFalso}`,
  { encoding: 'utf8' }
);
const corpoResp = execSync('cat /tmp/apns.txt', { encoding: 'utf8' });
console.log(`\nTeste na Apple (produção): HTTP ${resp} ${corpoResp.slice(0, 120)}`);
if (corpoResp.includes('BadDeviceToken')) console.log('✅ CHAVE VÁLIDA — a Apple aceitou a assinatura. O carteiro pode entregar.');
else if (corpoResp.includes('InvalidProviderToken')) console.log('✗ Chave e Key ID não combinam (ou a chave não vale para produção).');
else if (corpoResp.includes('TopicDisallowed') || corpoResp.includes('MissingTopic')) console.log('✗ A chave não tem permissão para os apps do Seja Semente.');
else console.log('… resposta inesperada — me mostre este log.');
