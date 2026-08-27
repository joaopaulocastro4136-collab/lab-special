# Notas para a análise da Apple

O que colar em **App Store Connect → a versão → App Review Information → Notes**,
um texto por aplicativo. Está em inglês porque é a língua da análise.

**A maior parte disto já está preenchida por robô.** Os textos abaixo são o
que o robô `seja-semente/preencher-ficha.mjs` grava nas notas da análise — estão
aqui para consulta e para editar quando mudar alguma coisa.

O que o robô já deixou pronto nos quatro:

- [x] Conta de demonstração (**Sign-in required** ligado), já criada e com o papel liberado
- [x] Categoria, direitos de conteúdo e faixa etária
- [x] Subtítulo, descrição, palavras de busca, endereço de suporte
- [x] Política de privacidade
- [x] Fotos de tela (5 por aplicativo, 1290×2796)
- [x] Preço **Free** nos quatro
- [x] Versão **8.0** — acima de tudo o que já foi para o TestFlight

O que ainda depende de gente:

- [ ] **A declaração de privacidade da loja** (App Privacy) — a Apple **não
  expõe isso na API**: todos os caminhos respondem "não existe". Tem que ser no
  site, uma vez por aplicativo. É o que está segurando o envio: sem ela a Apple
  recusa dizendo só "This resource cannot be reviewed". Os passos e as
  respostas estão logo abaixo.

- [ ] **Telefone de contato da análise** — a Apple exige um número de verdade
- [ ] Vídeo curto mostrando: entrar → chamar alguém → o outro aparelho tocando bloqueado → atender e **falar** → apagar a conta (opcional, mas ajuda muito na regra da ligação)

**Sobre a categoria:** os quatro entram como ferramenta de trabalho
(Produtividade, Negócios, Estilo de Vida), não como "Medicina". É o que eles de
fato são, e evita a regra 5.1.1(ix), que exige pessoa jurídica para aplicativo
de área regulada — o envio é por conta pessoal.

---

## A declaração de privacidade — para preencher no site

**Onde:** App Store Connect → o aplicativo → menu da esquerda, **App Privacy**
→ **Get Started** (ou **Editar**).

**Primeira pergunta — "Do you or your third-party partners collect data from
this app?"** → **Yes, we collect data from this app**.

**Depois ele lista as categorias.** Marque só as da tabela abaixo. Para
**cada uma** que marcar, as três perguntas seguintes são sempre as mesmas:

1. *Para que é usado?* → **App Functionality** (só isso)
2. *É ligado à identidade da pessoa?* → **Yes** (é ficha de atendimento, não
   adianta dizer que é anônimo)
3. *É usado para rastrear?* → **No**

No fim, **Publish**. Sem publicar, não vale.

### O que marcar em cada aplicativo

| Categoria | Seja Semente | Semeador | Palmar | Colheita |
| --- | :---: | :---: | :---: | :---: |
| Name | ✓ | ✓ | ✓ | ✓ |
| Email Address | ✓ | ✓ | ✓ | ✓ |
| Phone Number | ✓ | ✓ | ✓ | |
| Health | ✓ | ✓ | | ✓ |
| Photos or Videos | ✓ | ✓ | ✓ | ✓ |
| Other User Content | ✓ | ✓ | | |
| User ID | ✓ | ✓ | ✓ | ✓ |

Nada de propaganda, nada de análise de comportamento, nada de rastreamento —
não marque nenhuma dessas finalidades em lugar nenhum.

Por que cada um é assim:

- **Palmar** não tem ficha de paciente: por isso fica sem *Health* e sem
  *Other User Content*.
- **Colheita** recebe o primeiro nome, a foto do tratamento e o depoimento em
  vídeo: por isso tem *Health*, mas não tem telefone nem conversa.
- **Seja Semente** e **Semeador** têm tudo, inclusive a conversa da equipe
  (*Other User Content*).

Quando terminar nos quatro, é só avisar que o robô do envio manda tudo.

---

## As contas de demonstração (já criadas)

Senha de todas: `AnaliseApple2026!`

| Aplicativo | E-mail | O que o analista vê |
| --- | --- | --- |
| Seja Semente (central) | `analise.central@sejasemente.org` | coordenação, com tudo liberado |
| Semeador | `analise.semeador@sejasemente.org` | voluntário já aprovado |
| Palmar | `analise.palmar@sejasemente.org` | gestor |
| Colheita | `analise.colheita@sejasemente.org` | apoiador |

As quatro entram também na Colheita, para o analista conseguir ver a prestação
de contas de qualquer uma delas. Os dois pacientes que aparecem (`Paciente
Exemplo Um` e `Paciente Exemplo Dois`) são fictícios — não existe nenhum dado de
pessoa real no banco.

