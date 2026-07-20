// Gera as fotos de loja (App Store) dos dois apps: celular desenhado com a tela
// do app dentro, fundo bonito e frase de destaque — 1290×2796 (iPhone 6,9").
// Saída: fotos-loja/lab-1.png ... lab-5.png e clinic-1.png ... clinic-5.png
import { chromium } from 'playwright-core';
import { mkdirSync } from 'fs';

const INK = '#1C1B19', GOLD = '#B8935A', PAPER = '#F5F4F0', CARD = '#FFFFFF', BORDA = '#E7E5E4', TXT = '#44403C', MUTED = '#A8A29E';

// ── peças de interface reutilizáveis (mock fiel do visual dos apps) ──
const chip = (t, cor, fundo) => `<span style="background:${fundo};color:${cor};font-weight:800;font-size:26px;padding:8px 22px;border-radius:999px">${t}</span>`;
const CH = {
  prod: chip('EM PRODUÇÃO', '#8A6D3B', '#F3E8D7'),
  pronto: chip('PRONTO', '#2F6B3A', '#DFF0E2'),
  prova: chip('NA CLÍNICA', '#7A4FA3', '#EFE4F8'),
  entregue: chip('ENTREGUE', '#5B5751', '#ECEAE7'),
};
const cartaoCaso = (paciente, dentista, tipo, chipHtml, prazo, pct) => `
  <div style="background:${CARD};border:2px solid ${BORDA};border-radius:28px;padding:30px 32px;margin-bottom:24px;box-shadow:0 14px 34px -26px rgba(28,27,25,.35)">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div style="font-weight:800;font-size:34px;color:${INK}">${paciente}</div>${chipHtml}
    </div>
    <div style="color:${MUTED};font-size:27px;margin-top:8px">${tipo} · ${dentista}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:20px">
      <div style="flex:1;height:12px;background:#EDEBE7;border-radius:999px;margin-right:24px"><div style="width:${pct}%;height:12px;background:${GOLD};border-radius:999px"></div></div>
      <div style="color:${TXT};font-weight:700;font-size:26px">${prazo}</div>
    </div>
  </div>`;
const etapa = (nome, feita, ativa) => `
  <div style="display:flex;align-items:center;gap:22px;padding:22px 0;border-bottom:2px solid #EFEDEA">
    <div style="width:44px;height:44px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:26px;font-weight:900;
      ${feita ? `background:${GOLD};color:${INK}` : ativa ? `border:4px solid ${GOLD};color:${GOLD}` : `border:3px solid ${BORDA};color:${MUTED}`}">${feita ? '✓' : ''}</div>
    <div style="font-size:30px;font-weight:${feita || ativa ? 800 : 600};color:${feita || ativa ? INK : MUTED}">${nome}</div>
    ${ativa ? `<div style="margin-left:auto;color:${GOLD};font-weight:800;font-size:24px">EM ANDAMENTO</div>` : ''}
  </div>`;
const cab = (marca) => `
  <div style="background:${INK};padding:44px 40px 30px;display:flex;align-items:center;justify-content:space-between">
    <div><div style="color:${GOLD};letter-spacing:6px;font-size:22px;font-weight:800">✦ SPECIAL</div>
    <div style="color:#fff;font-size:34px;font-weight:800;margin-top:2px">${marca}</div></div>
    <div style="width:64px;height:64px;border-radius:999px;background:#2E2B27;border:2px solid ${GOLD};display:flex;align-items:center;justify-content:center;color:${GOLD};font-size:26px;font-weight:800">JP</div>
  </div>`;
const abas = (itens, ativa) => `
  <div style="position:absolute;left:0;right:0;bottom:0;background:#fff;border-top:2px solid ${BORDA};display:flex;padding:22px 10px 34px">
    ${itens.map((t, i) => `<div style="flex:1;text-align:center;font-size:24px;font-weight:800;color:${i === ativa ? GOLD : MUTED}">${t[0]}<div style="font-size:21px;margin-top:4px">${t[1]}</div></div>`).join('')}
  </div>`;

