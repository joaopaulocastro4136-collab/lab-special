// Impressão DIRETA na etiquetadora NIIMBOT (B1 e irmãs) pelo Bluetooth do aparelho.
// Fala o protocolo da máquina (mapeado pelos projetos abertos niimprint/niimbluelib):
//   pacote = 55 55 | comando | tamanho | dados | soma(xor) | AA AA
// Fluxo de impressão: densidade → tipo de rótulo → iniciar → página →
// dimensão → linhas da imagem (0x85) → fim da página → fim da impressão.
import { BleClient } from '@capacitor-community/bluetooth-le';

// A NIIMBOT anuncia o nome começando pela família (B1-…, B21-…, D11-…, etc.)
const PREFIXOS = ['B1', 'B18', 'B21', 'B203', 'B3', 'B32', 'D11', 'D110', 'D101', 'Z401', 'K3', 'M2', 'NIIMBOT'];
const ehNiimbot = (nome) => !!nome && PREFIXOS.some(p => nome.toUpperCase().startsWith(p));

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

// Acha o serviço da NIIMBOT e as características de escrita e de resposta.
// Na B1 podem ser a MESMA característica (notify + write) ou DUAS separadas,
// e a escrita pode ser "sem resposta" ou "com resposta" — trata todos os casos.
// Ignora os serviços padrão do Bluetooth (bateria, informações do aparelho etc.).
const SERVICOS_PADRAO = ['1800', '1801', '180a', '180f', '1804']; // genéricos, não são de impressão
async function acharCanal(deviceId) {
  const servicos = await BleClient.getServices(deviceId);
  const mapa = []; // pra diagnóstico se nada servir
  let melhor = null;
  for (const s of servicos) {
    const suuid = (s.uuid || '').toLowerCase();
    if (suuid.length < 5) continue;
    const curto = suuid.length >= 8 ? suuid.slice(4, 8) : suuid;
    for (const c of (s.characteristics || [])) {
      const p = c.properties || {};
      const podeEscrever = !!(p.writeWithoutResponse || p.write);
      const podeAvisar = !!(p.notify || p.indicate);
      mapa.push(`${curto}/${(c.uuid || '').slice(4, 8)}[${[p.write && 'w', p.writeWithoutResponse && 'W', p.notify && 'n', p.indicate && 'i'].filter(Boolean).join('')}]`);
      if (!podeEscrever) continue;
      const generico = SERVICOS_PADRAO.includes(curto);
      const cand = {
        servico: s.uuid, canal: c.uuid, semResposta: !!p.writeWithoutResponse,
        canalResposta: c.uuid, temNotify: podeAvisar,
        // nota: quanto maior, melhor — canal com escrita+aviso no serviço não-genérico é o ideal
        nota: (generico ? 0 : 10) + (podeAvisar ? 2 : 0) + (p.writeWithoutResponse ? 1 : 0),
      };
      // se a escrita não tem aviso, procura um notify separado no MESMO serviço
      if (!podeAvisar) {
        const notif = (s.characteristics || []).find(o => { const q = o.properties || {}; return q.notify || q.indicate; });
        if (notif) { cand.canalResposta = notif.uuid; cand.temNotify = true; cand.nota += 2; }
      }
      if (!melhor || cand.nota > melhor.nota) melhor = cand;
    }
  }
  if (melhor) return melhor;
  throw new Error('conectou, mas não achei o canal de impressão. Mapa: ' + (mapa.join(' ') || 'nenhum serviço visível').slice(0, 220));
}

// Acha a NIIMBOT sozinha: escaneia por alguns segundos e pega a 1ª cujo nome
// bate com a família da máquina — sem lista de escolha pro usuário.
function acharNiimbotEscaneando(segundos = 6) {
  return new Promise(async (resolve, reject) => {
    let achou = null, parado = false;
    const parar = async () => { if (!parado) { parado = true; try { await BleClient.stopLEScan(); } catch (e) {} } };
    const t = setTimeout(async () => { await parar(); resolve(achou); }, segundos * 1000);
    try {
      await BleClient.requestLEScan({ allowDuplicates: false }, async (r) => {
        const nome = (r.device && r.device.name) || r.localName || '';
        if (!achou && ehNiimbot(nome)) {
          achou = { deviceId: r.device.deviceId, nome };
          clearTimeout(t);
          await parar();
          resolve(achou);
        }
      });
    } catch (e) { clearTimeout(t); await parar(); reject(e); }
  });
}

export async function conectarImpressora() {
  if (aparelho) return aparelho;
  await BleClient.initialize({ androidNeverForLocation: true });

  // 1) tenta achar e conectar sozinha (sem lista)
  let alvo = null;
  try { alvo = await acharNiimbotEscaneando(6); } catch (e) { /* sem permissão de scan — cai pro seletor */ }

  // 2) não achou pelo scan? abre o seletor JÁ FILTRADO só nas NIIMBOT
  if (!alvo) {
    const disp = await BleClient.requestDevice({ namePrefix: 'B' });
    alvo = { deviceId: disp.deviceId, nome: disp.name || 'impressora' };
  }

  await BleClient.connect(alvo.deviceId, () => { aparelho = null; });
  const { servico, canal, semResposta, canalResposta, temNotify } = await acharCanal(alvo.deviceId);
  let temAviso = false;
  if (temNotify) { try { await BleClient.startNotifications(alvo.deviceId, servico, canalResposta, aoReceber); temAviso = true; } catch (e) { /* segue sem aviso */ } }
  aparelho = { deviceId: alvo.deviceId, servico, canal, semResposta, temAviso, nome: alvo.nome };
  return aparelho;
}

const dorme = (ms) => new Promise(r => setTimeout(r, ms));

async function enviar(cmd, dados) {
  const pk = pacote(cmd, dados);
  const dv = new DataView(pk.buffer);
  if (aparelho.semResposta) await BleClient.writeWithoutResponse(aparelho.deviceId, aparelho.servico, aparelho.canal, dv);
  else await BleClient.write(aparelho.deviceId, aparelho.servico, aparelho.canal, dv);
}

// Manda o comando e espera a confirmação da máquina. Se a máquina não estiver
// notificando (sem canal de aviso), não trava: espera um tiquinho e segue.
async function perguntar(cmd, dados, respostaCmd, tentativas = 20) {
  recebidos = [];
  await enviar(cmd, dados);
  if (!aparelho.temAviso) { await dorme(120); return null; }
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
// Cada passo carimba onde estamos, pra mensagem de erro dizer onde travou.
export async function imprimirDireto(canvasEtiqueta) {
  let passo = 'procurar/conectar a impressora';
  try {
    await conectarImpressora();
    passo = 'preparar a impressão';
    return await _imprimir(canvasEtiqueta);
  } catch (e) {
    const detalhe = String((e && e.message) || e);
    throw new Error(`falhou em: ${passo} — ${detalhe}`);
  }
}
async function _imprimir(canvasEtiqueta) {
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
