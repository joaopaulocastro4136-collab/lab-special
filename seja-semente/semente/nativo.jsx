// Arranque NATIVO (iPhone) do app central Seja Semente: liga o login Google
// pela tela de contas do próprio aparelho e depois sobe o app normal.
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

// Detecta quando foi a própria pessoa que fechou a tela de contas
function foiCancelado(e) {
  const m = `${e?.code || ''} ${e?.message || e || ''}`.toLowerCase();
  return m.includes('cancel') || m.includes('12501') || m.includes('error -5') || m.includes('popup-closed');
}

// O app chama isto quando existe (só no aplicativo instalado).
// Na primeira abertura o plugin às vezes falha à toa (erro com números);
// por isso o app tenta de novo sozinho, até 3 vezes, antes de desistir.
window.__entrarNativoGoogle = async (auth) => {
  let ultimo = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resultado = await FirebaseAuthentication.signInWithGoogle();
      const idToken = resultado?.credential?.idToken;
      if (!idToken) throw new Error('cancelado');
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken, resultado?.credential?.accessToken || undefined));
      return;
    } catch (e) {
      if (foiCancelado(e)) throw new Error('cancelado');
      ultimo = e;
      await new Promise(r => setTimeout(r, 700));
    }
  }
  throw ultimo || new Error('sem resposta do Google');
};

import './app.jsx';
