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
const tokenFalso = '0'.repeat(64);
function testar(kid) {
  const corpo = b64({ alg: 'ES256', kid }) + '.' + b64({ iss: TEAM, iat: Math.floor(Date.now() / 1000) });
  const assin = crypto.sign('sha256', Buffer.from(corpo), { key: p8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
  const resp = execSync(
    `curl -s --http2 -o /tmp/apns.txt -w "%{http_code}" -X POST ` +
    `-H "authorization: bearer ${corpo + '.' + assin}" -H "apns-topic: com.sejasemente.semeador" -H "apns-push-type: alert" ` +
    `-d '{"aps":{"alert":"teste"}}' https://api.push.apple.com/3/device/${tokenFalso}`,
    { encoding: 'utf8' }
  );
  return { http: resp, corpo: execSync('cat /tmp/apns.txt', { encoding: 'utf8' }) };
}
// Se o APNS_KEY_ID vier torto, testa os IDs candidatos (os das chaves que
// existem na conta Apple) — Key ID não é segredo, só a chave .p8 é
const candidatos = /^[A-Z0-9]{10}$/.test(id) ? [id] : ['J54S2X2779', 'VLGX8U5S3G', '96UHBT6J59'];
let venceu = '';
for (const kid of candidatos) {
  try {
    const r = testar(kid);
    const ok = r.corpo.includes('BadDeviceToken');
    console.log(`Key ID ${kid}: HTTP ${r.http} ${r.corpo.slice(0, 60)} ${ok ? '✅ VÁLIDO' : ''}`);
    if (ok) { venceu = kid; break; }
  } catch (e) { console.log(`Key ID ${kid}: erro ${String(e.message).slice(0, 60)}`); process.exit(1); }
}
if (venceu) console.log(`\n✅ CHAVE VÁLIDA com o Key ID ${venceu} — a Apple aceitou a assinatura. O carteiro pode entregar.`);
else console.log('\n✗ Nenhum Key ID combinou com esta chave — o arquivo .p8 deve ser de outra chave (talvez a do robô da App Store).');
