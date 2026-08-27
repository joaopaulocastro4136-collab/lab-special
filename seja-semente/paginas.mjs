// Páginas soltas que a Apple exige em toda ficha de loja: a política de
// privacidade e o canal de suporte. São escritas dentro de cada pasta dist/
// pelo hospedar.mjs, então ficam no ar em todos os quatro sites.
const APOIO = 'sejasemente.contato@gmail.com';

const molde = (titulo, corpo) => `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo} — Seja Semente</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 28px 20px 60px; font: 16px/1.65 -apple-system, "Segoe UI", Roboto, sans-serif;
         max-width: 720px; margin-inline: auto; background: #fbfaf7; color: #2a2620; }
  @media (prefers-color-scheme: dark) { body { background: #16150f; color: #e9e5da; } }
  h1 { font-size: 26px; margin: 0 0 6px; }
  h2 { font-size: 18px; margin: 28px 0 6px; }
  .data { opacity: .65; font-size: 14px; margin-bottom: 22px; }
  a { color: #2e7d32; }
  li { margin: 4px 0; }
</style>
</head><body>
<h1>${titulo}</h1>
<p class="data">Projeto Seja Semente · atualizado em agosto de 2026</p>
${corpo}
<h2>Falar com a gente</h2>
<p>Escreva para <a href="mailto:${APOIO}">${APOIO}</a>. A gente responde em até 3 dias úteis.</p>
</body></html>`;

export const privacidade = molde('Política de privacidade', `
<p>O Seja Semente é um projeto social de odontologia. Os aplicativos <b>Seja Semente</b>, <b>Semeador</b>, <b>Palmar</b> e <b>Colheita</b> são usados pela equipe do projeto e por quem apoia o projeto. Esta política vale para os quatro.</p>

<h2>O que a gente guarda</h2>
<ul>
  <li><b>De quem usa o aplicativo:</b> nome, e-mail e foto da conta usada para entrar (Google, Apple ou e-mail e senha), e o papel da pessoa no projeto (coordenação, dentista voluntário, gestão ou apoiador).</li>
  <li><b>De quem é atendido:</b> nome, contato, data de nascimento, o que a pessoa relatou sobre a saúde da boca, os dentes marcados na triagem, os procedimentos feitos e as fotos de antes e depois do tratamento — só quando a pessoa autoriza.</li>
  <li><b>Do projeto:</b> agendamentos, materiais do estoque, notas fiscais e os valores das ações.</li>
</ul>

<h2>Para que serve</h2>
<p>Só para atender a pessoa e prestar contas do projeto: montar a agenda do mutirão, registrar o tratamento, controlar o material gasto e mostrar a quem apoia o que foi feito. Nada é usado para publicidade.</p>

<h2>Com quem é dividido</h2>
<p>Com mais ninguém. Os dados ficam no Firebase (Google Cloud), que hospeda o banco para o projeto e não usa esses dados para outra coisa. A gente não vende, não aluga e não passa nada para terceiros.</p>

<h2>Fotos e depoimentos</h2>
<p>As fotos de antes e depois e os depoimentos só aparecem no aplicativo Colheita depois que a pessoa atendida autoriza. Sem autorização, a foto fica apenas na ficha clínica, visível só para a equipe.</p>

<h2>Seus direitos</h2>
<ul>
  <li>Ver, corrigir ou apagar os seus dados a qualquer momento.</li>
  <li><b>Apagar a conta:</b> dentro do aplicativo, em Perfil → Apagar a minha conta. A conta e os dados ligados a ela saem do sistema.</li>
  <li>Retirar a autorização das fotos e do depoimento quando quiser.</li>
</ul>
<p>Para qualquer um desses pedidos, é só escrever para a gente no e-mail abaixo.</p>

<h2>Segurança</h2>
<p>Só entra no sistema quem tem conta aprovada pela coordenação. O acesso é protegido por senha ou pela conta do Google/Apple, e a conversa com o servidor é sempre criptografada.</p>
`);

export const suporte = molde('Suporte', `
<p>Precisa de ajuda com os aplicativos do projeto Seja Semente? Estamos aqui.</p>

<h2>Como entrar</h2>
<p>Na tela inicial dá para entrar com a conta do Google, com a conta da Apple ou criando um e-mail e senha. Depois de entrar, a coordenação do projeto libera o seu acesso — enquanto isso o aplicativo mostra a tela de espera.</p>

<h2>Perguntas comuns</h2>
<ul>
  <li><b>Não consigo entrar.</b> Confira se o acesso já foi liberado pela coordenação. Se você criou a conta agora, avise a gente pelo e-mail abaixo.</li>
  <li><b>O aplicativo abriu vazio.</b> Feche e abra de novo: os aplicativos buscam a versão mais nova ao abrir.</li>
  <li><b>Quero apagar a minha conta.</b> Perfil → Apagar a minha conta, dentro do próprio aplicativo.</li>
  <li><b>Errei um registro de atendimento.</b> Fale com a coordenação: ela corrige pelo Palmar.</li>
</ul>

<h2>Qual aplicativo é qual</h2>
<ul>
  <li><b>Seja Semente</b> — a coordenação: cadastro, triagem, agenda e avisos.</li>
  <li><b>Semeador</b> — o dentista voluntário: agenda do dia, ficha do paciente e registro do que foi feito.</li>
  <li><b>Palmar</b> — a gestão: ações, equipe, relatórios, materiais e notas.</li>
  <li><b>Colheita</b> — quem apoia: os sorrisos devolvidos e a prestação de contas.</li>
</ul>
`);
