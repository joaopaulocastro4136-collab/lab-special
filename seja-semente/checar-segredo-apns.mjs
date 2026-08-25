// Confere se os segredos da chave APNs chegaram ao robô.
// Nunca imprime o valor — só o tamanho (0 = não existe/vazio).
const p8 = process.env.APNS_KEY_P8 || '';
const id = process.env.APNS_KEY_ID || '';
console.log(`APNS_KEY_P8: ${p8.length} caracteres${p8.includes('BEGIN PRIVATE KEY') ? ' (formato ok)' : p8 ? ' (⚠ sem BEGIN PRIVATE KEY)' : ''}`);
console.log(`APNS_KEY_ID: ${id.length} caracteres${/^[A-Z0-9]{10}$/.test(id.trim()) ? ' (formato ok)' : id ? ' (⚠ formato estranho)' : ''}`);
