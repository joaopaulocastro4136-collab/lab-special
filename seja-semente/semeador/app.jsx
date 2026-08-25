// ═══════════════════════════════════════════════════════════════════════════
//  SEMEADOR — aplicativo do voluntário do projeto Seja Semente
//
//  O aplicativo conversa com a central (o programa Windows instalado na
//  máquina do projeto) através do Firebase: os dois leem e escrevem no
//  mesmo banco (Firestore), em tempo real. O contrato de dados que os dois
//  lados seguem está descrito em PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { Bolha, lerLocal, gravarLocal, corDoNome, Abertura, GoogleG, BrotoMini, ligarGestoVoltar, usarTemInternet } from '../logo.jsx';
import { Home, CalendarDays, User, Megaphone, TriangleAlert, Mail, Lock, Eye, EyeOff, Stethoscope, Sparkles, HeartPulse, Wrench, Syringe, Scissors, Crown, ClipboardCheck, Scan, Tag, Clock, Inbox, ChevronLeft, ChevronRight, MessagesSquare } from 'lucide-react';
import { FichaPaciente, comprimirImagem } from '../ficha.jsx';
import { Chat } from '../chat.jsx';
import { AgendaSemana } from '../agenda-semana.jsx';
import { Arcada } from '../dentes.jsx';
import { SeletorAvatar } from '../avatar.jsx';
import icone from '../icones/icone-semeador-1024.png';

// A logo do aplicativo (a mesma do ícone), em tamanho de tela
function LogoApp({ tamanho = 120 }) {
  return <img src={icone} width={tamanho} height={tamanho} alt="Semeador"
    style={{ display: 'block', borderRadius: tamanho * 0.24, boxShadow: tamanho >= 90 ? '0 12px 30px rgba(30,43,34,0.20)' : 'none' }} />;
}

