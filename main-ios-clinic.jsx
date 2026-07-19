import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';

// ─── Ponte nativa (iPhone): login Google, compartilhar e baixar arquivos ───
if (Capacitor.isNativePlatform()) {
  // Login Google com a tela de contas do próprio aparelho + repasse ao Firebase web
  window.__entrarNativo = async (auth) => {
    const resultado = await FirebaseAuthentication.signInWithGoogle();
    const idToken = resultado.credential && resultado.credential.idToken;
    if (!idToken) throw new Error('Login cancelado');
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  };

  // Login Apple nativo (Face ID) + repasse ao Firebase web
  window.__entrarNativoApple = async (auth) => {
    // skipNativeAuth: o token da Apple só vale uma vez — quem entra no Firebase é a camada web
    const resultado = await FirebaseAuthentication.signInWithApple({ scopes: ['email', 'name'], skipNativeAuth: true });
    const cred = (resultado && resultado.credential) || {};
    if (!cred.idToken) throw new Error('Login cancelado');
    const oauth = new OAuthProvider('apple.com').credential({ idToken: cred.idToken, rawNonce: cred.nonce });
    await signInWithCredential(auth, oauth);
  };

  const bytesParaBase64 = (bytes) => {
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  };

  const compartilharArquivo = async (nome, base64, titulo) => {
    const res = await Filesystem.writeFile({ path: nome, data: base64, directory: Directory.Cache });
    await Share.share({ title: titulo || nome, files: [res.uri] });
  };

  navigator.canShare = () => true;
  navigator.share = async ({ files, title, text, url } = {}) => {
    if (files && files.length) {
      const f = files[0];
      const buf = await f.arrayBuffer();
      await compartilharArquivo(f.name, bytesParaBase64(new Uint8Array(buf)), title);
      return;
    }
    await Share.share({ title, text, url });
  };

  // Botões "Baixar" criam um <a download> e clicam nele — intercepta e abre o compartilhar nativo
  const cliqueOriginal = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    const href = this.href || '';
    if (this.download && href.startsWith('data:')) {
      const nome = this.download;
      const base64 = href.split(',')[1];
      compartilharArquivo(nome, base64, nome).catch(e => console.error('Erro ao compartilhar', e));
      return;
    }
    if (this.download && href.startsWith('blob:')) {
      const nome = this.download;
      fetch(href)
        .then(r => r.arrayBuffer())
        .then(buf => compartilharArquivo(nome, bytesParaBase64(new Uint8Array(buf)), nome))
        .catch(e => console.error('Erro ao compartilhar', e));
      return;
    }
    return cliqueOriginal.call(this);
  };
}

// O app da clínica se monta sozinho ao ser importado (a ponte acima já está no lugar)
import './clinic-app.jsx';
