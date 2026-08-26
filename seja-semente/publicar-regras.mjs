// Publica as regras de segurança do Firestore do seja-semente-app.
//
// Antes: qualquer conta criada lia e escrevia TUDO — inclusive nome, CPF,
// endereço, telefone e as fotos de todos os pacientes. Bastava criar uma
// conta com e-mail e senha na tela de entrada.
//
// Agora vale o papel de cada um: a ficha do paciente é dado de saúde e fica
// com a EQUIPE (coordenação, voluntário ativo, gestor). Quem APOIA o projeto
// (investidor cadastrado pelo Palmar) enxerga só o que a Colheita mostra —
// as fotos do antes e depois, os procedimentos, as ações, as notas e os
// depoimentos —, e nunca o cadastro do paciente. O que não estiver escrito
// aqui fica trancado.
import crypto from 'crypto';

const SA = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const PROJETO = 'seja-semente-app';

const REGRAS = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Quem é quem ───
    // A pessoa é da COORDENAÇÃO, é VOLUNTÁRIA ativa, é GESTORA, ou é
    // APOIADORA (investidor cadastrado pelo Palmar). Cada papel enxerga só
    // o que precisa. Ficha de paciente é dado de saúde: fica com a equipe.
    function entrou() { return request.auth != null; }
    function meuEmail() { return request.auth.token.email; }
    function ehCentral() { return entrou() && exists(/databases/$(database)/documents/central-usuarios/$(request.auth.uid)); }
    function ehGestor()  { return entrou() && exists(/databases/$(database)/documents/palmar-usuarios/$(request.auth.uid)); }
    function ehVoluntario() {
      return entrou()
        && exists(/databases/$(database)/documents/voluntarios/$(request.auth.uid))
        && get(/databases/$(database)/documents/voluntarios/$(request.auth.uid)).data.status == 'ativo';
    }
    function ehEquipe() { return ehCentral() || ehGestor() || ehVoluntario(); }
    function ehApoiador() {
      return entrou() && meuEmail() != null
        && exists(/databases/$(database)/documents/apoiadores/$(meuEmail()));
    }

    // ─── Fichas dos pacientes: só a equipe ───
    match /pacientes/{paciente} {
      allow read, write: if ehEquipe();

      // As FOTOS e os PROCEDIMENTOS também abrem para quem apoia o projeto —
      // é o antes e depois que a Colheita mostra. O cadastro do paciente
      // (nome inteiro, CPF, endereço, telefone) fica de fora.
      match /arquivos/{arquivo} {
        allow read: if ehEquipe() || ehApoiador();
        allow write: if ehEquipe();
      }
      match /procedimentos/{procedimento} {
        allow read: if ehEquipe() || ehApoiador();
        allow write: if ehEquipe();
      }
      match /{resto=**} {
        allow read, write: if ehEquipe();
      }
    }
    // A Colheita lê os procedimentos de todos os pacientes de uma vez
    match /{caminho=**}/procedimentos/{procedimento} {
      allow read: if ehEquipe() || ehApoiador();
    }

    // ─── O trabalho do dia: só a equipe ───
    match /agendamentos/{doc}  { allow read, write: if ehEquipe(); }
    match /atendimentos/{doc}  { allow read, write: if ehEquipe(); }
    match /chat/{doc}          { allow read, write: if ehEquipe(); }
    match /avisos/{doc}        { allow read, write: if ehEquipe(); }
    match /chamadas/{doc}      { allow read, write: if ehEquipe(); }
    match /convocacoes/{doc}   { allow read, write: if ehEquipe(); }
    match /aparelhos/{doc}     { allow read, write: if entrou(); }
    match /estoque/{doc}       { allow read, write: if ehEquipe(); }
    match /denuncias/{doc}     { allow create: if entrou(); allow read, write: if ehCentral() || ehGestor(); }

    // ─── O que a Colheita mostra a quem apoia ───
    // Espelho da equipe (leva o nome inteiro): quem apoia NÃO entra aqui
    match /procedimentos-feitos/{doc} { allow read, write: if ehEquipe(); }
    match /acoes/{doc}                { allow read: if ehEquipe() || ehApoiador(); allow write: if ehCentral() || ehGestor(); }
    match /notas/{doc}                { allow read: if ehEquipe() || ehApoiador(); allow write: if ehCentral() || ehGestor(); }
    match /estoque-movimentos/{doc}   { allow read: if ehEquipe() || ehApoiador(); allow write: if ehEquipe(); }
    match /depoimentos/{doc}          { allow read: if ehEquipe() || ehApoiador(); allow write: if ehEquipe(); }
    match /config/{doc}               { allow read: if entrou(); allow write: if ehCentral() || ehGestor(); }

    // ─── Quem é da casa ───
    // Cada um lê e escreve o PRÓPRIO cadastro (é assim que a pessoa se
    // cadastra e é assim que ela apaga a conta). A equipe vê a lista.
    // O voluntário se cadastra sozinho, mas nasce PENDENTE e não consegue
    // se aprovar: mexer em status/ativo é só da coordenação e da gestão.
    match /voluntarios/{uid} {
      allow read: if ehEquipe() || request.auth.uid == uid;
      allow create: if request.auth.uid == uid && request.resource.data.status == 'pendente';
      allow update: if ehCentral() || ehGestor()
        || (request.auth.uid == uid
            && request.resource.data.status == resource.data.status
            && request.resource.data.get('ativo', false) == resource.data.get('ativo', false));
      allow delete: if request.auth.uid == uid || ehCentral() || ehGestor();
    }

    // Coordenação e gestão NÃO se criam sozinhas. Só entra quem gastou um
    // código válido (a marca do código fica no próprio banco) ou quem teve
    // o e-mail pré-autorizado por alguém que já está dentro.
    function gastouCodigoCentral() {
      return request.resource.data.codigo is string
        && exists(/databases/$(database)/documents/codigos-acesso/$(request.resource.data.codigo))
        && get(/databases/$(database)/documents/codigos-acesso/$(request.resource.data.codigo)).data.usadoPor == request.auth.uid;
    }
    function gastouCodigoPalmar() {
      return request.resource.data.codigo is string
        && exists(/databases/$(database)/documents/palmar-codigos/$(request.resource.data.codigo))
        && get(/databases/$(database)/documents/palmar-codigos/$(request.resource.data.codigo)).data.usadoPor == request.auth.uid;
    }
    match /central-usuarios/{uid} {
      allow read: if ehEquipe() || request.auth.uid == uid;
      allow create: if request.auth.uid == uid
        && (ehCentral() || gastouCodigoCentral() || exists(/databases/$(database)/documents/central-autorizados/$(meuEmail())));
      allow update: if request.auth.uid == uid || ehCentral();
      allow delete: if request.auth.uid == uid || ehCentral();
    }
    match /palmar-usuarios/{uid} {
      allow read: if ehEquipe() || request.auth.uid == uid;
      allow create: if request.auth.uid == uid
        && (ehGestor() || gastouCodigoPalmar() || exists(/databases/$(database)/documents/palmar-autorizados/$(meuEmail())));
      allow update: if request.auth.uid == uid || ehGestor();
      allow delete: if request.auth.uid == uid || ehGestor();
    }
    match /investidores/{doc} {
      allow read, write: if ehCentral() || ehGestor();
    }
    // A chave de entrada da Colheita: um documento por e-mail de apoiador.
    // A pessoa só consegue ver o SEU (é o que destranca o aplicativo dela).
    match /apoiadores/{email} {
      allow read: if ehEquipe() || (entrou() && meuEmail() == email);
      allow write: if ehCentral() || ehGestor();
    }

    // ─── Códigos de acesso: quem tem o código na mão pode gastá-lo ───
    // Quem tem o código na mão gasta o código — mas só marcando o PRÓPRIO
    // nome, e só se ninguém tiver gastado antes. Ninguém lista os códigos.
    function gastandoOCodigo() {
      return resource.data.get('usadoPor', null) == null
        && request.resource.data.usadoPor == request.auth.uid;
    }
    match /codigos-acesso/{codigo} {
      allow get: if entrou();
      allow list: if ehCentral();
      allow update: if ehCentral() || (entrou() && gastandoOCodigo());
      allow create, delete: if ehCentral();
    }
    match /palmar-codigos/{codigo} {
      allow get: if entrou();
      allow list: if ehGestor();
      allow update: if ehGestor() || (entrou() && gastandoOCodigo());
      allow create, delete: if ehGestor();
    }
    match /central-autorizados/{email} { allow read: if ehEquipe() || (entrou() && meuEmail() == email); allow write: if ehCentral(); }
    match /palmar-autorizados/{email} { allow read: if ehEquipe() || (entrou() && meuEmail() == email); allow write: if ehGestor(); }

    // ─── Qualquer coisa não prevista fica trancada ───
    match /{document=**} { allow read, write: if false; }
  }
}`;


async function token() {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: SA.client_email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase', aud: SA.token_uri, iat: agora, exp: agora + 3600,
  });
  const assin = crypto.sign('RSA-SHA256', Buffer.from(corpo), SA.private_key).toString('base64url');
  const r = await fetch(SA.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${corpo}.${assin}`,
  });
  return (await r.json()).access_token;
}

const TK = await token();
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://firebaserules.googleapis.com/v1' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + TK, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, json: await r.json().catch(() => ({})) };
};

// 1. Cria o conjunto de regras
const rs = await api('POST', `/projects/${PROJETO}/rulesets`, {
  source: { files: [{ name: 'firestore.rules', content: REGRAS }] },
});
if (!rs.json.name) { console.log(`✗ Falha ao criar regras (${rs.status}): ${JSON.stringify(rs.json).slice(0, 300)}`); process.exit(1); }
console.log(`✓ Regras criadas: ${rs.json.name}`);

// 2. Publica (release) para o Firestore
const releaseName = `projects/${PROJETO}/releases/cloud.firestore`;
const upd = await api('PATCH', `/${releaseName}`, {
  release: { name: releaseName, rulesetName: rs.json.name },
});
if (upd.status === 200) {
  console.log('✓ Regras PUBLICADAS no Firestore');
} else {
  const cria = await api('POST', `/projects/${PROJETO}/releases`, { name: releaseName, rulesetName: rs.json.name });
  console.log(cria.status === 200 ? '✓ Regras PUBLICADAS no Firestore' : `✗ Falha ao publicar (${cria.status}): ${JSON.stringify(cria.json).slice(0, 300)}`);
}
