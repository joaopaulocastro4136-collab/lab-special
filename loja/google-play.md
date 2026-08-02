# Lab Special no Google Play — guia completo

Tudo que precisa pra publicar, dividido entre o que **já está pronto**, o que
**só o gestor pode fazer**, e os **textos prontos pra copiar e colar**.

---

## ✅ Já está pronto (técnica)

| Item | Situação |
|---|---|
| Pacote assinado no formato do Play (.aab) | Fábrica **"AAB → Google Play"** na aba Actions — o arquivo sai como artefato pra baixar |
| Assinatura (chave de upload) | Keystore do cofre (`cofre/lab-ci.keystore.enc`) — a mesma do APK do site |
| targetSdk | 36 (exigência atual do Play é 34+) ✓ |
| applicationId | `com.laboratorio.special` |
| Política de privacidade | https://laboratorio-special.web.app/privacidade.html |
| Página de suporte | https://laboratorio-special.web.app/suporte.html |
| Exclusão de conta (exigência do Play) | https://laboratorio-special.web.app/excluir-conta.html |
| Ícone 512×512 | `dist-web/icone-512.png` |
| Arte de destaque 1024×500 | `loja/feature-graphic.png` |

## 👤 Só o gestor pode fazer

1. **Criar a conta de desenvolvedor** em https://play.google.com/console
   — taxa única de US$ 25 (cartão).
   - **Recomendado: conta de ORGANIZAÇÃO (CNPJ do laboratório)** — conta pessoal
     nova é obrigada a fazer teste fechado com 12+ testadores por 14 dias antes
     de publicar; conta de organização não tem essa exigência.
   - A verificação de organização pede CNPJ, site (use o do lab) e e-mail corporativo.
2. **Criar o app** no Console: "Criar app" → nome **Lab Special** → App → Gratuito.
3. **Subir o .aab**: aba Actions do GitHub → "AAB → Google Play" → Run workflow →
   baixar o artefato `LabSpecial-aab` → Play Console → Produção (ou Teste interno
   primeiro) → Criar versão → soltar o arquivo.
4. **Tirar 4–6 capturas de tela** do app no celular (tela inicial, agenda do dia,
   um trabalho aberto, Entregas). Sem dados reais de pacientes — usar casos de
   exemplo. Enviar aqui no chat se quiser que eu confira antes.
5. Depois do 1º envio: **copiar as SHAs da chave de assinatura do app**
   (Play Console → Configurações → Assinatura de apps) e me avisar — elas
   precisam entrar no Firebase, senão o "Entrar com Google" não funciona no app
   baixado da loja.

## 📝 Ficha da loja (copiar e colar)

**Nome do app (máx. 30):** `Lab Special`

**Descrição curta (máx. 80):**
`Gestão do laboratório de prótese: casos, prazos, entregas, equipe e finanças.`

**Descrição completa (máx. 4000):**
```
O Lab Special é o aplicativo de gestão do laboratório de prótese dental: os
trabalhos do dia, os prazos, as entregas e o financeiro — tudo em um lugar,
feito pra rotina real da bancada.

PRINCIPAIS RECURSOS

• Casos e etapas — cada trabalho com suas etapas de produção, cronômetro e
  registro de quem executou. Etiquetas com QR para identificar os trabalhos.

• Agenda do dia — o que precisa sair hoje e amanhã, organizado por pessoa da
  equipe, com a carga de horas de cada um.

• Provas e entregas — controle do que está na clínica, do que volta e do que
  está pronto para entrega, com endereço e rota.

• Conexão com o dentista — o dentista acompanha os trabalhos pelo aplicativo
  Special Clinic, recebe avisos de produção e aprova arquivos.

• Equipe e comissões — comissões calculadas por quem fez cada etapa, relatório
  de produção e tempos médios reais.

• Finanças — valores por trabalho, fechamento do mês, extrato por dentista em
  PDF e contas a receber.

• Relatórios em PDF — ficha do trabalho em A4, relatório de trabalhos por
  cliente e extrato mensal, prontos para imprimir ou mandar no WhatsApp.

Feito por quem vive um laboratório de prótese, para laboratórios de prótese.
```

**Categoria:** Negócios (ou Produtividade)
**E-mail de contato:** laboratoriospecial01@gmail.com
**Site:** https://labspecial.web.app
**Política de privacidade:** https://laboratorio-special.web.app/privacidade.html

## 🔒 Formulário "Segurança dos dados" (respostas)

- **Coleta dados?** Sim.
- **Dados coletados:**
  - *Informações pessoais → Nome e E-mail*: coletados; obrigatórios para login;
    associados ao usuário; NÃO compartilhados; finalidade: gerenciamento da conta.
  - *Fotos e vídeos → Fotos*: coletadas (anexos de trabalhos que o usuário envia);
    associadas; NÃO compartilhadas; finalidade: funcionalidade do app.
  - *Arquivos e documentos*: coletados (PDF/arquivos anexados); mesmo tratamento.
- **Dados compartilhados com terceiros?** Não. (Firebase/Google atua como
  operador do próprio app, não é "compartilhamento" na definição do formulário.)
- **Criptografia em trânsito?** Sim (HTTPS).
- **Dá pra pedir exclusão?** Sim — URL: https://laboratorio-special.web.app/excluir-conta.html
- **Coleta de localização, contatos, mensagens, histórico?** Não.

## 🎯 Classificação de conteúdo (IARC) — respostas

App utilitário/negócios. Responder **NÃO** para tudo: violência, sexo, drogas,
apostas, linguagem imprópria, compartilhamento de localização com terceiros,
compras digitais não gerenciadas pelo Play, conteúdo gerado por usuários
visível publicamente (os anexos são privados do laboratório/dentista).
Resultado esperado: **Livre (L)**.

## 🎯 Público-alvo

- Faixa etária: **18+** (ferramenta profissional).
- App NÃO é voltado a crianças.

## ⚠️ Notas importantes

1. **Permissões**: câmera (fotos dos trabalhos e leitura de QR), Bluetooth
   (impressora térmica de etiquetas NIIMBOT), notificações. Nenhuma exige
   declaração especial no Play.
2. **App do site continua**: quem instalou o APK pelo site continua atualizando
   pelo site normalmente — a assinatura de DISTRIBUIÇÃO do Play é outra, então
   pra migrar do APK do site pro app da loja é preciso desinstalar e instalar
   uma vez (avisaremos no aviso de atualização quando a loja estiver no ar).
3. **Special Clinic** (o app do dentista) pode entrar na loja depois pelo mesmo
   processo — um app por vez simplifica a verificação inicial.
