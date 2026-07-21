// Aplicativo Mac do Seja Semente (Central): uma janela nativa que abre a
// versão web hospedada no Firebase — mesma base, sempre atualizada.
const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

const URL_CENTRAL = 'https://seja-semente-app.web.app';

function criarJanela() {
  const win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    title: 'Seja Semente',
    backgroundColor: '#F0F2E7',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { contextIsolation: true },
  });

  win.loadURL(URL_CENTRAL);

  // O login do Google abre a página de contas numa janela — deixa abrir dentro
  // do app (mesma sessão) para o retorno cair de volta no Seja Semente.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/accounts\.google\.com|firebaseapp\.com|__\/auth/.test(url)) {
      return { action: 'allow', overrideBrowserWindowOptions: { width: 500, height: 640, title: 'Entrar com Google' } };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(criarJanela);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) criarJanela(); });
