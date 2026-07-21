# Ponte do projeto Seja Semente

Este documento é o **contrato de comunicação** entre as três pontas do
projeto:

1. **Programa Windows** (a Central instalada na máquina do projeto — em
   desenvolvimento no seu computador)
2. **Aplicativo Seja Semente** (`semente/`) — a mesma Central, em versão
   mobile: triagem inicial, agendamentos, avisos e equipe
3. **Aplicativo Semeador** (`semeador/`) — o app do voluntário: vê avisos,
   escalas e agenda, confirma presença e pode agendar

Nenhuma ponta se conecta diretamente na outra — todas conversam através
do **mesmo banco de dados na nuvem (Firebase / Firestore)**, em tempo real:

```
  Programa Windows        App Seja Semente         App Semeador
     (Central)            (Central mobile)         (voluntário)
         │                       │                       │
         │  triagens, agenda,    │  as mesmas coisas,    │  lê tudo, confirma
         │  avisos, escalas,     │  no celular           │  presença e agenda
         │  voluntários          │                       │
         ▼                       ▼                       ▼
       ┌───────────────────────────────────────────────────┐
       │         Firebase · projeto seja-semente            │
       │         (Firestore + Authentication)               │
       └───────────────────────────────────────────────────┘
```

Vantagens desse desenho: funciona de qualquer lugar (não precisa estar na
mesma rede), é em tempo real (o que a Central escreve aparece na hora no
celular), e cada ponta pode ser desenvolvida de forma independente — basta
todas respeitarem este contrato.

> **Importante ao desenvolver o programa Windows:** use o MESMO projeto
> Firebase (`seja-semente`) e siga os nomes de coleções e campos abaixo,
> exatamente como estão escritos.

## Coleções do Firestore

### `voluntarios/{uid}` — cadastro dos voluntários
O `{uid}` é o ID do usuário no Firebase Authentication.

**Fluxo de entrada do voluntário** (importante para o programa Windows):
1. O voluntário entra no Semeador com a **conta Google** (ou e-mail/senha)
2. Na primeira entrada, ele preenche o cadastro (nome, telefone, CPF,
   data de nascimento) — o próprio Semeador cria `voluntarios/{uid}` com
   `status: "pendente"` (é a **solicitação de cadastro**)
3. A solicitação aparece na Central (Windows e app Seja Semente, aba
   Equipe) com todos os dados; a coordenação **aprova** (`status: "ativo"`,
   `ativo: true`) ou **recusa** (`status: "recusado"`, `ativo: false`)
4. No celular do voluntário o app libera (ou avisa a recusa) na hora

| Campo          | Tipo      | Quem escreve | Exemplo                       |
|----------------|-----------|--------------|-------------------------------|
| `nome`         | string    | voluntário   | `"Maria Souza"`               |
| `email`        | string    | voluntário   | `"maria@gmail.com"`           |
| `foto`         | string    | voluntário   | URL da foto da conta Google   |
| `telefone`     | string    | voluntário   | `"(11) 91234-5678"`           |
| `cpf`          | string    | voluntário   | `"123.456.789-00"`            |
| `nascimento`   | string `AAAA-MM-DD` | voluntário | `"1995-03-14"`        |
| `solicitadoEm` | timestamp | voluntário   | data/hora da solicitação      |
| `status`       | string    | Central      | `"pendente"` → `"ativo"` ou `"recusado"` |
| `ativo`        | boolean   | Central      | `true`                        |
| `ministerio`   | string    | Central      | `"Acolhimento"`               |

### `avisos/{id}` — mural de avisos
Quem escreve: **Central**. Quem lê: aplicativo (ordena por `criadoEm` decrescente).

| Campo      | Tipo               | Exemplo                          |
|------------|--------------------|----------------------------------|
| `titulo`   | string             | `"Mutirão de sábado"`            |
| `texto`    | string             | `"Chegar às 8h na sede…"`        |
| `autor`    | string             | `"Coordenação"`                  |
| `criadoEm` | timestamp          | data/hora da publicação          |

### `escalas/{id}` — escalas de serviço
Quem escreve: **Central** (cria e monta a lista). O aplicativo só escreve
no campo `confirmados`, quando o voluntário confirma presença.

| Campo         | Tipo                          | Exemplo                                 |
|---------------|-------------------------------|-----------------------------------------|
| `data`        | string `AAAA-MM-DD`           | `"2026-07-25"`                          |
| `hora`        | string `HH:MM`                | `"08:00"`                               |
| `ministerio`  | string                        | `"Distribuição"`                        |
| `local`       | string                        | `"Praça Central"`                       |
| `voluntarios` | array de `{ uid, nome }`      | `[{ "uid": "abc", "nome": "Maria" }]`   |
| `confirmados` | mapa `{ uid: boolean }`       | `{ "abc": true }`                       |

O aplicativo mostra ao voluntário apenas as escalas em que o `uid` dele
aparece em `voluntarios`. Ao tocar em "Confirmar presença", o app grava
`confirmados.{uid} = true` — a Central enxerga isso na hora e pode marcar
o voluntário como confirmado na tela do Windows.

### `pacientes/{id}` — pacientes acolhidos (cadastro + triagem)
Quem escreve: **Central** (Windows ou app Seja Semente). O Semeador lê os
pacientes cuja triagem designou o voluntário logado.

