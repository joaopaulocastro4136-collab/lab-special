// Ponte NATIVA (iPhone) do app central Seja Semente: entrega o login Google
// pela tela de contas do próprio aparelho. Só isso fica gravado dentro do
// aplicativo — o código do app em si é buscado da hospedagem na hora que
// abre (com um plano B embutido para quando estiver sem internet), então as
// novidades publicadas chegam no aplicativo instalado instantaneamente.
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// Detecta quando foi a própria pessoa que fechou a tela de contas
function foiCancelado(e) {
  const m = `${e?.code || ''} ${e?.message || e || ''}`.toLowerCase();
  return m.includes('cancel') || m.includes('12501') || m.includes('error -5') || m.includes('popup-closed');
}

// O app chama isto quando existe (só no aplicativo instalado) e recebe os
// tokens do Google — a entrada no Firebase o próprio app faz, com a versão
// dele da biblioteca (a ponte não carrega Firebase nenhum).
// Na primeira abertura o plugin às vezes falha à toa (erro com números);
// por isso tenta de novo sozinho, até 3 vezes, antes de desistir.
window.__loginGoogleNativo = async () => {
  // Desloga da conta Google anterior ANTES de entrar: assim a tela de
  // contas sempre pergunta qual usar (senão repete a última)
  try { await FirebaseAuthentication.signOut(); } catch (e) { /* sem sessão */ }
  let ultimo = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resultado = await FirebaseAuthentication.signInWithGoogle();
      const idToken = resultado?.credential?.idToken;
      if (!idToken) throw new Error('cancelado');
      return { idToken, accessToken: resultado?.credential?.accessToken || '' };
    } catch (e) {
      if (foiCancelado(e)) throw new Error('cancelado');
      ultimo = e;
      await new Promise(r => setTimeout(r, 700));
    }
  }
  throw ultimo || new Error('sem resposta do Google');
};

// O app chama ao SAIR: encerra também a sessão Google nativa do aparelho
window.__sairNativoGoogle = async () => {
  try { await FirebaseAuthentication.signOut(); } catch (e) { /* sem sessão */ }
};