Para recriar as contas (se a senha for trocada ou o banco for zerado de novo),
rode `seja-semente/preparar-analise.mjs` pelo robô.

---

## Texto comum aos quatro (o começo)

> **About us.** Seja Semente is a Brazilian nonprofit (CNPJ 34.296.342/0001-12,
> sejasemente.org) that runs free dental clinics for people in poverty, staffed by
> volunteer dentists. These apps are **internal tools for our volunteers** — they
> coordinate the field clinics and record what was done. They are not a healthcare
> service sold to the public, they make no diagnosis, and they are distributed by
> invitation only.
>
> The submitter is the person responsible for the organization. Authorization
> documents are available on request.
>
> **Test account** (valid for the whole review period, password
> `AnaliseApple2026!`): use the email listed for this app in the section below.
> Sign in with "ou com e-mail" on the login screen — the account already has its
> role granted, so you go straight in. Sample patients are fictional; no real
> patient data is present. If the password ever fails, email us and we reset it
> within the hour.
>
> **Account deletion** (5.1.1(v)) is inside every app: Profile → "Apagar minha
> conta". It also appears on the screens shown to someone who signed up but has no
> access yet, which is the case a reviewer hits first.
>
> **User content** (1.2): every chat message and every testimonial has report and
> block; people can delete their own messages; the coordination team reviews reports
> and removes content within 24 hours. Contact is published in-app under
> "Ajuda e contato" and at sejasemente@gmail.com.

---

## Seja Semente (central) — `com.sejasemente.central`

> **Reviewer account:** `analise.central@sejasemente.org` / `AnaliseApple2026!`

> **What it does.** Coordination app: registers people who come to a free clinic,
> records the initial screening, schedules them with a volunteer dentist, and
> notifies the team.
>
> **Calls (CallKit / PushKit).** During a clinic the team is spread across rooms.
> When someone calls a colleague, the app places a **real voice call between the two
> people** — the recipient answers and they talk (WebRTC audio, peer to peer). This
> is why the app uses `UIBackgroundModes: voip`: it is genuine person-to-person
> voice, not a notification dressed as a call. Every VoIP push is reported to
> `CXProvider` as required. **The push payload carries only an opaque call id — no
> patient data** (4.5.4).
>
> **To test the call:** sign in on two devices with the two accounts below, open a
> patient and tap "🔔 Chamar paciente". The second device rings full-screen even when
> locked; answering connects the audio.

---

## Semeador — `com.sejasemente.semeador`

> **Reviewer account:** `analise.semeador@sejasemente.org` / `AnaliseApple2026!`

> **What it does.** The volunteer dentist's app: the day's schedule, patient
> screening, calling the next patient, and recording the procedure that was
> performed, with before/after photos and a video testimonial from the patient.
>
> **Photos and video.** Taken by the volunteer during treatment, always with the
> patient's consent, which is recorded in the app and can be withdrawn at any time.
> They are used for the patient's own record and, only when explicitly authorized, to
> show donors the result of their donation.
>
> **Calls.** Same real voice call as the central app — see that entry.

---

## Palmar — `com.sejasemente.palmar`

> **Reviewer account:** `analise.palmar@sejasemente.org` / `AnaliseApple2026!`

> **What it does.** Management app for the project's coordinators: field clinics
> (dates, team, report), volunteers, materials stock, invoices and the value produced
> by the project.
>
> **No patient records.** This app shows aggregate numbers and the team's work. The
> camera is used only for invoices, barcode scanning and photos of materials.

---

## Colheita — `com.sejasemente.colheita`

> **Reviewer account:** `analise.colheita@sejasemente.org` / `AnaliseApple2026!`

> **What it does.** The app for people who donate to the project: it shows what their
> donation turned into — before/after photos of treated patients, video testimonials,
> what was spent per procedure and the invoices.
>
> **No patient records here.** This app has no access to patient files. It only
> receives the patient's **first name**, the treatment photos and the testimonial,
> and only for cases where the patient gave written, revocable, purpose-specific
> consent to have their image shown. Access is by invitation code or by the
> coordination adding the donor's email.
>
> **Donations** (3.2.2(iv)). The app is free and **collects no money inside the app**.
> It displays the organization's Pix key and bank details for people to use in their
> own banking app, and a link that opens the external fundraising page in Safari. The
> screen states the organization's name, CNPJ and how to obtain a receipt.

---

## Se a análise perguntar sobre o carregamento de conteúdo

> The app ships a complete, working web bundle inside the binary and runs entirely
> offline. On launch it also checks our own HTTPS server for an updated bundle of the
> same web content (HTML/CSS/JS run by WKWebView), which is permitted by section
> 3.3.2 of the Program License Agreement. This never adds features beyond what was
> reviewed and never changes the app's primary purpose; native code and plugins ship
> only through App Store updates.
