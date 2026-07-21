# 🌱 Projeto Seja Semente

Projeto **independente** (não tem relação com o Special Lab / Special
Clinic — está temporariamente neste repositório apenas até ganhar um
repositório próprio; a pasta é autossuficiente e pronta para ser movida).

O projeto tem três pontas, que conversam entre si em tempo real através do
Firebase — o contrato de comunicação está em [`PONTE.md`](PONTE.md):

| Ponta | Onde roda | O que faz |
|-------|-----------|-----------|
| **Programa Windows** | máquina do projeto (em desenvolvimento à parte) | Central: triagem, agendamentos, avisos, gestão |
| **App Seja Semente** (`semente/`) | celular da coordenação | a mesma Central, em versão mobile |
| **App Semeador** (`semeador/`) | celular do voluntário | vê avisos, escalas e agenda; confirma presença; pode agendar |

## Aplicativo Seja Semente (central)

- **Triagem**: cadastro inicial das pessoas acolhidas (nome, idade,
  telefone, necessidade, observações) com status que avança ao toque:
  aguardando → em atendimento → concluída
- **Agenda**: tudo que foi agendado (pela central ou pelos voluntários) e
  criação de novos agendamentos
- **Avisos**: publica comunicados que chegam na hora no Semeador
- **Equipe**: lista dos voluntários cadastrados

## Aplicativo Semeador (voluntário)

- **Avisos**: mural de comunicados da central
- **Escalas**: onde o voluntário foi escalado, com confirmação de presença
- **Agenda**: vê o que está agendado e pode agendar (aparece na central)
- **Perfil** e indicador de "Central conectada / offline"

## Como rodar

```bash
cd seja-semente
npm install

npm run build:semente    # monta o app central em dist-semente/
npm run servir:semente   # abre em http://localhost:8747

npm run build:semeador   # monta o app do voluntário em dist-semeador/
npm run servir:semeador  # abre em http://localhost:8746
```

Enquanto o Firebase não estiver configurado, os dois apps rodam em **modo
demonstração** (dados de exemplo, sem internet) — dá pra ver e testar tudo.

## Como ligar tudo de verdade (Firebase)

1. Crie o projeto **seja-semente** no [console do Firebase](https://console.firebase.google.com)
2. Ative **Authentication** (E-mail/senha) e **Firestore**
3. Adicione um app Web e cole a configuração em [`firebase-config.js`](firebase-config.js)
4. No programa Windows, use o mesmo projeto seguindo o [`PONTE.md`](PONTE.md)

## Próximos passos previstos

- Repositório próprio `seja-semente` (mover esta pasta inteira)
- Ícones e identidade visual dos dois apps
- Regras de segurança do Firestore
- Notificações push (aviso ou agendamento novo chega como notificação)
- Versão Android/iOS com Capacitor
