import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import { montarCloud } from './cloud-app.jsx';

// ─── Ponte Android: compartilhar e baixar arquivos pelo menu nativo ───
if (Capacitor.isNativePlatform()) {
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

// ─── Auto-atualização: ao abrir, compara a versão instalada com a publicada no site ───
async function verificarAtualizacao() {
  // Só no Android: o aviso baixa um APK — no iPhone/iPad a atualização é pela App Store
  // (aparecer no iOS compara versionCode do APK com o build iOS e ainda viola as regras da Apple)
  if (Capacitor.getPlatform() !== 'android') return;
  try {
    const { App: CapApp } = await import('@capacitor/app');
    const info = await CapApp.getInfo();
    const resp = await fetch('https://laboratorio-special.web.app/versao-apk.json?nc=' + Date.now());
    const remoto = await resp.json();
    if (parseInt(remoto.versionCode, 10) > parseInt(info.build, 10)) {
      mostrarAvisoAtualizacao(remoto);
    }
  } catch (e) { /* sem internet ou arquivo indisponível — tenta na próxima abertura */ }
}

function mostrarAvisoAtualizacao(remoto) {
  const barra = document.createElement('div');
  barra.style.cssText = 'position:fixed;bottom:84px;left:12px;right:12px;z-index:9998;background:#1C1B19;color:#fff;border-radius:16px;padding:14px;font-family:Manrope,-apple-system,sans-serif;box-shadow:0 14px 34px rgba(0,0,0,0.4);display:flex;align-items:center;gap:10px';
  const texto = document.createElement('div');
  texto.style.cssText = 'flex:1;min-width:0';
  texto.innerHTML = '<div style="font-weight:800;font-size:13px;color:#B8935A">✨ Nova atualização disponível</div>'
    + '<div style="font-size:12px;color:#A8A29E;margin-top:2px">Versão ' + remoto.versionName + (remoto.novidades ? ' — ' + remoto.novidades : '') + '</div>';
  const botao = document.createElement('button');
  botao.textContent = 'Baixar';
  botao.style.cssText = 'background:#B8935A;color:#1C1B19;font-weight:800;border:none;border-radius:10px;padding:10px 16px;font-size:13px;flex-shrink:0';
  botao.onclick = () => { window.open(remoto.url, '_blank'); };
  const fechar = document.createElement('button');
  fechar.textContent = '×';
  fechar.style.cssText = 'background:none;border:none;color:#78716C;font-size:20px;padding:0 2px;flex-shrink:0';
  fechar.onclick = () => barra.remove();
  barra.appendChild(texto);
  barra.appendChild(botao);
  barra.appendChild(fechar);
  document.body.appendChild(barra);
}

setTimeout(verificarAtualizacao, 4000);

// Login Google NATIVO (a tela de contas do próprio Android) + repasse ao Firebase web
async function entrarNativo(auth) {
  const resultado = await FirebaseAuthentication.signInWithGoogle();
  const idToken = resultado.credential && resultado.credential.idToken;
  if (!idToken) throw new Error('Login cancelado');
  const credencial = GoogleAuthProvider.credential(idToken);
  await signInWithCredential(auth, credencial);
}

montarCloud(Capacitor.isNativePlatform() ? entrarNativo : null);
