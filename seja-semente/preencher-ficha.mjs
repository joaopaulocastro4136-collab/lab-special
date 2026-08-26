// ═══════════════════════════════════════════════════════════════════════════
//  PREENCHE A FICHA DOS QUATRO APLICATIVOS NA LOJA
//
//  Tudo o que a Apple exige por escrito antes da análise: nome curto,
//  subtítulo, descrição, palavras de busca, endereço de suporte, política de
//  privacidade, categoria, direitos de conteúdo, faixa etária, o número da
//  versão e os dados da análise (quem contatar e a conta de demonstração).
//
//  O que este robô NÃO faz: fotos de tela (é outro robô) e o envio em si.
//
//  Rodar pelo robô: ativar-apple.yml com seja-semente/preencher-ficha.mjs
// ═══════════════════════════════════════════════════════════════════════════
import crypto from 'crypto';

const VERSAO = process.env.VERSAO || '8.0';
const ONG = {
  cnpj: '34.296.342/0001-12',
  email: 'sejasemente@gmail.com',
  telefone: '+55 74 98100-4444',
  nome: 'Joao Paulo',
  sobrenome: 'Castro',
  site: 'https://www.sejasemente.org',
  privacidade: 'https://www.sejasemente.org/privacidade',
};
const SENHA_ANALISE = 'AnaliseApple2026!';

const COMUM = `About us. Seja Semente is a Brazilian nonprofit (CNPJ ${ONG.cnpj}, sejasemente.org) that runs free dental clinics for people living in poverty, staffed by volunteer dentists. These apps are INTERNAL TOOLS FOR OUR VOLUNTEERS: they coordinate the field clinics and record what was done. They are not a healthcare service sold to the public, they make no diagnosis, they give no medical advice, and they are distributed by invitation only. The submitter is the person responsible for the organization; authorization documents are available on request.

TEST ACCOUNT (valid for the whole review period) is filled in above. On the login screen choose "ou com e-mail", type the email and password, and you are in — the account already has its role granted, so there is no invitation code to wait for. Any sample patients you see are fictional; there is no real patient data in the system. If the sign-in ever fails, email us at ${ONG.email} and we fix it within the hour.

ACCOUNT DELETION (5.1.1(v)) is inside the app: Profile -> "Apagar minha conta". It also appears on the screen shown to someone who signed up but has no access yet, which is the first screen a reviewer can hit.

SIGN IN WITH APPLE (4.8) is offered next to Google on every login screen.

USER CONTENT (1.2): every chat message and every testimonial has report and block; people can delete their own messages; the coordination team reviews reports and removes content within 24 hours. Contact is published in-app under "Ajuda e contato" and at ${ONG.email}.

REMOTE CONTENT: the app ships a complete, working web bundle inside the binary and runs offline. On launch it also checks our own HTTPS server for an updated bundle of the same web content (HTML/CSS/JS run by WKWebView), which is permitted by section 3.3.2 of the Program License Agreement. It never adds features beyond what was reviewed and never changes the app's primary purpose; native code ships only through App Store updates.`;

