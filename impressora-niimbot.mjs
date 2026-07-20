// Impressão DIRETA na etiquetadora NIIMBOT (B1 e irmãs) pelo Bluetooth do aparelho.
// Fala o protocolo da máquina (mapeado pelos projetos abertos niimprint/niimbluelib):
//   pacote = 55 55 | comando | tamanho | dados | soma(xor) | AA AA
// Fluxo de impressão: densidade → tipo de rótulo → iniciar → página →
// dimensão → linhas da imagem (0x85) → fim da página → fim da impressão.
import { BleClient } from '@capacitor-community/bluetooth-le';

const CMD = {
  DENSIDADE: 0x21, TIPO_ROTULO: 0x23, INICIAR: 0x01, FIM: 0xf3,
  PAGINA: 0x03, FIM_PAGINA: 0xe3, DIMENSAO: 0x13, LINHA: 0x85, STATUS: 0xa3,
};

const pacote = (cmd, dados) => {
  const d = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
  let soma = cmd ^ d.length;
  for (const b of d) soma ^= b;
  return new Uint8Array([0x55, 0x55, cmd, d.length, ...d, soma, 0xaa, 0xaa]);
};

let aparelho = null;   // { deviceId, servico, canal }
let recebidos = [];    // pacotes de resposta acumulados

function aoReceber(valor) {
  const b = new Uint8Array(valor.buffer, valor.byteOffset, valor.byteLength);
  // resposta também no formato 55 55 cmd len dados soma aa aa (pode vir emendada)
  for (let i = 0; i + 6 < b.length; i++) {
    if (b[i] === 0x55 && b[i + 1] === 0x55) {
      const len = b[i + 3];
      if (i + 7 + len <= b.length) recebidos.push({ cmd: b[i + 2], dados: b.slice(i + 4, i + 4 + len) });
    }
  }
}

async function acharCanal(deviceId) {
  const servicos = await BleClient.getServices(deviceId);
  for (const s of servicos) {
    if ((s.uuid || '').length < 5) continue;
    for (const c of (s.characteristics || [])) {
      const p = c.properties || {};
      if (p.notify && p.writeWithoutResponse) return { servico: s.uuid, canal: c.uuid };
    }
  }
  throw new Error('Não achei o canal de impressão no aparelho conectado.');
}

export async function conectarImpressora() {
  if (aparelho) return aparelho;
  await BleClient.initialize({ androidNeverForLocation: true });
  const disp = await BleClient.requestDevice({});
  await BleClient.connect(disp.deviceId, () => { aparelho = null; });
  const { servico, canal } = await acharCanal(disp.deviceId);
  await BleClient.startNotifications(disp.deviceId, servico, canal, aoReceber);
  aparelho = { deviceId: disp.deviceId, servico, canal, nome: disp.name || 'impressora' };
  return aparelho;
}

const dorme = (ms) => new Promise(r => setTimeout(r, ms));

async function enviar(cmd, dados) {
  const pk = pacote(cmd, dados);
  await BleClient.writeWithoutResponse(aparelho.deviceId, aparelho.servico, aparelho.canal,
    new DataView(pk.buffer));
}

async function perguntar(cmd, dados, respostaCmd, tentativas = 25) {
  recebidos = [];
  await enviar(cmd, dados);
  for (let i = 0; i < tentativas; i++) {
    const r = recebidos.find(p => p.cmd === respostaCmd);
    if (r) return r;
    await dorme(120);
  }
  return null;
}

// Converte o canvas da etiqueta (fundo branco, tinta preta) nos bits da máquina:
// largura 384 pontos (48 mm na cabeça), 1 bit por ponto, "1" = preto.
function canvasParaLinhas(canvas) {
  const L = 384, A = 240;
  const c = document.createElement('canvas'); c.width = L; c.height = A;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, L, A);
  x.drawImage(canvas, 0, 0, L, A);
  const img = x.getImageData(0, 0, L, A).data;
  const linhas = [];
  for (let y = 0; y < A; y++) {
    const linha = new Uint8Array(L / 8);
    for (let px = 0; px < L; px++) {
      const i = (y * L + px) * 4;
      const claro = (img[i] + img[i + 1] + img[i + 2]) / 3;
      if (claro < 128) linha[px >> 3] |= (0x80 >> (px & 7));
    }
    linhas.push(linha);
  }
  return { linhas, largura: L, altura: A };
}

// Imprime o canvas da etiqueta. Conecta se ainda não estiver conectada.
export async function imprimirDireto(canvasEtiqueta) {
  await conectarImpressora();
  const { linhas, largura, altura } = canvasParaLinhas(canvasEtiqueta);

  await perguntar(CMD.DENSIDADE, [3], CMD.DENSIDADE + 1);
  await perguntar(CMD.TIPO_ROTULO, [1], CMD.TIPO_ROTULO + 1);
  await perguntar(CMD.INICIAR, [1], CMD.INICIAR + 1);
  await perguntar(CMD.PAGINA, [1], CMD.PAGINA + 1);
  await perguntar(CMD.DIMENSAO, [altura >> 8, altura & 0xff, largura >> 8, largura & 0xff], CMD.DIMENSAO + 1);

  for (let y = 0; y < linhas.length; y++) {
    await enviar(CMD.LINHA, new Uint8Array([y >> 8, y & 0xff, 0, 0, 0, 1, ...linhas[y]]));
    if (y % 40 === 39) await dorme(60); // respiro pra fila do Bluetooth não engasgar
  }

  await perguntar(CMD.FIM_PAGINA, [1], CMD.FIM_PAGINA + 1);
  await dorme(400);
  // encerra — a máquina só aceita quando terminou de imprimir
  for (let i = 0; i < 30; i++) {
    const ok = await perguntar(CMD.FIM, [1], CMD.FIM + 1, 8);
    if (ok && ok.dados[0]) return true;
    await dorme(200);
  }
  return true;
}

export function impressoraConectada() { return aparelho ? aparelho.nome : null; }
export async function desconectarImpressora() {
  if (!aparelho) return;
  try { await BleClient.disconnect(aparelho.deviceId); } catch (e) { /* já caiu */ }
  aparelho = null;
}