**Fluxo:** 1) o CADASTRO cria o paciente (`status: "cadastrado"`, `triagem:
null`); 2) a TRIAGEM preenche o campo `triagem` (procedimento, saúde e o
profissional que vai atender) e muda `status` para `"triado"` — a partir
daí o paciente aparece no Semeador do profissional e pode ir para a agenda.

| Campo         | Tipo      | Exemplo                                        |
|---------------|-----------|------------------------------------------------|
| `nome`        | string    | `"José da Silva"`                              |
| `idade`       | string    | `"52"`                                         |
| `telefone`    | string    | `"(11) 98888-1111"`                            |
| `observacoes` | string    | `"Sente dor há duas semanas…"`                 |
| `status`      | string    | `"cadastrado"` → `"triado"` → `"em atendimento"` → `"concluído"` |
| `triagem`     | mapa ou null | ver abaixo                                  |
| `criadoEm`    | timestamp | data/hora do cadastro                          |

Campos do mapa `triagem` (o voluntário que atende é definido no AGENDAMENTO,
não na triagem):

| Campo             | Tipo             | Exemplo                                  |
|-------------------|------------------|------------------------------------------|
| `area`            | string           | `"Cirurgia"` (Profilaxia, Periodontia, Dentística, Endodontia, Cirurgia, Prótese, Avaliação, Outro — ver AREAS em semente/app.jsx) |
| `saude`           | array de strings | `["Hipertensão / pressão alta"]` (Hipertensão / pressão alta, Diabetes, Problema cardíaco, Alergia a medicamento, Medicação contínua, Gestante) |
| `outrasCondicoes` | string           | `"Insulina 2x ao dia"`                   |

### `agendamentos/{id}` — agenda por dia e horário
Quem escreve: **Central** (Windows ou app Seja Semente) e também o
**Semeador** (o voluntário pode agendar). Todos leem. A Central mostra a
agenda por dia (estilo Google Agenda), ordenada por `hora`, e pode remover.

| Campo              | Tipo      | Exemplo                                    |
|--------------------|-----------|--------------------------------------------|
| `pacienteId`       | string    | id do doc em `pacientes` (vazio se for evento livre) |
| `pacienteNome`     | string    | `"José da Silva"`                          |
| `titulo`           | string    | `"Extração · Odontologia"` (ou o nome do evento livre) |
| `data`             | string `AAAA-MM-DD` | `"2026-07-25"`                   |
| `hora`             | string `HH:MM` | `"14:00"`                             |
| `local`            | string    | `"Sede Seja Semente"` (opcional)           |
| `profissionalUid`  | string    | uid do voluntário que atende               |
| `profissionalNome` | string    | `"Maria Souza"`                            |
| `responsavel`      | string    | usado nos eventos livres                   |
| `origem`           | string    | `"central"` ou `"semeador"`                |
| `criadoEm`         | timestamp | data/hora da criação                       |

### `central/status` — batimento da Central
Quem escreve: **Central** (o programa Windows e também o app Seja Semente),
a cada 1 minuto enquanto estiver aberta. O Semeador usa isso para mostrar "Central conectada"
ou "Central offline" (considera online se o último batimento tem menos
de 3 minutos).

| Campo          | Tipo      | Exemplo            |
|----------------|-----------|--------------------|
| `online`       | boolean   | `true`             |
| `atualizadoEm` | timestamp | data/hora de agora |

## Como o programa Windows acessa o Firebase

Duas opções, da mais simples à mais robusta:

1. **SDK Admin do Firebase** (recomendado se o programa Windows for em
   Node/Electron ou tiver um serviço em Node ao lado): baixe uma chave de
   conta de serviço no console do Firebase e use `firebase-admin` — acesso
   total, sem regras de segurança no caminho.
2. **API REST do Firestore** (serve para qualquer linguagem — C#, Delphi,
   Python…): `https://firestore.googleapis.com/v1/projects/SEU_PROJETO/databases/(default)/documents/avisos`
   autenticando com a conta de serviço (token OAuth2) ou com um usuário
   do Authentication.

## Contas dos voluntários

Os voluntários entram no aplicativo com a **conta Google** (ou e-mail e
senha, como alternativa) — Firebase Authentication. Ninguém precisa criar
conta para eles: o próprio voluntário entra, preenche o cadastro e a
Central só aprova (fluxo descrito acima em `voluntarios/{uid}`).

No console do Firebase, ative os provedores **Google** e **E-mail/senha**
em Authentication → Sign-in method.

### `pacientes/{id}/arquivos/{id}` — fotos e arquivos da ficha
Quem escreve: o **dentista no Semeador** e a **Central**. Todos os que podem
ver o paciente leem. As fotos são comprimidas no aparelho (~1000px JPEG) e
guardadas como `dataUrl` dentro do documento (limite ~900 KB por foto).

| Campo       | Tipo      | Exemplo                                |
|-------------|-----------|----------------------------------------|
| `dataUrl`   | string    | `data:image/jpeg;base64,...`           |
| `legenda`   | string    | `"Extração do dente 36 concluída"`     |
| `autorUid`  | string    | uid de quem adicionou                  |
| `autorNome` | string    | `"Lucas Andrade"`                      |
| `criadoEm`  | timestamp | data/hora                              |
