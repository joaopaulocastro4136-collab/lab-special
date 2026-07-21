# Ponte Semeador ↔ Central (programa Windows)

Este documento é o **contrato de comunicação** entre o aplicativo Semeador
(celular do voluntário) e a Central (programa Windows instalado na máquina
do Seja Semente). Os dois lados não se conectam diretamente um ao outro —
eles conversam através do **mesmo banco de dados na nuvem (Firebase /
Firestore)**, em tempo real:

```
  Programa Windows (Central)          Aplicativo Semeador (voluntário)
          │                                      │
          │  escreve avisos, escalas,            │  lê tudo em tempo real,
          │  cadastro de voluntários             │  confirma presença
          ▼                                      ▼
        ┌──────────────────────────────────────────┐
        │        Firebase · projeto seja-semente    │
        │        (Firestore + Authentication)       │
        └──────────────────────────────────────────┘
```

Vantagens desse desenho: funciona de qualquer lugar (não precisa estar na
mesma rede), é em tempo real (o que a Central escreve aparece na hora no
celular), e cada lado pode ser desenvolvido de forma independente — basta
os dois respeitarem este contrato.

> **Importante ao desenvolver o programa Windows:** use o MESMO projeto
> Firebase (`seja-semente`) e siga os nomes de coleções e campos abaixo,
> exatamente como estão escritos.

## Coleções do Firestore

### `voluntarios/{uid}` — cadastro dos voluntários
Quem escreve: **Central**. Quem lê: aplicativo.
O `{uid}` é o ID do usuário no Firebase Authentication.

| Campo        | Tipo      | Exemplo                  |
|--------------|-----------|--------------------------|
| `nome`       | string    | `"Maria Souza"`          |
| `telefone`   | string    | `"(11) 91234-5678"`      |
| `ministerio` | string    | `"Acolhimento"`          |
| `ativo`      | boolean   | `true`                   |

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

### `central/status` — batimento da Central
Quem escreve: **Central**, a cada 1 minuto enquanto o programa Windows
estiver aberto. O aplicativo usa isso para mostrar "Central conectada"
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

Os voluntários entram no aplicativo com **e-mail e senha** (Firebase
Authentication). O fluxo combinado é: a Central cadastra o voluntário
(cria o usuário no Authentication + o documento em `voluntarios/{uid}`)
e informa a senha inicial ao voluntário.
