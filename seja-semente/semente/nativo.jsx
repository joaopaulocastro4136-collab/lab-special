// Arranque NATIVO (iPhone) do app central Seja Semente: liga o login Google
// pela tela de contas do próprio aparelho e depois sobe o app normal.
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { signInWithCredential, GoogleAuthProvider } from 'firebase/auth';

// O app chama isto quando existe (só no aplicativo instalado)
window.__entrarNativoGoogle = async (auth) => {
  const resultado = await FirebaseAuthentication.signInWithGoogle();
  const idToken = resultado.credential && resultado.credential.idToken;
  if (!idToken) throw new Error('Login cancelado');
  await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
};

import './app.jsx';
