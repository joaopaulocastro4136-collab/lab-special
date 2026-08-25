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
Quem escreve: **Central** (Windows ou app Seja Semente) e também o
**Semeador** (o dentista pode fazer/refazer a TRIAGEM pelo aplicativo —
grava os campos `triagem` e `status` do paciente, igual à central). O
Semeador lê todos os pacientes e destaca os designados ao voluntário logado.

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
| `prioridade`  | boolean   | `true` — fura a fila: aparece primeiro e marcado nos "não agendados" |
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
| `dentes`          | array de números FDI | `[11, 21]` — dentes do tratamento marcados no odontograma |
| `gengiva`         | array de números FDI | `[24]` — regiões de gengiva marcadas (pelo dente mais próximo) |
| `semMarcacao`     | boolean          | `true` quando a triagem foi concluída sem marcar dente/gengiva (caso não se aplique) |

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

### `chamadas/{id}` — chamada de paciente ou de staff (toca como ligação)
Quem escreve: **qualquer ponta** (central, Semeador ou o programa Windows).
Enquanto `ativa` for `true` e a chamada tiver menos de 3 minutos, os
aparelhos alvo mostram uma TELA CHEIA estilo ligação (nome e foto pulsando,
com toque e vibração) até alguém tocar em atender — que grava
`ativa: false` e derruba a chamada em todo mundo.

Dois tipos:
- **Paciente** (sem `tipo`): toca em TODOS os aparelhos logados, menos no
  aparelho que chamou (`chamadoPorAparelho`). No Semeador, o botão
  "🔔 Chamar paciente" da ficha só aparece para o voluntário que tem o
  paciente **agendado com ele** (algum `agendamentos` com o
  `profissionalUid` dele); na central não há restrição.
- **Staff** (`tipo: "staff"`): toca SÓ nos aparelhos da conta escolhida
  (`paraUid`) — a tela mostra quem está chamando e o botão "Estou indo".
  Pode ser chamado qualquer um com conta: voluntários ativos
  (`voluntarios`) e usuários da central (`central-usuarios`).

| Campo            | Tipo      | Exemplo                          |
|------------------|-----------|----------------------------------|
| `tipo`           | string    | ausente (paciente) ou `"staff"`  |
| `pacienteId`     | string    | id do doc em `pacientes` (paciente) |
| `pacienteNome`   | string    | `"José da Silva"` (paciente)    |
| `pacienteCodigo` | string    | `"SS-0001"` (paciente)          |
| `pacienteFoto`   | string    | dataUrl/URL da foto (opcional)   |
| `paraUid`        | string    | uid da pessoa chamada (staff)    |
| `paraNome`       | string    | `"Maria Souza"` (staff)         |
| `paraFoto`       | string    | foto mini da pessoa (staff)      |
| `motivo`         | string    | título da chamada de grupo (ex.: `"Almoço na cantina"`) — aparece grande na tela de quem recebe |
| `convocacaoId`   | string    | id do doc em `convocacoes` (quando veio de chamada de grupo) |
| `chamadoPorUid`  | string    | uid de quem chamou               |
| `chamadoPorNome` | string    | `"João Paulo"`                  |
| `chamadoPorFoto` | string    | foto mini de quem chamou (staff) |
| `chamadoPorAparelho` | string | id local do aparelho que chamou |
| `ativa`          | boolean   | `true` enquanto está tocando     |
| `atendidaPorUid` / `atendidaPorNome` / `atendidaEm` | — | preenchidos por quem atendeu |
| `criadoEm`       | timestamp | data/hora da chamada             |

### `aparelhos/{token}` — iPhones registrados para notificação push
Quem escreve: **os apps** (central e Semeador, na versão nativa). O `{token}`
é o token APNs do aparelho. O "carteiro" (Cloud Function `carteiroChamadas`,
pasta `carteiro/`) lê esta coleção quando nasce um doc em `chamadas` e manda
o push: chamada de paciente → todos os aparelhos; `tipo: "staff"` → só os
aparelhos com `uid === paraUid`. O aparelho de quem chamou
(`aparelho === chamadoPorAparelho`) nunca é avisado. Token recusado pela
Apple (app removido) é apagado da coleção pelo próprio carteiro.

| Campo         | Tipo      | Exemplo                              |
|---------------|-----------|--------------------------------------|
| `uid`         | string    | uid do dono logado no app            |
| `nome`        | string    | `"Maria Souza"`                     |
| `app`         | string    | `"central"` ou `"semeador"`         |
| `aparelho`    | string    | o `idAparelho()` local (ss-aparelho) |
| `voipToken`   | string    | token de LIGAÇÃO (CallKit, app 6.10+) — com ele o carteiro faz o iPhone tocar a tela de chamada de verdade; sem ele, cai na notificação comum repetida |
| `atualizadoEm`| timestamp | último registro                      |