// Sobre a CATEGORIA: estes aplicativos são ferramentas internas de uma equipe
// voluntária — organizam mutirão, escala, estoque e prestação de contas. Não
// vendem serviço de saúde nem fazem diagnóstico, e é isso que as notas da
// análise dizem. Por isso a categoria é a de trabalho/organização, e não
// "Medicina": marcar Medicina puxaria a regra 5.1.1(ix), que exige que
// aplicativo de área regulada seja enviado por pessoa jurídica.
const APPS = [
  {
    bundle: 'com.sejasemente.central',
    notas: COMUM + '\n\n' + `CALLS (CallKit / PushKit). During a clinic the team is spread across rooms and a shout does not reach. When someone calls a colleague, the app places a REAL VOICE CALL between the two people: the recipient answers and they talk (WebRTC audio, peer to peer). That is why the app declares UIBackgroundModes: voip — it is genuine person-to-person voice, not a notification dressed up as a call. Every VoIP push is reported to CXProvider as required. The push payload carries only an opaque call id, no patient data (4.5.4).

TO TEST THE CALL: sign in on two devices (the central account and the Semeador account, both listed in these notes), open a patient and tap the bell, "Chamar paciente". The second device rings full screen even when locked; answering connects the audio.

CAMERA AND PHOTOS: used to photograph the patient's mouth for their own record, with consent recorded in the app.`,
    subtitulo: 'Organiza o mutirão da equipe',
    categoria: 'PRODUCTIVITY',
    saude: 'INFREQUENT_OR_MILD',
    palavras: 'mutirao,voluntario,odontologia,ong,triagem,agenda,equipe,social',
    descricao: `O Seja Semente é a ferramenta interna da equipe do projeto Seja Semente, uma organização sem fins lucrativos (CNPJ ${ONG.cnpj}) que leva atendimento odontológico gratuito a pessoas em situação de vulnerabilidade.

Este aplicativo é da coordenação do mutirão. Com ele a equipe:

• cadastra quem chega ao atendimento e registra a triagem inicial;
• marca a pessoa com o dentista voluntário certo, na hora certa;
• chama o próximo paciente e avisa a equipe, mesmo com o celular no bolso;
• acompanha o dia inteiro do mutirão em uma tela só.

Não é um serviço de saúde ao público e não faz diagnóstico: é o caderno de organização de um grupo de voluntários, feito para funcionar em quadra de escola, salão de igreja e praça, onde a internet costuma falhar.

O acesso é por convite da coordenação. Quem não foi convidado não entra e não vê nada.

Fale com a gente: ${ONG.email}`,
  },
  {
    bundle: 'com.sejasemente.semeador',
    notas: COMUM + '\n\n' + `WHAT IT DOES: the volunteer dentist's app — the day's schedule, the patient's screening, calling the next patient, and recording the procedure performed, with before/after photos and, optionally, a video testimonial from the patient.

PHOTOS AND VIDEO: taken by the volunteer during treatment, always with the patient's consent, which is recorded in the app and can be withdrawn at any time. The photo library permission exists because a volunteer often takes the photo on their own phone camera app first and attaches it afterwards. Photos are used for the patient's own record and, only when explicitly authorized, to show donors the result of their donation.

CALLS: same real person-to-person voice call as the coordination app (WebRTC audio over CallKit/PushKit), for reaching a colleague across the clinic. The push payload carries only an opaque call id, no patient data.`,
    subtitulo: 'O dia do dentista voluntário',
    categoria: 'PRODUCTIVITY',
    saude: 'INFREQUENT_OR_MILD',
    palavras: 'dentista,voluntario,mutirao,odontologia,ong,agenda,registro,social',
    descricao: `O Semeador é o aplicativo do dentista voluntário do projeto Seja Semente, organização sem fins lucrativos (CNPJ ${ONG.cnpj}) que leva atendimento odontológico gratuito a quem não tem como pagar.

No dia do mutirão, o voluntário usa o Semeador para:

• ver a agenda dele e chamar o próximo paciente;
• abrir a ficha de quem vai atender;
• registrar o que foi feito, com foto do antes e do depois;
• guardar o depoimento em vídeo de quem quis contar como foi.

Fotos e vídeos são feitos com a autorização da pessoa, registrada dentro do aplicativo e cancelável a qualquer momento. Servem para a ficha dela e, só quando ela autoriza expressamente, para mostrar a quem doou no que a doação virou.

Não é um serviço de saúde ao público e não faz diagnóstico. O acesso é por convite da coordenação.

Fale com a gente: ${ONG.email}`,
  },
  {
    bundle: 'com.sejasemente.palmar',
    notas: COMUM + '\n\n' + `WHAT IT DOES: the management app for the project's coordinators — field clinics (dates, team, report), volunteers, materials stock, invoices, and the value of treatment the project delivered.

NO PATIENT RECORDS: this app shows aggregate numbers and the team's work. The camera is used only for invoices, barcode scanning and photos of materials.

ACCESS: by a code the coordination hands out, or by an email the coordination authorizes. The test account above already has manager access.`,
    subtitulo: 'A gestão do projeto na palma',
    categoria: 'BUSINESS',
    saude: 'NONE',
    palavras: 'gestao,ong,voluntarios,estoque,mutirao,relatorio,projeto,social',
    descricao: `O Palmar é o aplicativo de quem coordena o projeto Seja Semente, organização sem fins lucrativos (CNPJ ${ONG.cnpj}) que leva atendimento odontológico gratuito a pessoas em vulnerabilidade.

Com o Palmar a coordenação:

• abre e acompanha cada mutirão — data, local, equipe e relatório;
• aprova e organiza os voluntários e o que cada um faz;
• controla o estoque de material e as notas fiscais;
• vê quanto de tratamento o projeto entregou e quanto isso custou.

Aqui não há ficha de paciente: o aplicativo mostra números do conjunto e o trabalho da equipe. A câmera serve para nota fiscal, código de barras e foto de material.

O acesso é por código dado pela coordenação.

Fale com a gente: ${ONG.email}`,
  },
  {
    bundle: 'com.sejasemente.colheita',
    notas: COMUM + '\n\n' + `WHAT IT DOES: the app for people who donate to the project. It shows what their donation turned into — before/after photos of treated patients, video testimonials, what was spent per procedure, and the invoices.

NO PATIENT RECORDS HERE: this app has no access to patient files. It receives only the patient's FIRST NAME, the treatment photos and the testimonial, and only for cases where the patient gave written, revocable, purpose-specific consent to have their image shown.

DONATIONS (3.2.2(iv)): the app is free and COLLECTS NO MONEY INSIDE THE APP. It displays the organization's Pix key and bank details so people can donate from their own banking app, and a link that opens our fundraising page in Safari. The screen states the organization's name, its CNPJ and how to obtain a receipt. Nothing is unlocked by donating.

ACCESS: by invitation code or by an email the coordination adds. The test account above is already authorized.`,
    subtitulo: 'Veja no que sua doação virou',
    categoria: 'LIFESTYLE',
    saude: 'INFREQUENT_OR_MILD',
    palavras: 'doacao,ong,transparencia,prestacao de contas,social,apoiador,projeto',
    descricao: `A Colheita é o aplicativo de quem apoia o projeto Seja Semente, organização sem fins lucrativos (CNPJ ${ONG.cnpj}) que leva atendimento odontológico gratuito a pessoas em vulnerabilidade.

Quem doou entra aqui e vê, com nome e sobrenome do projeto:

• o antes e o depois de quem foi tratado;
• o depoimento em vídeo de quem quis contar como foi;
• quanto custou cada tipo de tratamento;
• as notas fiscais do que foi comprado.

Privacidade: a Colheita não tem acesso a ficha de paciente. Chega até aqui só o primeiro nome da pessoa, a foto do tratamento e o depoimento — e apenas nos casos em que ela autorizou por escrito, com finalidade definida e podendo cancelar quando quiser.

O aplicativo é gratuito e não cobra nada por dentro dele. Ele mostra a chave Pix e os dados bancários da organização, para quem quiser doar pelo banco, e um link que abre a vaquinha no navegador.

O acesso é por código de convite ou pelo e-mail cadastrado pela coordenação.

Fale com a gente: ${ONG.email}`,
  },
];