// ─── Modo demonstração: enquanto o Firebase não estiver configurado, o app
//     roda sozinho com dados de exemplo para dar pra ver e testar tudo ───
const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null; // { auth, db, fns } — só existe quando o Firebase está ligado

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const modAuth = await import('firebase/auth');
  const modFs = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  // Dentro do aplicativo do iPhone (WebView), o jeito padrão de iniciar a
  // autenticação e o banco falha — estes dois ajustes são os recomendados:
  let auth;
  if (window.__loginGoogleNativo || window.__entrarNativoGoogle) {
    // iPhone (WKWebView): SEM popupRedirectResolver — o login é pela tela de
    // contas do aparelho; o resolver web carregaria um script do Google que
    // quebra dentro do aplicativo ("Script error." na largada)
    try {
      auth = modAuth.initializeAuth(app, {
        persistence: [modAuth.indexedDBLocalPersistence, modAuth.browserLocalPersistence],
      });
    } catch (e) { auth = modAuth.getAuth(app); }
  } else {
    // Navegador/computador: o padrão já configura o login web (Google) certo
    auth = modAuth.getAuth(app);
  }
  // Modo offline: os dados ficam guardados no próprio aparelho — dá para
  // abrir pacientes, agenda e fotos sem internet, e tudo que for feito
  // offline entra numa fila que o Firestore envia SOZINHO quando a
  // conexão voltar (ninguém precisa apertar nada)
  let db;
  try {
    db = modFs.initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      localCache: modFs.persistentLocalCache({ tabManager: modFs.persistentMultipleTabManager() }),
    });
  } catch (e) {
    db = modFs.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
  fb = { auth, db, fns: { ...modAuth, ...modFs } };
}

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'demo-1', nome: 'Voluntário de Teste', ministerio: 'Acolhimento' },
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo ao Semeador!', texto: 'Este é o aplicativo do voluntário e do dentista do Seja Semente. Aqui você faz a triagem dos pacientes e vê a agenda do dia que a central marcou para você.', criadoEm: new Date(), autor: 'Central' },
    { id: 'a2', titulo: 'Mutirão de sábado', texto: 'Neste sábado teremos mutirão de arrecadação de alimentos. Quem puder chegar às 8h, a van sai do ponto de encontro às 8h30.', criadoEm: new Date(Date.now() - 864e5), autor: 'Coordenação' },
  ],
  agendamentos: [
    { id: 'g0', titulo: 'Avaliação', area: 'Avaliação', pacienteId: 'p7', pacienteNome: 'Ana Paula', data: dataISO(), hora: '09:00', duracaoMin: 30, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
    { id: 'g0b', titulo: 'Cirurgia (extração)', area: 'Cirurgia', pacienteId: 'p1', pacienteNome: 'José da Silva', data: dataISO(), hora: '09:30', duracaoMin: 60, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
    { id: 'g0c', titulo: 'Prótese', area: 'Prótese', pacienteId: 'p4', pacienteNome: 'Rita Nascimento', data: dataISO(), hora: '10:30', duracaoMin: 60, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
    { id: 'g1', titulo: 'Cirurgia (extração)', area: 'Cirurgia', pacienteId: 'p1', pacienteNome: 'José da Silva', data: proximoDia(6), hora: '09:00', duracaoMin: 60, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
    { id: 'g2', titulo: 'Prótese', area: 'Prótese', pacienteId: 'p4', pacienteNome: 'Rita Nascimento', data: proximoDia(3), hora: '15:00', duracaoMin: 90, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
    { id: 'g3', titulo: 'Profilaxia (limpeza)', area: 'Profilaxia', pacienteId: 'p7', pacienteNome: 'Ana Paula', data: proximoDia(1), hora: '08:30', duracaoMin: 30, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
    { id: 'g4', titulo: 'Endodontia (canal)', area: 'Endodontia', pacienteId: 'p1', pacienteNome: 'José da Silva', data: proximoDia(2), hora: '13:00', duracaoMin: 90, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
    { id: 'g5', titulo: 'Dentística (restauração)', area: 'Dentística', pacienteId: 'p4', pacienteNome: 'Rita Nascimento', data: proximoDia(5), hora: '10:00', duracaoMin: 60, profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade', origem: 'central' },
  ],
  pacientes: [
    { id: 'p1', nome: 'José da Silva', idade: '52', telefone: '(11) 98888-1111', status: 'triado', observacoes: 'Sente dor no dente há duas semanas.', triagem: { especialidade: 'Odontologia', procedimento: 'Extração', saude: ['Hipertensão / pressão alta'], outrasCondicoes: '', profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade' } },
    { id: 'p4', nome: 'Rita Nascimento', idade: '60', telefone: '(11) 93333-8888', status: 'em atendimento', prioridade: true, observacoes: '', triagem: { especialidade: 'Odontologia', procedimento: 'Prótese', saude: ['Diabetes'], outrasCondicoes: '', profissionalUid: 'demo-google', profissionalNome: 'Lucas Andrade' } },
    { id: 'p7', codigo: 'SS-0007', nome: 'Ana Paula', idade: '34', telefone: '(11) 94444-2222', status: 'cadastrado', observacoes: 'Chegou pela campanha do agasalho.', triagem: null },
  ],
  centralOnline: false,
  equipe: [
    { id: 'central-demo', nome: 'Coordenação (central)' },
    { id: 'demo-google', nome: 'Lucas Andrade' },
  ],
  chat: [
    { id: 'm1', texto: 'Bem-vindos ao chat da equipe! Recados sobre pacientes podem ser mandados por aqui.', autorUid: 'central-demo', autorNome: 'Coordenação (central)', criadoEm: new Date() },
  ],
};

function proximoDia(diaSemana) {
  const d = new Date();
  d.setDate(d.getDate() + ((diaSemana - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// A data de hoje no formato do banco (AAAA-MM-DD), no fuso do aparelho
function dataISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function somaDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  return dataISO(new Date(a, m - 1, d + n));
}

// ─── Triagem: as mesmas caixinhas e regras da central (ver PONTE.md) ───
const AREAS = [
  { nome: 'Profilaxia', detalhe: 'limpeza', Icone: Sparkles, cor: '#29A0CE' },
  { nome: 'Periodontia', detalhe: 'gengiva', Icone: HeartPulse, cor: '#E24B26' },
  { nome: 'Dentística', detalhe: 'restauração', Icone: Wrench, cor: '#5FA83C' },
  { nome: 'Endodontia', detalhe: 'canal', Icone: Syringe, cor: '#7E4A9E' },
  { nome: 'Cirurgia', detalhe: 'extração', Icone: Scissors, cor: '#C22326' },
  { nome: 'Prótese', detalhe: '', Icone: Crown, cor: '#F0A912' },
  { nome: 'Raio-X', detalhe: 'radiografia', Icone: Scan, cor: '#3559B8' },
  { nome: 'Avaliação', detalhe: 'primeira consulta', Icone: ClipboardCheck, cor: '#2F7D4E' },
];
const DURACAO_PADRAO = 30; // minutos
const CONDICOES_SAUDE = ['Hipertensão / pressão alta', 'Diabetes', 'Problema cardíaco', 'Alergia a medicamento', 'Medicação contínua', 'Gestante'];

// Um paciente pode precisar de vários procedimentos ao mesmo tempo
// (aceita também os formatos antigos: `area` e `procedimento`)
function areasDoPaciente(p) {
  const t = p?.triagem;
  if (!t) return [];
  if (Array.isArray(t.areas)) return t.areas;
  if (t.area) return [t.area];
  return t.procedimento ? [t.procedimento] : [];
}

// ─── Utilidades ───
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
function horaFim(hora, dur) {
  const [h, m] = String(hora || '00:00').split(':').map(Number);
  const total = h * 60 + m + (dur || 30);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function horaBonita(v) {
  const d = v?.toDate ? v.toDate() : v instanceof Date ? v : null;
  if (!d) return '';
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return mesmoDia ? `hoje às ${hm}` : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} às ${hm}`;
}

// ═══════════════════════════════════════════════════════════════════════════
//  Telas
// ═══════════════════════════════════════════════════════════════════════════

function TelaLogin({ aoEntrarDemo }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrarGoogle() {
    setErro('');
    if (!CONFIGURADO) {
      aoEntrarDemo({ uid: 'demo-google', nome: 'Lucas Andrade', email: 'lucas.andrade@gmail.com' });
      return;
    }
    setCarregando(true);
    try {
      // No aplicativo instalado, usa a tela de contas do próprio iPhone;
      // no navegador, a janelinha do Google (com plano B de redirect)
      if (window.__loginGoogleNativo) {
        // Ponte nova (casca viva): ela devolve os tokens do Google e a
        // entrada no Firebase é feita aqui, com a biblioteca do próprio app
        const c = await window.__loginGoogleNativo();
        await fb.fns.signInWithCredential(fb.auth, fb.fns.GoogleAuthProvider.credential(c.idToken, c.accessToken || undefined));
      } else if (window.__entrarNativoGoogle) await window.__entrarNativoGoogle(fb.auth);
      else {
        // Navegador/computador: janelinha do Google. O caminho antigo
        // (navegar a página inteira até o Google) só volta logado no
        // endereço firebaseapp.com — nos outros (web.app), os navegadores
        // novos bloqueiam a volta e a pessoa ficava presa na tela do
        // Firebase sem entrar. A janelinha funciona em qualquer endereço.
        try {
          await fb.fns.signInWithPopup(fb.auth, new fb.fns.GoogleAuthProvider());
        } catch (e2) {
          const cod = e2?.code || '';
          if (cod === 'auth/popup-closed-by-user' || cod === 'auth/cancelled-popup-request') {
            setCarregando(false);
            return; // a pessoa só fechou a janelinha — não é erro
          }
          if (cod === 'auth/popup-blocked') {
            if (window.location.hostname === 'seja-semente-app.firebaseapp.com') {
              await fb.fns.signInWithRedirect(fb.auth, new fb.fns.GoogleAuthProvider());
              return; // a página vai para o Google
            }
            setCarregando(false);
            setErro('O navegador bloqueou a janelinha do Google. Permita janelas pop-up para este site (no aviso da barra de endereço) e toque de novo em Entrar com Google.');
            return;
          }
          if (cod === 'auth/network-request-failed') {
            setCarregando(false);
            setErro('Sem conexão com a internet agora — confira a rede e tente de novo.');
            return;
          }
          throw e2; // outros erros caem na mensagem geral
        }
      }
    } catch (e) {
      if (!String(e?.message || '').includes('cancelado')) {
        setErro('Não consegui entrar com o Google agora. Espere uns segundos e tente de novo — se continuar, me mande um print desta tela.');
        console.log('detalhe login Google:', e?.code || '', e?.message || e);
      }
    }
    setCarregando(false);
  }

  const [novaConta, setNovaConta] = useState(false);

  async function entrarEmail() {
    setErro('');
    setCarregando(true);
    try {
      if (novaConta) await fb.fns.createUserWithEmailAndPassword(fb.auth, email.trim(), senha);
      else await fb.fns.signInWithEmailAndPassword(fb.auth, email.trim(), senha);
    } catch (e) {
      setErro(novaConta
        ? 'Não consegui criar a conta — a senha precisa de 6 ou mais caracteres e o e-mail ser válido (ou já existe conta com ele).'
        : 'Não consegui entrar. Confira o e-mail e a senha.');
    }
    setCarregando(false);
  }

  const [verSenha, setVerSenha] = useState(false);

  return (
    <div className="tela-login">
      <LogoApp tamanho={118} />
      <h1>Semeador</h1>
      <p className="login-etiqueta">Aplicativo do voluntário</p>
      <div className="divisor-broto"><i /><BrotoMini tamanho={19} /><i /></div>
      <p className="missao">Quem planta o bem, <em>colhe vidas</em>.</p>
      {!CONFIGURADO && <div className="faixa-demo">Modo demonstração — o Firebase ainda não foi configurado (veja o README.md)</div>}
      <button className="btn-google" onClick={entrarGoogle} disabled={carregando}>
        <GoogleG tamanho={23} /> Entrar com Google
      </button>
      {CONFIGURADO && (
        <>
          <div className="separador">ou com e-mail</div>
          <label className="campo-login">
            <Mail size={19} />
            <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label className="campo-login">
            <Lock size={19} />
            <input placeholder={novaConta ? 'Crie uma senha (6+ caracteres)' : 'Senha'} type={verSenha ? 'text' : 'password'} value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrarEmail()} />
            <button type="button" className="olho" onClick={() => setVerSenha(!verSenha)} aria-label="Mostrar senha">{verSenha ? <EyeOff size={19} /> : <Eye size={19} />}</button>
          </label>
          <button className="btn-principal btn-entrar" onClick={entrarEmail} disabled={carregando}>
            {carregando ? 'Um instante…' : (novaConta ? 'Criar conta' : 'Entrar')}
            <span className="folha-btn"><BrotoMini tamanho={34} cor="rgba(255,255,255,0.4)" /></span>
          </button>
          <BrotoMini tamanho={15} cor="#BCCEC1" />
          <button className="link-troca" onClick={() => { setNovaConta(!novaConta); setErro(''); }}>
            {novaConta ? 'Já tenho conta — entrar' : 'Primeira vez? Criar conta com e-mail'}
          </button>
        </>
      )}
      {erro && <div className="erro">{erro}</div>}
    </div>
  );
}

// ─── Primeira entrada: o voluntário preenche o cadastro, que vira uma
//     solicitação para a central Seja Semente aprovar ───
function TelaCadastro({ usuario, aoEnviar }) {
  const [f, setF] = useState({ nome: usuario.nome || '', telefone: '', cpf: '', nascimento: '' });
  const [av, setAv] = useState({ foto: '', fotoMini: '', avatar: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  const cpfOk = f.cpf.replace(/\D/g, '').length === 11;
  const pronto = f.nome.trim() && f.telefone.trim() && cpfOk && f.nascimento;
  return (
    <div className="folha">
      <h2>Cadastro de voluntário</h2>
      <p className="dica">Bem-vindo! Preencha seus dados — eles vão para a central Seja Semente, que aprova a sua entrada como voluntário.</p>
      <div className="campo"><span>Sua foto (ou um dentinho da biblioteca)</span>
        <SeletorAvatar nome={f.nome || usuario.nome} foto={av.foto} avatar={av.avatar} aoSalvar={x => setAv(a => ({ ...a, ...x }))} />
      </div>
      <Campo rotulo="Nome completo"><input value={f.nome} onChange={muda('nome')} /></Campo>
      <Campo rotulo="Telefone (WhatsApp)"><input value={f.telefone} onChange={muda('telefone')} inputMode="tel" placeholder="(11) 91234-5678" /></Campo>
      <Campo rotulo="CPF"><input value={f.cpf} onChange={muda('cpf')} inputMode="numeric" placeholder="000.000.000-00" /></Campo>
      <Campo rotulo="Data de nascimento"><input type="date" value={f.nascimento} onChange={muda('nascimento')} /></Campo>
      {f.cpf && !cpfOk && <div className="erro">O CPF precisa ter 11 números.</div>}
      <button className="btn-principal" disabled={!pronto} onClick={() => aoEnviar({ ...f, ...av })}>Enviar solicitação</button>
    </div>
  );
}

function TelaAguardando({ usuario, aoSair, aoSimularAprovacao }) {
  return (
    <div className="tela-login">
      <LogoApp tamanho={110} />
      <h1>Solicitação enviada!</h1>
      <p className="login-sub">Seu cadastro foi enviado para a central Seja Semente.<br />Assim que a coordenação aprovar, você entra como voluntário — o aplicativo libera sozinho, na hora.</p>
      {!CONFIGURADO && <button className="btn-principal" onClick={aoSimularAprovacao}>(demonstração) Simular aprovação da central</button>}
      <button className="btn-sair" onClick={aoSair}>Sair</button>
    </div>
  );
}

function TelaRecusado({ aoSair }) {
  return (
    <div className="tela-login">
      <LogoApp tamanho={110} />
      <h1>Cadastro não aprovado</h1>
      <p className="login-sub">A central Seja Semente não aprovou esta solicitação.<br />Fale com a coordenação se achar que foi um engano.</p>
      <button className="btn-sair" onClick={aoSair}>Sair</button>
    </div>
  );
}

function CartaoAviso({ aviso }) {
  return (
    <div className="cartao">
      <div className="cartao-linha">
        <Bolha nome={aviso.titulo} Icone={Megaphone} />
        <div>
          <div className="cartao-topo">
            <strong>{aviso.titulo}</strong>
            <span className="quando">{horaBonita(aviso.criadoEm)}</span>
          </div>
          <p>{aviso.texto}</p>
          {aviso.autor && <div className="autor">— {aviso.autor}</div>}
        </div>
      </div>
    </div>
  );
}

function Vazio({ texto }) {
  return <div className="vazio">{texto}</div>;
}

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

// TRIAGEM: o formulário de diagnóstico do paciente (o mesmo da central —
// o que o dentista salvar aqui aparece lá na hora, e vice-versa)
function FormTriagem({ paciente, areas, condicoes, aoAdicionarTipo, aoAdicionarCondicao, aoSalvar, aoCancelar }) {
  const inicial = paciente.triagem;
  const [f, setF] = useState({
    areas: inicial ? (Array.isArray(inicial.areas) ? inicial.areas : (inicial.area ? [inicial.area] : [])) : [],
    saude: inicial?.saude || [],
    outrasCondicoes: inicial?.outrasCondicoes || '',
    dentes: inicial?.dentes || [],
    gengiva: inicial?.gengiva || [],
    semMarcacao: !!inicial?.semMarcacao,
  });
  // Odontograma: toca no dente para marcar/desmarcar os dentes do tratamento
  const alternaDente = n => setF(atual => ({
    ...atual,
    dentes: atual.dentes.includes(n) ? atual.dentes.filter(x => x !== n) : [...atual.dentes, n].sort((a, b) => a - b),
  }));
  const [modoDente, setModoDente] = useState('dentes'); // o seletor Dentes | Gengiva
  const alternaGengiva = n => setF(atual => ({
    ...atual,
    gengiva: atual.gengiva.includes(n) ? atual.gengiva.filter(x => x !== n) : [...atual.gengiva, n].sort((a, b) => a - b),
  }));
  const [novoTipo, setNovoTipo] = useState('');
  const alternaArea = a => setF({ ...f, areas: f.areas.includes(a) ? f.areas.filter(x => x !== a) : [...f.areas, a] });
  const alternaSaude = c => setF({ ...f, saude: f.saude.includes(c) ? f.saude.filter(x => x !== c) : [...f.saude, c] });
  async function adicionarTipo() {
    const nome = novoTipo.trim();
    if (!nome) return;
    await aoAdicionarTipo(nome);
    setF(atual => ({ ...atual, areas: [...atual.areas, nome] }));
    setNovoTipo('');
  }
  const [novaCondicao, setNovaCondicao] = useState('');
  // Fotos opcionais da triagem (ex.: dentro da boca) — vão para a ficha
  const [fotos, setFotos] = useState([]);
  const [erroFoto, setErroFoto] = useState('');
  async function pegarFoto(e) {
    setErroFoto('');
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      let dataUrl = await comprimirImagem(file);
      if (dataUrl.length > 900000) dataUrl = await comprimirImagem(file, 0.5, 800);
      if (dataUrl.length > 900000) { setErroFoto('A foto ficou grande demais — tente outra.'); return; }
      setFotos(fs => [...fs, { dataUrl, legenda: 'Foto da triagem' }]);
    } catch (e2) { setErroFoto('Não consegui ler essa imagem.'); }
  }
  async function adicionarCondicao() {
    const nome = novaCondicao.trim();
    if (!nome) return;
    await aoAdicionarCondicao(nome);
    setF(atual => ({ ...atual, saude: atual.saude.includes(nome) ? atual.saude : [...atual.saude, nome] }));
    setNovaCondicao('');
  }
  return (
    <div className="folha">
      <h2>Triagem — {paciente.nome}</h2>
      <div className="campo"><span>Procedimentos que vai fazer (marque todos os que precisar)</span>
        <div className="caixas">
          {areas.map(a => (
            <label key={a.nome} className={f.areas.includes(a.nome) ? 'caixa marcada' : 'caixa'} onClick={() => alternaArea(a.nome)}>
              <a.Icone size={15} style={{ color: a.cor }} />{a.nome}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input style={{ flex: 1 }} value={novoTipo} onChange={e => setNovoTipo(e.target.value)} placeholder="Outro procedimento? Digite (ex.: Pediatria)" onKeyDown={e => e.key === 'Enter' && adicionarTipo()} />
          <button className="btn-mais" onClick={adicionarTipo} disabled={!novoTipo.trim()}>+ Add</button>
        </div>
      </div>
      <div className="campo"><span>Saúde do paciente (marque o que tiver)</span>
        <div className="caixas">
          {condicoes.map(c => (
            <label key={c} className={f.saude.includes(c) ? 'caixa marcada' : 'caixa'}>
              <input type="checkbox" checked={f.saude.includes(c)} onChange={() => alternaSaude(c)} />
              {c}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <input style={{ flex: 1 }} value={novaCondicao} onChange={e => setNovaCondicao(e.target.value)} placeholder="Outra condição? Digite (ex.: Asma)" onKeyDown={e => e.key === 'Enter' && adicionarCondicao()} />
          <button className="btn-mais" onClick={adicionarCondicao} disabled={!novaCondicao.trim()}>+ Add</button>
        </div>
      </div>
      <div className="campo"><span>Marcação do tratamento (obrigatória){f.dentes.length ? ` · ${f.dentes.length} dente${f.dentes.length === 1 ? '' : 's'}` : ''}{f.gengiva.length ? ` · gengiva em ${f.gengiva.length}` : ''}</span>
        <div className="seletor" style={{ margin: '2px 0 0' }}>
          <button type="button" className={modoDente === 'dentes' ? 'ativo' : ''} onClick={() => setModoDente('dentes')}>🦷 Dentes{f.dentes.length ? ` (${f.dentes.length})` : ''}</button>
          <button type="button" className={modoDente === 'gengiva' ? 'ativo' : ''} onClick={() => setModoDente('gengiva')}>🌸 Gengiva{f.gengiva.length ? ` (${f.gengiva.length})` : ''}</button>
        </div>
        <p className="dica" style={{ margin: 0 }}>{modoDente === 'dentes'
          ? 'Toque nos DENTES do tratamento (ficam verdes).'
          : 'Toque no dente para marcar a GENGIVA daquela região (capinha rosa).'}</p>
        <Arcada marcados={f.dentes} gengiva={f.gengiva} aoAlternar={n => (modoDente === 'dentes' ? alternaDente(n) : alternaGengiva(n))} />
        <label className={f.semMarcacao ? 'caixa marcada' : 'caixa'} style={{ alignSelf: 'flex-start' }}>
          <input type="checkbox" checked={f.semMarcacao} onChange={() => setF(atual => ({ ...atual, semMarcacao: !atual.semMarcacao }))} />
          Sem marcação neste caso (não se aplica)
        </label>
        {!f.semMarcacao && f.dentes.length === 0 && f.gengiva.length === 0 && (
          <p className="erro" style={{ margin: 0 }}>Marque os dentes ou a gengiva do tratamento — ou toque em “Sem marcação”.</p>
        )}
      </div>
      <Campo rotulo="Outras condições de saúde"><input value={f.outrasCondicoes} onChange={e => setF({ ...f, outrasCondicoes: e.target.value })} placeholder="Ex.: cirurgia recente, asma…" /></Campo>
      <div className="campo"><span>Fotos da triagem (opcional) — ex.: dentro da boca</span>
        <label className="btn-foto" style={{ cursor: 'pointer' }}>
          📷 Tirar ou anexar foto
          <input type="file" accept="image/*" onChange={pegarFoto} style={{ display: 'none' }} />
        </label>
        {fotos.length > 0 && (
          <div className="grade-fotos">
            {fotos.map((ft, i) => (
              <span key={i} className="foto-mini" style={{ position: 'relative', display: 'block' }}>
                <img src={ft.dataUrl} alt={`foto ${i + 1}`} />
                <button type="button" className="btn-remover" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => setFotos(fs => fs.filter((_, j) => j !== i))}>✕</button>
              </span>
            ))}
          </div>
        )}
        {fotos.length > 0 && <p className="dica" style={{ margin: 0 }}>{fotos.length} foto{fotos.length === 1 ? '' : 's'} — vão para a ficha do paciente ao concluir a triagem.</p>}
        {erroFoto && <div className="erro">{erroFoto}</div>}
      </div>
      <p className="dica">A triagem aparece na central Seja Semente na hora — de lá o paciente já pode ser agendado.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={f.areas.length === 0 || (!f.semMarcacao && f.dentes.length === 0 && f.gengiva.length === 0)} onClick={() => aoSalvar(f, fotos)}>Concluir triagem</button>
      </div>
    </div>
  );
}

function TelaPrincipal({ usuario, aoSair, aoSalvarPerfil }) {
  const [aba, setAba] = useState('inicio');
  const temInternet = usarTemInternet();
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : DEMO.avisos);
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : lerLocal('sd-agendamentos', DEMO.agendamentos));
  const [todosPacientes, setTodosPacientes] = useState(CONFIGURADO ? [] : lerLocal('sd-pacientes', DEMO.pacientes));

  // ─── Chat da equipe (mesma conversa da central, em tempo real) ───
  const [mensagens, setMensagens] = useState(CONFIGURADO ? [] : lerLocal('sd-chat', DEMO.chat));
  const [equipe, setEquipe] = useState(CONFIGURADO ? [] : DEMO.equipe);
  const [chatVisto, setChatVisto] = useState(lerLocal('sd-chat-visto', 0));
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-chat', mensagens); }, [mensagens]);
  useEffect(() => {
    if (aba !== 'chat') return;
    setChatVisto(mensagens.length);
    gravarLocal('sd-chat-visto', mensagens.length);
  }, [aba, mensagens.length]);

  async function enviarMensagem(m) {
    const dados = {
      ...m, autorUid: usuario.uid, autorNome: usuario.nome || '',
      autorAvatar: usuario.avatar || '',
      autorFotoMini: usuario.fotoMini || (String(usuario.foto || '').startsWith('http') ? usuario.foto : ''),
    };
    if (!CONFIGURADO) {
      setMensagens(ms => [...ms, { id: 'm' + Math.floor(Math.random() * 1e9), ...dados, criadoEm: new Date() }]);
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'chat'), { ...dados, criadoEm: serverTimestamp() }).catch(() => {});
  }

  // Primeiro espaço livre na MINHA agenda (08h–17h): emenda no fim do
  // último atendimento do dia; dia cheio → tenta o dia seguinte
  function proximoEspaco(duracao) {
    const min = t => { const [h, mm] = String(t || '08:00').split(':').map(Number); return h * 60 + mm; };
    const hm = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    let dia = dataISO();
    for (let i = 0; i < 90; i++) {
      let inicio = 8 * 60;
      for (const g of agendamentos.filter(g => g.data === dia)) {
        const fim = min(g.hora) + (g.duracaoMin || DURACAO_PADRAO);
        if (fim > inicio) inicio = fim;
      }
      if (inicio + duracao <= 17 * 60) return { data: dia, hora: hm(inicio) };
      dia = somaDias(dia, 1);
    }
    return null;
  }

  // Aceitar a sugestão do chat: o paciente entra no procedimento sugerido
  // (conta na caixinha na hora, aqui e na central) E já cai na minha agenda
  // — hoje se ainda houver espaço, senão no dia seguinte
  async function aceitarSugestao(m) {
    const p = todosPacientes.find(x => x.id === m.pacienteId);
    if (!p || !m.sugestaoArea) return;
    const triagem = { saude: [], outrasCondicoes: '', ...(p.triagem || {}), areas: [...new Set([...areasDoPaciente(p), m.sugestaoArea])] };
    delete triagem.area; delete triagem.procedimento;
    const dur = duracaoDe(m.sugestaoArea);
    const espaco = proximoEspaco(dur);
    const aInfo = todasAreas.find(a => a.nome === m.sugestaoArea);
    const novoAg = espaco ? {
      area: m.sugestaoArea,
      titulo: m.sugestaoArea + (aInfo?.detalhe ? ` (${aInfo.detalhe})` : ''),
      duracaoMin: dur,
      pacienteId: p.id, pacienteNome: p.nome,
      profissionalUid: usuario.uid, profissionalNome: usuario.nome || '',
      data: espaco.data, hora: espaco.hora, origem: 'chat',
      marcadoPorUid: usuario.uid, marcadoPorNome: usuario.nome || '',
    } : null;
    const aceite = { aceitoPorUid: usuario.uid, aceitoPorNome: usuario.nome || '', agendaDia: espaco ? dataBonita(espaco.data) : '', agendaHora: espaco?.hora || '' };
    if (!CONFIGURADO) {
      setTodosPacientes(ps => ps.map(x => x.id === p.id ? { ...x, triagem, status: x.triagem ? x.status : 'triado' } : x));
      if (novoAg) setAgendamentos(gs => [...gs, { id: 'g' + Math.floor(Math.random() * 1e9), ...novoAg, criadoEm: new Date() }]);
      setMensagens(ms => ms.map(x => x.id === m.id ? { ...x, ...aceite } : x));
      return;
    }
    const { doc, updateDoc, collection, addDoc, serverTimestamp } = fb.fns;
    updateDoc(doc(fb.db, 'pacientes', p.id), { triagem, ...(p.triagem ? {} : { status: 'triado' }) }).catch(() => {});
    if (novoAg) addDoc(collection(fb.db, 'agendamentos'), { ...novoAg, criadoEm: serverTimestamp() }).catch(() => {});
    updateDoc(doc(fb.db, 'chat', m.id), { ...aceite, aceitoEm: serverTimestamp() }).catch(() => {});
  }

  // ─── Triagem no Semeador: o dentista faz a separação por aqui mesmo ───
  const [telaTriagem, setTelaTriagem] = useState(null); // {triagem:p} | 'entrada' | {area}
  const [buscaArea, setBuscaArea] = useState('');
  const [buscaTriagem, setBuscaTriagem] = useState(''); // pesquisa geral de paciente na aba Triagem
  const [configProc, setConfigProc] = useState(CONFIGURADO ? { personalizados: [], duracoes: {} } : lerLocal('sd-config-proc', { personalizados: [], duracoes: {} }));
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-pacientes', todosPacientes); }, [todosPacientes]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-config-proc', configProc); }, [configProc]);
  useEffect(() => {
    if (!CONFIGURADO) return;
    const { doc, onSnapshot } = fb.fns;
    return onSnapshot(doc(fb.db, 'config', 'procedimentos'), snap => {
      if (snap.exists()) setConfigProc({ personalizados: [], duracoes: {}, ...snap.data() });
    });
  }, []);
  const todasAreas = [
    ...AREAS,
    ...(configProc.personalizados || []).map(p => ({ nome: p.nome, detalhe: p.detalhe || '', Icone: Tag, cor: corDoNome(p.nome), personalizado: true })),
  ];
  const duracaoDe = nome => configProc.duracoes?.[nome] || DURACAO_PADRAO;

  // Condições de saúde: as fixas + as adicionadas pela equipe (ex.: Asma)
  const todasCondicoes = [...CONDICOES_SAUDE, ...(configProc.condicoesSaude || [])];
  async function adicionarCondicao(nome) {
    if (todasCondicoes.some(c => c.toLowerCase() === nome.toLowerCase())) return;
    const nova = { ...configProc, condicoesSaude: [...(configProc.condicoesSaude || []), nome] };
    setConfigProc(nova);
    if (!CONFIGURADO) return;
    const { doc, setDoc } = fb.fns;
    setDoc(doc(fb.db, 'config', 'procedimentos'), nova).catch(() => {});
  }
  async function adicionarTipo(nome) {
    if (todasAreas.some(a => a.nome.toLowerCase() === nome.toLowerCase())) return;
    const nova = { ...configProc, personalizados: [...(configProc.personalizados || []), { nome, detalhe: '' }] };
    setConfigProc(nova);
    if (!CONFIGURADO) return;
    const { doc, setDoc } = fb.fns;
    setDoc(doc(fb.db, 'config', 'procedimentos'), nova).catch(() => {});
  }
  async function salvarTriagem(paciente, triagem, fotos = []) {
    // Fica registrado quem fez a triagem (e quando), vinculado à conta
    triagem = { ...triagem, feitaPorUid: usuario.uid, feitaPorNome: usuario.nome || '', feitaEm: new Date() };
    // As fotos tiradas na triagem entram direto na ficha do paciente
    const registroDe = ft => ({ dataUrl: ft.dataUrl, legenda: ft.legenda || 'Foto da triagem', autorUid: usuario.uid, autorNome: usuario.nome || '' });
    if (!CONFIGURADO) {
      setTodosPacientes(ps => ps.map(p => p.id === paciente.id ? { ...p, triagem, status: 'triado' } : p));
      if (fotos.length) setDemoArquivos(a => ({ ...a, [paciente.id]: [...fotos.map(ft => ({ id: 'f' + Math.floor(Math.random() * 1e9), ...registroDe(ft), criadoEm: new Date() })), ...(a[paciente.id] || [])] }));
      setTelaTriagem(null);
      return;
    }
    const { doc, updateDoc, collection, addDoc, serverTimestamp } = fb.fns;
    updateDoc(doc(fb.db, 'pacientes', paciente.id), { triagem, status: 'triado' }).catch(() => {});
    for (const ft of fotos) addDoc(collection(fb.db, 'pacientes', paciente.id, 'arquivos'), { ...registroDe(ft), criadoEm: serverTimestamp() }).catch(() => {});
    setTelaTriagem(null);
  }
  const semTriagem = todosPacientes.filter(p => !p.triagem);

  // Agenda do dia: o que a central mandou para hoje, e o que vem depois
  const hojeISO = dataISO();
  const agendaHoje = agendamentos.filter(g => g.data === hojeISO)
    .sort((a, b) => String(a.hora || '').localeCompare(String(b.hora || '')));
  const corDaArea = nome => todasAreas.find(a => a.nome === nome)?.cor || corDoNome(nome || '');

  // Sem Firebase, o que você faz fica salvo no aparelho
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-agendamentos', agendamentos); }, [agendamentos]);

  // ─── Ficha do paciente (dados + fotos do que foi feito) ───
  const [fichaId, setFichaId] = useState(null);
  const [fichaPaciente, setFichaPaciente] = useState(null);
  const [fichaArquivos, setFichaArquivos] = useState([]);
  const [demoArquivos, setDemoArquivos] = useState({});

  useEffect(() => {
    if (!fichaId) { setFichaPaciente(null); setFichaArquivos([]); return; }
    if (!CONFIGURADO) {
      setFichaPaciente(todosPacientes.find(p => p.id === fichaId) || null);
      setFichaArquivos(demoArquivos[fichaId] || []);
      return;
    }
    const { doc, onSnapshot, collection, query, orderBy } = fb.fns;
    const s1 = onSnapshot(doc(fb.db, 'pacientes', fichaId), snap => setFichaPaciente(snap.exists() ? { id: snap.id, ...snap.data() } : null));
    const s2 = onSnapshot(query(collection(fb.db, 'pacientes', fichaId, 'arquivos'), orderBy('criadoEm', 'desc')), snap => setFichaArquivos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { s1(); s2(); };
  }, [fichaId, todosPacientes, demoArquivos]);

  async function salvarArquivo(dataUrl, legenda) {
    const registro = { dataUrl, legenda, autorUid: usuario.uid, autorNome: usuario.nome || '' };
    if (!CONFIGURADO) {
      setDemoArquivos(a => ({ ...a, [fichaId]: [{ id: 'f' + Math.floor(Math.random() * 1e9), ...registro, criadoEm: new Date() }, ...(a[fichaId] || [])] }));
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    addDoc(collection(fb.db, 'pacientes', fichaId, 'arquivos'), { ...registro, criadoEm: serverTimestamp() }).catch(() => {});
  }
  const [centralOnline, setCentralOnline] = useState(DEMO.centralOnline);

  // Escuta o Firestore em tempo real: qualquer coisa que a central (programa
  // Windows) escrever aparece aqui na hora, sem precisar atualizar nada.
  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, doc, onSnapshot, query, orderBy } = fb.fns;
    const paraAvisos = onSnapshot(
      query(collection(fb.db, 'avisos'), orderBy('criadoEm', 'desc')),
      snap => setAvisos(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // A agenda do voluntário: só o que a central marcou PARA ELE
    const paraAgenda = onSnapshot(
      query(collection(fb.db, 'agendamentos'), orderBy('data')),
      snap => setAgendamentos(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(g => g.profissionalUid === usuario.uid))
    );
    // Todos os pacientes — o app filtra os "meus" cruzando com a agenda
    const paraPacientes = onSnapshot(
      query(collection(fb.db, 'pacientes'), orderBy('criadoEm', 'desc')),
      snap => setTodosPacientes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    // Batimento da central: o programa Windows atualiza central/status a cada
    // minuto; se o último batimento tem menos de 3 minutos, ela está online.
    const paraCentral = onSnapshot(doc(fb.db, 'central', 'status'), snap => {
      const s = snap.data();
      const ultimo = s?.atualizadoEm?.toDate?.();
      setCentralOnline(!!ultimo && Date.now() - ultimo.getTime() < 3 * 60 * 1000);
    });
    // O chat da equipe e a lista de quem pode ser marcado (@)
    const paraChat = onSnapshot(
      query(collection(fb.db, 'chat'), orderBy('criadoEm')),
      snap => setMensagens(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    );
    const paraEquipe = onSnapshot(
      query(collection(fb.db, 'voluntarios'), orderBy('nome')),
      snap => setEquipe(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(v => v.status === 'ativo' || v.ativo === true))
    );
    return () => { paraAvisos(); paraAgenda(); paraPacientes(); paraCentral(); paraChat(); paraEquipe(); };
  }, [usuario.uid]);


  if (fichaId) return <FichaPaciente paciente={fichaPaciente} arquivos={fichaArquivos} aoVoltar={() => setFichaId(null)} aoSalvarArquivo={salvarArquivo} />;

  if (telaTriagem?.triagem) return <FormTriagem paciente={telaTriagem.triagem} areas={todasAreas} condicoes={todasCondicoes} aoAdicionarTipo={adicionarTipo} aoAdicionarCondicao={adicionarCondicao} aoCancelar={() => setTelaTriagem(null)} aoSalvar={(t, fts) => salvarTriagem(telaTriagem.triagem, t, fts)} />;

  if (telaTriagem === 'entrada') return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => setTelaTriagem(null)}><ChevronLeft size={18} /> Voltar</button>
      <h2>Caixa de entrada</h2>
      <p className="dica">Pacientes aguardando triagem:</p>
      {semTriagem.length ? semTriagem.map(p => (
        <div className="cartao" key={p.id}>
          <div className="cartao-linha">
            <Bolha nome={p.nome} foto={p.foto} />
            <div>
              <div className="cartao-topo"><strong>{p.nome}</strong><span className="chip aguardando">sem triagem</span></div>
              <p className="obs">{[p.codigo, p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
              <button className="btn-triagem" onClick={() => setTelaTriagem({ triagem: p })}>Fazer triagem</button>
            </div>
          </div>
        </div>
      )) : <Vazio texto="Tudo em dia — nenhuma triagem pendente 🌱" />}
    </div>
  );

  if (telaTriagem?.area) {
    const A = telaTriagem.area;
    const filtro = buscaArea.trim().toLowerCase();
    const daAreaTodos = todosPacientes.filter(p => areasDoPaciente(p).includes(A.nome));
    const daArea = daAreaTodos.filter(p => !filtro || p.nome.toLowerCase().includes(filtro) || String(p.codigo || '').toLowerCase().includes(filtro));
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => { setTelaTriagem(null); setBuscaArea(''); }}><ChevronLeft size={18} /> Voltar</button>
        <div className="cartao-linha" style={{ alignItems: 'center', marginBottom: 4 }}>
          <span className="caixa-area-icone" style={{ background: A.cor + '22', color: A.cor }}><A.Icone size={26} strokeWidth={2.2} /></span>
          <h2 style={{ margin: 0 }}>{A.nome} · {daAreaTodos.length} paciente{daAreaTodos.length === 1 ? '' : 's'}</h2>
        </div>
        <input className="busca" placeholder="Pesquisar por nome ou código…" value={buscaArea} onChange={e => setBuscaArea(e.target.value)} />
        {daArea.length ? daArea.map(p => (
          <div className="cartao" key={p.id} onClick={() => setFichaId(p.id)} style={{ cursor: 'pointer' }}>
            <div className="cartao-linha">
              <Bolha nome={p.nome} foto={p.foto} />
              <div>
                <div className="cartao-topo">
                  <strong>{p.nome}</strong>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {p.prioridade && <span className="chip prioridade">prioridade</span>}
                    <span className={'chip ' + (p.status || 'triado').replace(' ', '-')}>{p.status || 'triado'}</span>
                  </span>
                </div>
                <p className="obs">{[p.codigo, p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </div>
        )) : <Vazio texto={filtro ? 'Nenhum paciente encontrado na pesquisa.' : `Nenhum paciente de ${A.nome} ainda.`} />}
      </div>
    );
  }

  return (
    <div className="tela-principal">
      <header className="compacta">
        <div className="header-titulo">
          <div className="logo-bolha"><LogoApp tamanho={30} /></div>
          <div>
            <strong>Semeador</strong>
            <div className={centralOnline ? 'status online' : 'status'}>
              {temInternet
                ? <>{centralOnline ? '● Central conectada' : '○ Central offline'} · {usuario.nome?.split(' ')[0]}</>
                : '📴 Sem internet — salvando no aparelho'}
            </div>
          </div>
        </div>
      </header>

      <main className={aba === 'chat' ? 'com-chat' : undefined}>
        {aba === 'inicio' && (
          <>
            <h2>Pacientes de hoje</h2>
            <p className="dica" style={{ marginBottom: 2 }}>{dataBonita(hojeISO)} · toque no paciente para abrir a ficha</p>
            {agendaHoje.length ? (
              <div className="lista-horarios">
                {agendaHoje.map(g => {
                  const p = todosPacientes.find(x => x.id === g.pacienteId);
                  const cor = corDaArea(g.area || g.titulo);
                  return (
                    <button key={g.id} className="horario-item" style={{ borderLeftColor: cor }} onClick={() => g.pacienteId && setFichaId(g.pacienteId)}>
                      <span className="horario-hora" style={{ color: cor, background: cor + '16' }}>{g.hora} – {horaFim(g.hora, g.duracaoMin)}</span>
                      <span className="horario-linha">
                        <Bolha nome={g.pacienteNome || g.titulo} foto={p?.foto} />
                        <span className="horario-nome">
                          <strong>{g.pacienteNome || g.titulo}</strong>
                          <span>{g.titulo || g.area || ''}{g.local ? ` · ${g.local}` : ''}</span>
                        </span>
                        <ChevronRight size={19} strokeWidth={2.6} className="horario-seta" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : <Vazio texto="Nenhum paciente agendado para hoje." />}
            <h2 style={{ fontSize: 20, marginTop: 16 }}>Avisos</h2>
            {avisos.length ? avisos.map(a => <CartaoAviso key={a.id} aviso={a} />) : <Vazio texto="Nenhum aviso por enquanto." />}
          </>
        )}
        {aba === 'triagem' && (
          <>
            <h2>Triagem</h2>
            <input className="busca" placeholder="Pesquisar paciente por nome ou código…" value={buscaTriagem} onChange={e => setBuscaTriagem(e.target.value)} />
            {buscaTriagem.trim() ? (() => {
              // Pesquisando: mostra os pacientes achados no lugar das caixinhas
              const filtro = buscaTriagem.trim().toLowerCase();
              const achados = todosPacientes.filter(p => (p.nome || '').toLowerCase().includes(filtro) || String(p.codigo || '').toLowerCase().includes(filtro));
              return achados.length ? achados.map(p => (
                <div className="cartao" key={p.id} onClick={() => setFichaId(p.id)} style={{ cursor: 'pointer' }}>
                  <div className="cartao-linha">
                    <Bolha nome={p.nome} foto={p.foto} />
                    <div>
                      <div className="cartao-topo">
                        <strong>{p.nome}</strong>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {p.prioridade && <span className="chip prioridade">prioridade</span>}
                          <span className={'chip ' + (p.status || 'cadastrado').replace(' ', '-')}>{p.status || 'cadastrado'}</span>
                        </span>
                      </div>
                      <p className="obs">{[p.codigo, p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
                    </div>
                  </div>
                </div>
              )) : <Vazio texto="Nenhum paciente encontrado com esse nome ou código." />;
            })() : (
            <>
            <button className={`caixa-entrada ${semTriagem.length ? 'pendente' : 'vazia'}`} onClick={() => setTelaTriagem('entrada')}>
              <span className="entrada-icone"><Inbox size={23} strokeWidth={2.2} /></span>
              <span className="entrada-texto">
                <strong>Caixa de entrada</strong>
                <span>{semTriagem.length
                  ? `${semTriagem.length} pendente${semTriagem.length === 1 ? '' : 's'} de triagem`
                  : 'Tudo em dia — nenhuma pendência'}</span>
              </span>
              {semTriagem.length > 0 && <span className="entrada-qtd">{semTriagem.length}</span>}
              <ChevronRight size={20} strokeWidth={2.6} className="entrada-seta" />
            </button>
            <p className="dica" style={{ margin: '10px 0 8px' }}>Pacientes por procedimento (toque para ver):</p>
            <div className="grade-areas">
              {todasAreas.map(a => {
                const total = todosPacientes.filter(p => areasDoPaciente(p).includes(a.nome)).length;
                return (
                  <button key={a.nome} className="caixa-area" onClick={() => setTelaTriagem({ area: a })}>
                    <span className="area-topo">
                      <span className="caixa-area-icone" style={{ background: a.cor + '1C', color: a.cor }}><a.Icone size={26} strokeWidth={2.2} /></span>
                      <span className="area-seta" style={{ background: a.cor + '16', color: a.cor }}><ChevronRight size={18} strokeWidth={3} /></span>
                    </span>
                    <strong>{a.nome}</strong>
                    <span className="caixa-area-detalhe">
                      <span className="area-qtd" style={{ color: a.cor }}><User size={14} strokeWidth={2.6} /> {total} paciente{total === 1 ? '' : 's'}</span>
                      <i className="area-divisor" />
                      <span className="area-tempo"><Clock size={14} strokeWidth={2.4} /> {duracaoDe(a.nome)} min</span>
                    </span>
                  </button>
                );
              })}
            </div>
            </>
            )}
          </>
        )}
        {aba === 'agenda' && (
          <>
            <h2>Agenda da semana</h2>
            <AgendaSemana agendamentos={agendamentos} corDaArea={corDaArea} duracaoDe={duracaoDe} aoAbrirFicha={setFichaId} />
          </>
        )}
        {aba === 'chat' && (
          <Chat cheio usuario={usuario} mensagens={mensagens} pacientes={todosPacientes} pessoas={equipe}
            areas={todasAreas} aoEnviar={enviarMensagem} aoAceitar={aceitarSugestao} aoAbrirPaciente={setFichaId} />
        )}
        {aba === 'perfil' && (
          <>
            <h2>Meu perfil</h2>
            <div className="cartao">
              <div className="cartao-linha">
                <Bolha nome={usuario.nome} foto={usuario.fotoMini || usuario.foto} avatar={usuario.avatar} />
                <div>
                  <p style={{ marginTop: 0 }}><strong>{usuario.nome}</strong></p>
                  {usuario.ministerio && <p>Ministério: {usuario.ministerio}</p>}
                  {usuario.email && <p>{usuario.email}</p>}
                  {usuario.telefone && <p>{usuario.telefone}</p>}
                </div>
              </div>
            </div>
            <div className="cartao" style={{ marginBottom: 4 }}>
              <strong style={{ display: 'block', marginBottom: 8 }}>Minha foto no chat</strong>
              <SeletorAvatar nome={usuario.nome} foto={usuario.foto} avatar={usuario.avatar} aoSalvar={aoSalvarPerfil} />
            </div>
            <button className="btn-sair" onClick={aoSair}>Sair</button>
          </>
        )}
      </main>

      <nav>
        <button className={aba === 'inicio' ? 'ativo' : ''} onClick={() => setAba('inicio')}><Home size={22} /><span>Início</span></button>
        <button className={aba === 'triagem' ? 'ativo' : ''} onClick={() => setAba('triagem')}>
          <span className="icone-aba"><Stethoscope size={22} />{semTriagem.length > 0 && <i className="bolinha" />}</span>
          <span>Triagem</span>
        </button>
        <button className={aba === 'agenda' ? 'ativo' : ''} onClick={() => setAba('agenda')}><CalendarDays size={22} /><span>Agenda</span></button>
        <button className={aba === 'chat' ? 'ativo' : ''} onClick={() => setAba('chat')}>
          <span className="icone-aba"><MessagesSquare size={22} />{mensagens.length > chatVisto && <i className="bolinha" />}</span>
          <span>Chat</span>
        </button>
        <button className={aba === 'perfil' ? 'ativo' : ''} onClick={() => setAba('perfil')}><User size={22} /><span>Perfil</span></button>
      </nav>
    </div>
  );
}

function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [conta, setConta] = useState(CONFIGURADO ? null : lerLocal('sd-conta', null));       // quem entrou (Google ou e-mail)
  const [cadastro, setCadastro] = useState(CONFIGURADO ? null : lerLocal('sd-cadastro', null)); // documento voluntarios/{uid}

  // Sem Firebase, a conta e o cadastro ficam salvos no aparelho (não pede
  // login toda vez — comportamento de aplicativo de verdade)
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-conta', conta); }, [conta]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('sd-cadastro', cadastro); }, [cadastro]);

  const [erroInicial, setErroInicial] = useState('');

  const largou = useRef(false); // depois que o app abriu, erro avulso não pode travar tudo

  useEffect(() => {
    if (!CONFIGURADO) return;
    // Qualquer erro na largada vira tela visível (nada de app "que não abre")
    const pega = (e) => {
      if (largou.current) return;
      const m = String(e?.reason?.message || e?.message || e?.type || e || '');
      // "Script error." = barulho de script de fora (Google etc.), sem
      // informação nenhuma — não é falha nossa, não trava o app por isso
      if (!m || m === 'error' || m.toLowerCase().includes('script error')) return;
      setErroInicial(atual => atual || m);
    };
    window.addEventListener('unhandledrejection', pega);
    window.addEventListener('error', pega);
    let soltarAuth = null, soltarDoc = null;
    ligarFirebase().then(() => {
      // Completa o login por redirect (plano B só do navegador; no iPhone o
      // login é nativo e este caminho carregaria script que quebra o app)
      if (!window.__loginGoogleNativo && !window.__entrarNativoGoogle) fb.fns.getRedirectResult?.(fb.auth).catch(() => {});
      soltarAuth = fb.fns.onAuthStateChanged(fb.auth, u => {
        soltarDoc?.(); soltarDoc = null;
        largou.current = true;
        if (!u) { setConta(null); setCadastro(null); setPronto(true); return; }
        setConta({ uid: u.uid, email: u.email, nome: u.displayName || u.email, foto: u.photoURL || '' });
        // O cadastro fica em voluntarios/{uid}: se não existe, o voluntário
        // preenche a solicitação; quando a central aprovar (status "ativo"),
        // o app libera sozinho — o snapshot chega em tempo real.
        const { doc, onSnapshot } = fb.fns;
        soltarDoc = onSnapshot(doc(fb.db, 'voluntarios', u.uid), snap => {
          setCadastro(snap.exists() ? snap.data() : null);
          setPronto(true);
        });
      });
    }).catch(e => { setErroInicial(String(e?.message || e)); setPronto(true); });
    return () => { soltarDoc?.(); soltarAuth?.(); window.removeEventListener('unhandledrejection', pega); window.removeEventListener('error', pega); };
  }, []);

  async function enviarCadastro(f) {
    // A foto/dentinho escolhidos no formulário valem mais que a foto do Google
    const dados = { foto: conta.foto || '', ...f, email: conta.email || '', status: 'pendente', ativo: false };
    if (!CONFIGURADO) { setCadastro(dados); return; }
    const { doc, setDoc, serverTimestamp } = fb.fns;
    setDoc(doc(fb.db, 'voluntarios', conta.uid), { ...dados, solicitadoEm: serverTimestamp() }).catch(() => {});
  }

  // Editar a foto/dentinho depois, pela aba Perfil
  async function salvarPerfil(campos) {
    if (!CONFIGURADO) { setCadastro(c => ({ ...c, ...campos })); return; }
    const { doc, setDoc } = fb.fns;
    setDoc(doc(fb.db, 'voluntarios', conta.uid), campos, { merge: true }).catch(() => {});
  }

  async function sair() {
    if (CONFIGURADO) await fb.fns.signOut(fb.auth);
    setConta(null);
    setCadastro(null);
  }

  // A abertura animada cobre a tela nos primeiros ~3s de cada entrada do zero
  const [abrindo, setAbrindo] = useState(true);
  const abertura = abrindo ? <Abertura tema="dourado" nome="Semeador" frase="quem planta, colhe" aoTerminar={() => setAbrindo(false)} /> : null;

  let conteudo;
  if (erroInicial) conteudo = (
    <div className="tela-login">
      <LogoApp tamanho={110} />
      <h1>Ops, algo travou</h1>
      <p className="login-sub">Erro técnico na largada — manda um print desta tela:<br /><b>{erroInicial}</b></p>
      <button className="btn-principal" onClick={() => window.location.reload()}>Tentar de novo</button>
    </div>
  );
  else if (!pronto) conteudo = <div className="carregando"><LogoApp tamanho={96} /></div>;
  else if (!conta) conteudo = <TelaLogin aoEntrarDemo={setConta} />;
  else if (!cadastro) conteudo = <TelaCadastro usuario={conta} aoEnviar={enviarCadastro} />;
  else if (cadastro.status === 'pendente') conteudo = <TelaAguardando usuario={conta} aoSair={sair} aoSimularAprovacao={() => setCadastro({ ...cadastro, status: 'ativo', ativo: true })} />;
  else if (cadastro.status === 'recusado') conteudo = <TelaRecusado aoSair={sair} />;
  else conteudo = <TelaPrincipal usuario={{ ...conta, ...cadastro }} aoSair={sair} aoSalvarPerfil={salvarPerfil} />;
  return <>{conteudo}{abertura}</>;
}

// A trava __appJaSubiu impede o app de subir duas vezes na casca viva do
// iPhone (se o plano B embutido entrar e o código da hospedagem chegar depois)
if (!window.__appJaSubiu) {
  window.__appJaSubiu = true;
  ligarGestoVoltar(); // arrastar da esquerda para a direita = voltar
  createRoot(document.getElementById('root')).render(<App />);
}
