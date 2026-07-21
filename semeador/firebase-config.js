// ─── Configuração do Firebase do projeto SEJA SEMENTE ───
// Este arquivo é a "chave" que liga o aplicativo Semeador à central.
// O programa Windows (na sua máquina) deve apontar para O MESMO projeto
// Firebase — é assim que os dois conversam.
//
// Enquanto os valores abaixo estiverem com "COLE_AQUI", o aplicativo roda
// em MODO DEMONSTRAÇÃO (com dados de exemplo, sem internet).
//
// Para ligar de verdade:
//   1. Crie um projeto no https://console.firebase.google.com chamado "seja-semente"
//   2. Adicione um app Web e copie a configuração para cá
//   3. Ative Authentication (E-mail/senha) e Firestore
export const FIREBASE_CONFIG = {
  apiKey: 'COLE_AQUI',
  authDomain: 'COLE_AQUI.firebaseapp.com',
  projectId: 'COLE_AQUI',
  storageBucket: 'COLE_AQUI.firebasestorage.app',
  messagingSenderId: 'COLE_AQUI',
  appId: 'COLE_AQUI',
};