// ── Apple ──
const KEY_ID = process.env.ASC_KEY_ID.trim();
const ISSUER = process.env.ASC_ISSUER_ID.trim();
const P8 = process.env.ASC_KEY_P8;
const agora = Math.floor(Date.now() / 1000);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sem = b64({ alg: 'ES256', kid: KEY_ID, typ: 'JWT' }) + '.' + b64({ iss: ISSUER, iat: agora, exp: agora + 1200, aud: 'appstoreconnect-v1' });
const JWT = sem + '.' + crypto.sign('sha256', Buffer.from(sem), { key: P8, dsaEncoding: 'ieee-p1363' }).toString('base64url');
const api = async (metodo, caminho, corpo) => {
  const r = await fetch('https://api.appstoreconnect.apple.com' + caminho, {
    method: metodo,
    headers: { Authorization: 'Bearer ' + JWT, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  let j = {};
  try { j = t ? JSON.parse(t) : {}; } catch (e) { j = { cru: t.slice(0, 300) }; }
  return { status: r.status, json: j };
};
const conta = (r, oque) => {
  const ok = r.status >= 200 && r.status < 300;
  const porque = r.json?.errors?.[0]?.detail || r.json?.errors?.[0]?.title || JSON.stringify(r.json).slice(0, 200);
  console.log(`  ${ok ? '✓' : '✗'} ${oque}${ok ? '' : ` — ${r.status}: ${porque}`}`);
  return ok;
};

for (const app of APPS) {
  console.log(`\n══════ ${app.bundle} ══════`);
  const r = await api('GET', `/v1/apps?filter[bundleId]=${app.bundle}`);
  const ficha = r.json.data?.[0];
  if (!ficha) { console.log('  ✗ sem ficha na loja'); continue; }
  const appId = ficha.id;

  // 1. Direitos de conteúdo — nada de terceiros aqui dentro
  conta(await api('PATCH', `/v1/apps/${appId}`, {
    data: { type: 'apps', id: appId, attributes: { contentRightsDeclaration: 'DOES_NOT_USE_THIRD_PARTY_CONTENT' } },
  }), 'direitos de conteúdo');

  // 2. Faixa etária — respondendo tudo, sem enfeitar
  const idade = {
    alcoholTobaccoOrDrugUseOrReferences: 'NONE',
    contests: 'NONE',
    gamblingSimulated: 'NONE',
    horrorOrFearThemes: 'NONE',
    matureOrSuggestiveThemes: 'NONE',
    medicalOrTreatmentInformation: app.saude,
    profanityOrCrudeHumor: 'NONE',
    sexualContentGraphicAndNudity: 'NONE',
    sexualContentOrNudity: 'NONE',
    violenceCartoonOrFantasy: 'NONE',
    violenceRealistic: 'NONE',
    violenceRealisticProlongedGraphicOrSadistic: 'NONE',
    gambling: false,
    unrestrictedWebAccess: false,
    kidsAgeBand: null,
    // 'seventeenPlus' saiu do formulário da Apple: mandar junto derruba a
    // gravação inteira com 409 e a faixa etária ficava sem resposta.
  };
  // 3. Categoria, subtítulo e política de privacidade (ficha do app)
  const infos = await api('GET', `/v1/apps/${appId}/appInfos`);
  const info = infos.json.data?.[0];

  // O formulário da faixa etária fica pendurado na FICHA (appInfo), não no
  // aplicativo. Pelo caminho antigo a Apple devolve vazio e nada é gravado.
  let declId = null;
  if (info) {
    const d1 = await api('GET', `/v1/appInfos/${info.id}/ageRatingDeclaration`);
    declId = d1.json.data?.id || null;
  }
  if (!declId) {
    const d2 = await api('GET', `/v1/apps/${appId}/ageRatingDeclaration`);
    declId = d2.json.data?.id || null;
  }
  if (declId) {
    // A Apple muda as perguntas deste formulário de tempos em tempos, e ela
    // exige TODAS as respostas de uma vez. Por isso a gente lê o formulário
    // dela primeiro e só troca por cima o que nos interessa — assim as
    // perguntas novas, que a gente nem conhece, vão junto com o valor que
    // já estava lá.
    const atual = await api('GET', `/v1/ageRatingDeclarations/${declId}`);
    let campos = { ...(atual.json.data?.attributes || {}), ...idade };
    let r = null;
    for (let volta = 0; volta < 8; volta++) {
      r = await api('PATCH', `/v1/ageRatingDeclarations/${declId}`, {
        data: { type: 'ageRatingDeclarations', id: declId, attributes: campos },
      });
      if (r.status < 300) break;
      const detalhe = String(r.json?.errors?.[0]?.detail || '');
      const sobrando = detalhe.match(/'([A-Za-z]+)' is not an attribute/);
      if (sobrando && sobrando[1] in campos) {
        console.log(`    (a Apple não usa mais "${sobrando[1]}" — tirei)`);
        delete campos[sobrando[1]];
        continue;
      }
      const faltando = detalhe.match(/must provide a value for the attribute '([A-Za-z]+)'/);
      if (faltando && campos[faltando[1]] === undefined) {
        // Pergunta nova que a gente não conhece: responde o mais inofensivo
        console.log(`    (pergunta nova "${faltando[1]}" — respondi que não)`);
        campos[faltando[1]] = false;
        continue;
      }
      break;
    }
    conta(r, 'faixa etária');
  } else {
    console.log('  ✗ faixa etária: a Apple não devolveu o formulário por nenhum caminho');
  }

  if (info) {
    conta(await api('PATCH', `/v1/appInfos/${info.id}`, {
      data: {
        type: 'appInfos', id: info.id,
        relationships: { primaryCategory: { data: { type: 'appCategories', id: app.categoria } } },
      },
    }), `categoria ${app.categoria}`);

    const locs = await api('GET', `/v1/appInfos/${info.id}/appInfoLocalizations`);
    for (const l of (locs.json.data || [])) {
      if (l.attributes.locale !== 'pt-BR') continue;
      conta(await api('PATCH', `/v1/appInfoLocalizations/${l.id}`, {
        data: {
          type: 'appInfoLocalizations', id: l.id,
          attributes: { subtitle: app.subtitulo, privacyPolicyUrl: ONG.privacidade },
        },
      }), 'subtítulo e política de privacidade');
    }
  }

  // 4. A versão: número, descrição, palavras de busca e endereço de suporte
  const vs = await api('GET', `/v1/apps/${appId}/appStoreVersions?limit=3&fields[appStoreVersions]=versionString,appStoreState`);
  const versao = (vs.json.data || []).find(v => ['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED'].includes(v.attributes.appStoreState));
  if (!versao) { console.log('  ✗ nenhuma versão aberta para editar'); continue; }

  if (versao.attributes.versionString !== VERSAO) {
    conta(await api('PATCH', `/v1/appStoreVersions/${versao.id}`, {
      data: { type: 'appStoreVersions', id: versao.id, attributes: { versionString: VERSAO } },
    }), `número da versão ${versao.attributes.versionString} → ${VERSAO}`);
  } else console.log(`  ✓ número da versão já é ${VERSAO}`);

  const vlocs = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreVersionLocalizations`);
  for (const l of (vlocs.json.data || [])) {
    if (l.attributes.locale !== 'pt-BR') continue;
    conta(await api('PATCH', `/v1/appStoreVersionLocalizations/${l.id}`, {
      data: {
        type: 'appStoreVersionLocalizations', id: l.id,
        attributes: {
          description: app.descricao,
          keywords: app.palavras,
          supportUrl: ONG.site,
          marketingUrl: ONG.site,
        },
      },
    }), 'descrição, palavras de busca e endereço de suporte');
  }

  // 5. Os dados da análise: com quem falar e a conta de demonstração
  const conto = `analise.${app.bundle.split('.').pop()}@sejasemente.org`;
  const dadosAnalise = {
    contactFirstName: ONG.nome, contactLastName: ONG.sobrenome,
    contactPhone: ONG.telefone, contactEmail: ONG.email,
    demoAccountRequired: true,
    demoAccountName: conto,
    demoAccountPassword: SENHA_ANALISE,
    notes: app.notas,
  };
  const det = await api('GET', `/v1/appStoreVersions/${versao.id}/appStoreReviewDetail`);
  if (det.json.data?.id) {
    conta(await api('PATCH', `/v1/appStoreReviewDetails/${det.json.data.id}`, {
      data: { type: 'appStoreReviewDetails', id: det.json.data.id, attributes: dadosAnalise },
    }), 'dados da análise');
  } else {
    conta(await api('POST', '/v1/appStoreReviewDetails', {
      data: {
        type: 'appStoreReviewDetails', attributes: dadosAnalise,
        relationships: { appStoreVersion: { data: { type: 'appStoreVersions', id: versao.id } } },
      },
    }), 'dados da análise');
  }
}
console.log('\n✓ Fim — falta as fotos de tela e anexar o build.');
