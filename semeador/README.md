# 🌱 Semeador — projeto Seja Semente

Aplicativo do **voluntário** do projeto Seja Semente. Ele conversa em tempo
real com a **Central** — o programa Windows instalado na máquina do projeto —
através do Firebase. O contrato de comunicação entre os dois está em
[`PONTE.md`](PONTE.md).

## O que o aplicativo já faz (versão inicial)

- **Avisos**: mural de comunicados publicados pela Central
- **Minhas escalas**: o voluntário vê as escalas em que foi colocado e
  **confirma presença** (a confirmação aparece na hora na Central)
- **Perfil**: dados do voluntário e sair da conta
- **Indicador de conexão**: mostra se a Central (programa Windows) está
  ligada agora, pelo batimento em `central/status`
- **Modo demonstração**: enquanto o Firebase não estiver configurado, o app
  roda sozinho com dados de exemplo — dá pra ver e testar tudo

## Como rodar

```bash
node semeador/build.mjs   # monta o app em dist-semeador/
node semeador/serve.mjs   # abre em http://localhost:8746
```

## Como ligar na Central (Firebase)

1. Crie o projeto **seja-semente** no [console do Firebase](https://console.firebase.google.com)
2. Ative **Authentication** (E-mail/senha) e **Firestore**
3. Adicione um app Web e cole a configuração em [`firebase-config.js`](firebase-config.js)
4. No programa Windows, use o mesmo projeto seguindo o [`PONTE.md`](PONTE.md)

## Próximos passos previstos

- Ícone e identidade visual do Semeador
- Notificações push (aviso novo / escala nova chega como notificação)
- Versão Android/iOS com Capacitor (mesmo caminho usado nos apps do Special)
- Regras de segurança do Firestore para o projeto seja-semente