### `convocacoes/{id}` — chamadas de GRUPO ("Almoço na cantina")
Quem escreve: **Central**. Uma convocação tem um título e a lista de quem
já foi chamado. Chamar pessoas cria um doc em `chamadas` (tipo `staff`,
com `motivo` = título) para cada uma — o resto (tela de ligação, push)
é o fluxo normal de chamadas. Quem já está em `chamados` não aparece mais
na lista de seleção. A central pode excluir a convocação quando quiser.

| Campo         | Tipo      | Exemplo                                 |
|---------------|-----------|-----------------------------------------|
| `titulo`      | string    | `"Almoço na cantina"`                  |
| `criadaPorUid` / `criadaPorNome` | string | quem criou               |
| `chamados`    | mapa      | `{ uid: { nome, em: timestamp } }`      |
| `criadaEm`    | timestamp | data/hora                               |

### `central-usuarios/{uid}` — quem tem acesso à central
Quem escreve: **Central**. Cada pessoa autorizada a usar a central (app Seja
Semente / programa Windows) tem um doc aqui. O **primeiro** a entrar, quando a
coleção está vazia, vira `papel: "fundador"` automaticamente; os demais só
entram resgatando um código de acesso (viram `papel: "equipe"`).

| Campo      | Tipo      | Exemplo                    |
|------------|-----------|----------------------------|
| `nome`     | string    | `"João Paulo Castro"`      |
| `email`    | string    | `"joao@gmail.com"`         |
| `papel`    | string    | `"fundador"` ou `"equipe"` |
| `criadoEm` | timestamp | data/hora                  |

### `codigos-acesso/{codigo}` — códigos de resgate da central
Quem escreve: **Central** (gera no Perfil). O `{codigo}` é o próprio código
(ex.: `SS-K7P2Q9`). Cada código serve **uma vez**: ao ser resgatado, grava
quem usou. Quem tem o código entra com a conta Google e digita para virar
`equipe`.

| Campo         | Tipo      | Exemplo              |
|---------------|-----------|----------------------|
| `criadoPor`   | string    | uid de quem gerou    |
| `criadoPorNome` | string  | `"João Paulo"`       |
| `usadoPor`    | string ou null | uid de quem resgatou (null se ainda livre) |
| `usadoPorNome`| string    | `"Maria Souza"`      |
| `criadoEm`    | timestamp | data/hora            |
| `usadoEm`     | timestamp | data/hora do resgate |

### `config/procedimentos` — tipos de procedimento e tempos
Quem escreve: **Central** (gerencia tudo) e o **Semeador** (pode adicionar
um tipo novo pelo formulário de triagem). Documento único de configuração.

| Campo            | Tipo                       | Exemplo                          |
|------------------|----------------------------|----------------------------------|
| `personalizados` | array de `{nome, detalhe}` | `[{"nome": "Pediatria"}]`        |
| `duracoes`       | mapa `{nome: minutos}`     | `{"Pediatria": 45, "Cirurgia": 60}` (padrão 30 min) |

Os `agendamentos` gravam também `duracaoMin` (minutos do procedimento no
momento em que foi marcado) — a agenda mostra início–fim e avisa conflito.

## Palmar (aplicativo dos gestores)

O Palmar (https://seja-semente-palmar.web.app) lê tudo dos outros apps e
coordena o projeto. Coleções próprias:

### `palmar-usuarios/{uid}` / `palmar-codigos/{codigo}` / `palmar-autorizados/{email}`
Mesmo esquema de acesso da central: o primeiro a entrar vira `fundador`;
os demais entram com código gerado no Perfil do Palmar (prefixo `PM-`)
ou e-mail pré-autorizado.

### `acoes/{id}` — as ações (mutirões)
| Campo | Tipo | Exemplo |
|---|---|---|
| `titulo` | string | `"Mutirão da Comunidade"` |
| `data` | string | `"2026-08-30"` (AAAA-MM-DD) |
| `local` | string | `"Igreja Central"` |
| `status` | string | `planejada` · `iniciada` · `encerrada` |
| `voluntariosUids` | lista | uids escalados |
| `registros` | lista | atendimentos manuais `{pacienteNome, area, dentes, valor, em}` |
| `criadaPorUid/Nome`, `criadaEm`, `iniciadaEm`, `encerradaEm` | — | |
O relatório em tempo real cruza `atendimentos` (pela data) e
`estoque-movimentos` (pelo `acaoId`).

### `estoque/{id}` e `estoque-movimentos/{id}`
Materiais: `{nome, quantidade, unidade, valor, minimo}` — quando
`quantidade <= minimo` o Palmar alerta "em falta". Cada entrada/saída gera
um movimento `{itemId, itemNome, delta, motivo, acaoId, acaoTitulo,
valorUnit, em}` (histórico e custo por ação).

### `config/procedimentos` (campos novos do Palmar)
`valores: {nome: número}` — valor de cada procedimento em R$;
`porDente: {nome: bool}` — quando true, o valor multiplica pelos dentes
marcados na triagem do paciente. O financeiro soma os `atendimentos`
concluídos por esses valores.
