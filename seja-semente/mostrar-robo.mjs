// Mostra o e-mail da conta de serviço (o "robô") do Firebase — é esse e-mail
// que precisa ser autorizado como membro do projeto novo do Seja Semente.
const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
console.log('E-mail do robô: ' + SA.client_email.split('@').join(' @ '));