// ── telas do LAB ──
const telasLab = {
  1: {
    frase: 'Toda a produção do<br>laboratório na sua mão',
    tela: `${cab('LAB')}<div style="padding:34px 30px 0">
      <div style="display:flex;gap:18px;margin-bottom:28px">
        <div style="flex:1;background:${CARD};border:2px solid ${BORDA};border-radius:24px;padding:22px;text-align:center"><div style="font-size:46px;font-weight:900;color:${INK}">14</div><div style="font-size:23px;color:${MUTED};font-weight:700">EM PRODUÇÃO</div></div>
        <div style="flex:1;background:${CARD};border:2px solid ${BORDA};border-radius:24px;padding:22px;text-align:center"><div style="font-size:46px;font-weight:900;color:#2F6B3A">5</div><div style="font-size:23px;color:${MUTED};font-weight:700">PRONTOS</div></div>
        <div style="flex:1;background:${CARD};border:2px solid ${BORDA};border-radius:24px;padding:22px;text-align:center"><div style="font-size:46px;font-weight:900;color:${GOLD}">3</div><div style="font-size:23px;color:${MUTED};font-weight:700">HOJE</div></div>
      </div>
      ${cartaoCaso('Maria Fernandes', 'Dra. Ana Ribeiro', 'Coroa E.max', CH.prod, 'qua, 22', 62)}
      ${cartaoCaso('Carlos Eduardo', 'Dr. Pedro Matos', 'Protocolo superior', CH.prova, 'sex, 24', 45)}
      ${cartaoCaso('Luana Prado', 'Dra. Ana Ribeiro', 'Faceta ×6', CH.pronto, 'amanhã', 100)}
      ${cartaoCaso('José Airton', 'Dr. Hugo Sales', 'Ponte fixa 3 el.', CH.prod, 'seg, 27', 20)}
      ${cartaoCaso('Beatriz Lima', 'Dra. Carla Souza', 'Placa miorrelaxante', CH.prod, 'ter, 28', 35)}
      ${cartaoCaso('Rafael Nunes', 'Dr. Pedro Matos', 'Coroa sobre implante', CH.entregue, 'entregue', 100)}
    </div>${abas([['📋', 'Trabalhos'], ['📅', 'Datas'], ['➕', 'Novo'], ['💰', 'Finanças'], ['⚙️', 'Ajustes']], 0)}`,
  },
  2: {
    frase: 'Etapas, prazos e equipe<br>sob controle',
    tela: `${cab('LAB')}<div style="padding:34px 36px 0">
      <div style="font-size:40px;font-weight:900;color:${INK}">Maria Fernandes</div>
      <div style="color:${MUTED};font-size:28px;margin:6px 0 26px">Coroa E.max · Dra. Ana Ribeiro</div>
      <div style="background:${CARD};border:2px solid ${BORDA};border-radius:28px;padding:14px 32px 6px">
        ${etapa('Modelo digital', true)}${etapa('Enceramento', true)}${etapa('Prensagem', false, true)}${etapa('Maquiagem e glaze', false)}${etapa('Controle de qualidade', false)}
      </div>
      <div style="display:flex;gap:20px;margin-top:28px">
        <div style="flex:1;background:${INK};color:#fff;border-radius:22px;padding:26px;text-align:center;font-weight:800;font-size:29px">▶ Iniciar etapa</div>
        <div style="flex:1;background:#fff;border:3px solid ${GOLD};color:${GOLD};border-radius:22px;padding:26px;text-align:center;font-weight:800;font-size:29px">Pedir aprovação</div>
      </div></div>${abas([['📋', 'Trabalhos'], ['📅', 'Datas'], ['➕', 'Novo'], ['💰', 'Finanças'], ['⚙️', 'Ajustes']], 0)}`,
  },
  3: {
    frase: 'Agenda de entregas<br>sem surpresas',
    tela: `${cab('LAB')}<div style="padding:34px 36px 0">
      <div style="font-size:36px;font-weight:900;color:${INK};margin-bottom:22px">Julho de 2026</div>
      <div style="background:${CARD};border:2px solid ${BORDA};border-radius:28px;padding:28px">
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;text-align:center;color:${MUTED};font-weight:800;font-size:23px">${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(d => `<div>${d}</div>`).join('')}</div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:10px;text-align:center;margin-top:14px;font-size:27px;font-weight:700;color:${TXT}">
          ${Array.from({ length: 28 }, (_, i) => { const d = i + 1; const marca = [3, 8, 14, 17, 22, 24].includes(d); const hoje = d === 20; return `<div style="padding:16px 0;border-radius:16px;${hoje ? `background:${INK};color:#fff;font-weight:900` : marca ? `background:#F3E8D7;color:#8A6D3B;font-weight:900` : ''}">${d}</div>`; }).join('')}
        </div></div>
      <div style="margin-top:26px">${cartaoCaso('Luana Prado', 'Dra. Ana Ribeiro', 'Faceta ×6 · entrega', CH.pronto, 'hoje', 100)}
      ${cartaoCaso('Rafael Nunes', 'Dr. Pedro Matos', 'Coroa impl. · prova', CH.prova, 'hoje', 70)}</div>
      </div>${abas([['📋', 'Trabalhos'], ['📅', 'Datas'], ['➕', 'Novo'], ['💰', 'Finanças'], ['⚙️', 'Ajustes']], 1)}`,
  },
  4: {
    frase: 'Financeiro e comissões<br>calculados sozinhos',
    tela: `${cab('LAB')}<div style="padding:34px 36px 0">
      <div style="background:${INK};border-radius:30px;padding:36px;color:#fff;margin-bottom:26px">
        <div style="font-size:26px;color:${MUTED};font-weight:700">FECHAMENTO DE JULHO</div>
        <div style="font-size:64px;font-weight:900;color:${GOLD};margin-top:6px">R$ 38.450</div>
        <div style="display:flex;gap:34px;margin-top:18px;font-size:26px"><div>✓ 47 entregues</div><div>⏳ 12 a receber</div></div>
      </div>
      <div style="font-size:32px;font-weight:900;color:${INK};margin-bottom:18px">Comissões da equipe</div>
      ${[['Rodrigo (cerâmica)', 'R$ 2.140'], ['Paula (CAD/CAM)', 'R$ 1.860'], ['Marcos (acabamento)', 'R$ 1.395']].map(([n, v]) => `
        <div style="background:${CARD};border:2px solid ${BORDA};border-radius:24px;padding:28px 32px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:30px;font-weight:700;color:${TXT}">${n}</div><div style="font-size:32px;font-weight:900;color:${INK}">${v}</div></div>`).join('')}
      </div>${abas([['📋', 'Trabalhos'], ['📅', 'Datas'], ['➕', 'Novo'], ['💰', 'Finanças'], ['⚙️', 'Ajustes']], 3)}`,
  },
  5: {
    frase: 'Aviso na hora, no celular<br>de quem importa',
    tela: `${cab('LAB')}<div style="padding:34px 30px 0">
      <div style="background:#fff;border-radius:26px;border:2px solid ${BORDA};padding:26px 30px;margin-bottom:22px;box-shadow:0 18px 40px -24px rgba(28,27,25,.45)">
        <div style="display:flex;gap:18px;align-items:center"><div style="width:56px;height:56px;border-radius:14px;background:${INK};display:flex;align-items:center;justify-content:center;color:${GOLD};font-size:30px">✦</div>
        <div><div style="font-weight:900;font-size:27px;color:${INK}">Special Clinic</div><div style="color:${MUTED};font-size:23px">agora</div></div></div>
        <div style="font-size:28px;color:${TXT};margin-top:14px"><b>Aprovação solicitada 👍</b> — prova da coroa da paciente Maria pronta para sua avaliação.</div>
      </div>
      <div style="background:#fff;border-radius:26px;border:2px solid ${BORDA};padding:26px 30px;margin-bottom:30px">
        <div style="display:flex;gap:18px;align-items:center"><div style="width:56px;height:56px;border-radius:14px;background:${INK};display:flex;align-items:center;justify-content:center;color:${GOLD};font-size:30px">✦</div>
        <div><div style="font-weight:900;font-size:27px;color:${INK}">Lab Special</div><div style="color:${MUTED};font-size:23px">há 2 min</div></div></div>
        <div style="font-size:28px;color:${TXT};margin-top:14px"><b>Novo pedido</b> — Dr. Pedro enviou um caso com 4 fotos.</div>
      </div>
      ${cartaoCaso('Rafael Nunes', 'Dr. Pedro Matos', 'Coroa sobre implante', CH.prova, 'sex, 24', 70)}
      ${cartaoCaso('Beatriz Lima', 'Dra. Carla Souza', 'Placa miorrelaxante', CH.prod, 'ter, 28', 35)}
      </div>${abas([['📋', 'Trabalhos'], ['📅', 'Datas'], ['➕', 'Novo'], ['💰', 'Finanças'], ['⚙️', 'Ajustes']], 0)}`,
  },
};

