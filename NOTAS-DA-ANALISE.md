# Notas para a análise da Apple

O que colar em **App Store Connect → a versão → App Review Information → Notes**,
um texto por aplicativo. Está em inglês porque é a língua da análise.

Antes de enviar, confira:

- [ ] Conta de demonstração preenchida (**Sign-in required** ligado), com a senha que o robô `preparar-analise.mjs` imprime
- [ ] Vídeo curto anexado mostrando: entrar → chamar alguém → o outro aparelho tocando bloqueado → atender e **falar** → apagar a conta
- [ ] Preço **Free** nos quatro
- [ ] Faixa etária respondida
- [ ] Link da política de privacidade preenchido

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
> **Test accounts** are below and are valid for the whole review period. Sample
> patients are fictional — no real patient data is present.
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

> **What it does.** Management app for the project's coordinators: field clinics
> (dates, team, report), volunteers, materials stock, invoices and the value produced
> by the project.
>
> **No patient records.** This app shows aggregate numbers and the team's work. The
> camera is used only for invoices, barcode scanning and photos of materials.

---

## Colheita — `com.sejasemente.colheita`

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