// ── telas da CLINIC ──
const telasClinic = {
  1: {
    frase: 'Seus trabalhos no<br>laboratório, em tempo real',
    tela: `${cab('CLINIC')}<div style="padding:34px 30px 0">
      <div style="font-size:34px;font-weight:900;color:${INK};margin-bottom:22px">Olá, Dra. Ana 👋</div>
      ${cartaoCaso('Maria Fernandes', 'entrega qua, 22', 'Coroa E.max', CH.prod, '62%', 62)}
      ${cartaoCaso('Luana Prado', 'pronta para entrega', 'Faceta ×6', CH.pronto, '100%', 100)}
      ${cartaoCaso('José Airton', 'aguardando sua prova', 'Ponte fixa 3 elementos', CH.prova, '70%', 70)}
      ${cartaoCaso('Beatriz Lima', 'entrega ter, 28', 'Placa miorrelaxante', CH.prod, '35%', 35)}
      ${cartaoCaso('Carlos Eduardo', 'entregue em 10/07', 'Protocolo superior', CH.entregue, '100%', 100)}
      </div>${abas([['🦷', 'Trabalhos'], ['➕', 'Novo pedido'], ['💰', 'Financeiro'], ['✨', 'IA Special']], 0)}`,
  },
  2: {
    frase: 'Envie casos com fotos<br>direto do consultório',
    tela: `${cab('CLINIC')}<div style="padding:34px 36px 0">
      <div style="font-size:36px;font-weight:900;color:${INK};margin-bottom:24px">Novo pedido</div>
      <div style="background:${CARD};border:2px solid ${BORDA};border-radius:28px;padding:32px">
        <div style="font-size:25px;font-weight:800;color:${MUTED}">PACIENTE</div>
        <div style="font-size:32px;font-weight:800;color:${INK};border-bottom:3px solid ${GOLD};padding:10px 0 14px">Carlos Eduardo</div>
        <div style="font-size:25px;font-weight:800;color:${MUTED};margin-top:26px">TRABALHO</div>
        <div style="font-size:32px;font-weight:800;color:${INK};padding:10px 0 14px;border-bottom:2px solid ${BORDA}">Protocolo superior ▾</div>
        <div style="font-size:25px;font-weight:800;color:${MUTED};margin:26px 0 16px">FOTOS E ARQUIVOS</div>
        <div style="display:flex;gap:16px">
          <div style="width:150px;height:150px;border-radius:20px;background:linear-gradient(135deg,#D9CDBA,#B8A88C);display:flex;align-items:center;justify-content:center;font-size:44px">📷</div>
          <div style="width:150px;height:150px;border-radius:20px;background:linear-gradient(135deg,#CBD5CE,#9FB3A6);display:flex;align-items:center;justify-content:center;font-size:44px">📷</div>
          <div style="width:150px;height:150px;border-radius:20px;background:#F0EEE9;border:3px dashed ${GOLD};display:flex;align-items:center;justify-content:center;font-size:52px;color:${GOLD}">＋</div>
        </div></div>
      <div style="background:${GOLD};color:${INK};border-radius:24px;padding:30px;text-align:center;font-weight:900;font-size:32px;margin-top:30px">Enviar ao laboratório</div>
      </div>${abas([['🦷', 'Trabalhos'], ['➕', 'Novo pedido'], ['💰', 'Financeiro'], ['✨', 'IA Special']], 1)}`,
  },
  3: {
    frase: 'Aprove provas<br>com um toque',
    tela: `${cab('CLINIC')}<div style="padding:34px 36px 0">
      <div style="font-size:36px;font-weight:900;color:${INK}">Maria Fernandes</div>
      <div style="color:${MUTED};font-size:27px;margin:6px 0 24px">Coroa E.max · prova enviada pelo laboratório</div>
      <div style="border-radius:30px;overflow:hidden;border:2px solid ${BORDA};height:560px;background:linear-gradient(160deg,#E8E0D2,#C9BCA4);display:flex;align-items:center;justify-content:center;font-size:120px">🦷</div>
      <div style="display:flex;gap:20px;margin-top:30px">
        <div style="flex:1;background:#2F6B3A;color:#fff;border-radius:24px;padding:30px;text-align:center;font-weight:900;font-size:31px">✓ Aprovar</div>
        <div style="flex:1;background:#fff;border:3px solid ${BORDA};color:${TXT};border-radius:24px;padding:30px;text-align:center;font-weight:800;font-size:31px">Pedir ajuste</div>
      </div>
      <div style="background:#DFF0E2;border-radius:22px;padding:24px 28px;margin-top:26px;color:#2F6B3A;font-weight:700;font-size:27px">O laboratório recebe sua resposta na hora e segue a produção.</div>
      </div>${abas([['🦷', 'Trabalhos'], ['➕', 'Novo pedido'], ['💰', 'Financeiro'], ['✨', 'IA Special']], 0)}`,
  },
  4: {
    frase: 'Financeiro transparente,<br>pagamento por Pix',
    tela: `${cab('CLINIC')}<div style="padding:34px 36px 0">
      <div style="background:${INK};border-radius:30px;padding:36px;color:#fff;margin-bottom:26px">
        <div style="font-size:26px;color:${MUTED};font-weight:700">SALDO COM O LABORATÓRIO</div>
        <div style="font-size:64px;font-weight:900;color:${GOLD};margin-top:6px">R$ 4.320</div>
        <div style="margin-top:20px;background:${GOLD};color:${INK};border-radius:18px;padding:22px;text-align:center;font-weight:900;font-size:29px">Pagar com Pix</div>
      </div>
      ${[['Faceta ×6 · Luana', 'R$ 1.980', CH.pronto], ['Coroa E.max · Maria', 'R$ 890', CH.prod], ['Protocolo · Carlos', 'R$ 1.450', CH.prod]].map(([n, v, c]) => `
        <div style="background:${CARD};border:2px solid ${BORDA};border-radius:24px;padding:26px 30px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center">
          <div><div style="font-size:29px;font-weight:800;color:${INK}">${n}</div><div style="margin-top:10px">${c}</div></div>
          <div style="font-size:32px;font-weight:900;color:${INK}">${v}</div></div>`).join('')}
      </div>${abas([['🦷', 'Trabalhos'], ['➕', 'Novo pedido'], ['💰', 'Financeiro'], ['✨', 'IA Special']], 2)}`,
  },
  5: {
    frase: 'IA Special: mostre o novo<br>sorriso antes de começar',
    tela: `${cab('CLINIC')}<div style="padding:34px 36px 0">
      <div style="font-size:36px;font-weight:900;color:${INK};margin-bottom:22px">IA Special ✨</div>
      <div style="display:flex;gap:20px">
        <div style="flex:1"><div style="border-radius:26px;height:460px;background:linear-gradient(160deg,#D8CFC0,#B3A78F);display:flex;align-items:center;justify-content:center;font-size:90px">🙂</div><div style="text-align:center;color:${MUTED};font-weight:800;font-size:25px;margin-top:12px">ANTES</div></div>
        <div style="flex:1"><div style="border-radius:26px;height:460px;background:linear-gradient(160deg,#F1E7D4,#D9C49B);display:flex;align-items:center;justify-content:center;font-size:90px;border:4px solid ${GOLD}">😁</div><div style="text-align:center;color:${GOLD};font-weight:900;font-size:25px;margin-top:12px">DEPOIS</div></div>
      </div>
      <div style="background:${CARD};border:2px solid ${BORDA};border-radius:26px;padding:30px;margin-top:28px;font-size:28px;color:${TXT}">Simulação gerada por IA a partir da foto do paciente — perfeita para apresentar o plano de tratamento.</div>
      <div style="background:${INK};color:${GOLD};border-radius:24px;padding:30px;text-align:center;font-weight:900;font-size:31px;margin-top:26px">✨ Simular sorriso</div>
      </div>${abas([['🦷', 'Trabalhos'], ['➕', 'Novo pedido'], ['💰', 'Financeiro'], ['✨', 'IA Special']], 3)}`,
  },
};

const pagina = (frase, tela) => `<!DOCTYPE html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;font-family:Manrope,-apple-system,'Segoe UI',sans-serif}</style></head>
<body><div id="art" style="width:1290px;height:2796px;background:
  radial-gradient(1200px 900px at 85% -5%, #3A352D 0%, transparent 60%),
  radial-gradient(1000px 800px at -10% 100%, #2A2620 0%, transparent 55%), ${INK};
  display:flex;flex-direction:column;align-items:center;overflow:hidden;position:relative">
  <div style="position:absolute;top:70px;left:0;right:0;text-align:center">
    <div style="color:${GOLD};letter-spacing:10px;font-size:30px;font-weight:800">✦ SPECIAL</div>
  </div>
  <div style="margin-top:170px;text-align:center;color:#fff;font-size:88px;font-weight:800;line-height:1.18;padding:0 60px">${frase}</div>
  <div style="margin-top:80px;width:960px;height:2020px;background:#050505;border-radius:150px;padding:22px;
    box-shadow:0 80px 160px -60px rgba(0,0,0,.85), 0 0 0 3px #4A453D;position:relative">
    <div style="position:absolute;top:52px;left:50%;transform:translateX(-50%);width:270px;height:74px;background:#050505;border-radius:999px;z-index:5"></div>
    <div style="width:100%;height:100%;border-radius:128px;overflow:hidden;background:${PAPER};position:relative">${tela}</div>
  </div>
</div></body></html>`;

mkdirSync('fotos-loja', { recursive: true });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 2900 } });
for (const [app, telas] of [['lab', telasLab], ['clinic', telasClinic]]) {
  for (const [n, t] of Object.entries(telas)) {
    await page.setContent(pagina(t.frase, t.tela), { waitUntil: 'networkidle' }).catch(async () => {
      await page.setContent(pagina(t.frase, t.tela), { waitUntil: 'load' });
    });
    await page.waitForTimeout(350);
    await (await page.$('#art')).screenshot({ path: `fotos-loja/${app}-${n}.png` });
    console.log(`fotos-loja/${app}-${n}.png ✓`);
  }
}
await browser.close();
console.log('Fotos de loja geradas ✓');
