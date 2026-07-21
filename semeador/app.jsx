// ═══════════════════════════════════════════════════════════════════════════
//  SEMEADOR — aplicativo do voluntário do projeto Seja Semente
//
//  O aplicativo conversa com a central (o programa Windows instalado na
//  máquina do projeto) através do Firebase: os dois leem e escrevem no
//  mesmo banco (Firestore), em tempo real. O contrato de dados que os dois
//  lados seguem está descrito em PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from './firebase-config.js';

// ─── Modo demonstração: enquanto o Firebase não estiver configurado, o app
//     roda sozinho com dados de exemplo para dar pra ver e testar tudo ───
const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null; // { auth, db, fns } — só existe quando o Firebase está ligado

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } = await import('firebase/auth');
  const { getFirestore, collection, doc, onSnapshot, updateDoc, query, orderBy } = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  fb = {
    auth: getAuth(app),
    db: getFirestore(app),
    fns: { onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, onSnapshot, updateDoc, query, orderBy },
  };
}

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'demo-1', nome: 'Voluntário de Teste', ministerio: 'Acolhimento' },
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo ao Semeador!', texto: 'Este é o aplicativo do voluntário do Seja Semente. Aqui você recebe avisos da central, vê suas escalas e confirma presença.', criadoEm: new Date(), autor: 'Central' },
    { id: 'a2', titulo: 'Mutirão de sábado', texto: 'Neste sábado teremos mutirão de arrecadação de alimentos. Quem puder chegar às 8h, a van sai do ponto de encontro às 8h30.', criadoEm: new Date(Date.now() - 864e5), autor: 'Coordenação' },
  ],
  escalas: [
    { id: 'e1', data: proximoDia(6), hora: '08:00', ministerio: 'Acolhimento', local: 'Sede Seja Semente', voluntarios: [{ uid: 'demo-1', nome: 'Voluntário de Teste' }], confirmados: {} },
    { id: 'e2', data: proximoDia(0), hora: '17:30', ministerio: 'Distribuição', local: 'Praça Central', voluntarios: [{ uid: 'demo-1', nome: 'Voluntário de Teste' }], confirmados: { 'demo-1': true } },
  ],
  centralOnline: false,
};

function proximoDia(diaSemana) {
  const d = new Date();
  d.setDate(d.getDate() + ((diaSemana - d.getDay() + 7) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

// ─── Utilidades ───
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
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

function TelaLogin({ aoEntrar }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  async function entrar() {
    setErro('');
    if (!CONFIGURADO) {
      aoEntrar({ ...DEMO.usuario, nome: nome.trim() || DEMO.usuario.nome });
      return;
    }
    setCarregando(true);
    try {
      await fb.fns.signInWithEmailAndPassword(fb.auth, email.trim(), senha);
    } catch (e) {
      setErro('Não consegui entrar. Confira o e-mail e a senha.');
    }
    setCarregando(false);
  }

  return (
    <div className="tela-login">
      <div className="login-logo">🌱</div>
      <h1>Semeador</h1>
      <p className="login-sub">Aplicativo do voluntário · Seja Semente</p>
      {CONFIGURADO ? (
        <>
          <input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          <input placeholder="Senha" type="password" value={senha} onChange={e => setSenha(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} />
        </>
      ) : (
        <>
          <div className="faixa-demo">Modo demonstração — o Firebase ainda não foi configurado (veja semeador/README.md)</div>
          <input placeholder="Seu nome" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && entrar()} />
        </>
      )}
      {erro && <div className="erro">{erro}</div>}
      <button className="btn-principal" onClick={entrar} disabled={carregando}>
        {carregando ? 'Entrando…' : 'Entrar'}
      </button>
    </div>
  );
}

function CartaoAviso({ aviso }) {
  return (
    <div className="cartao">
      <div className="cartao-topo">
        <strong>{aviso.titulo}</strong>
        <span className="quando">{horaBonita(aviso.criadoEm)}</span>
      </div>
      <p>{aviso.texto}</p>
      {aviso.autor && <div className="autor">— {aviso.autor}</div>}
    </div>
  );
}

function CartaoEscala({ escala, uid, aoConfirmar }) {
  const confirmado = !!escala.confirmados?.[uid];
  return (
    <div className="cartao">
      <div className="cartao-topo">
        <strong>{escala.ministerio}</strong>
        <span className="quando">{dataBonita(escala.data)} · {escala.hora}</span>
      </div>
      {escala.local && <p>📍 {escala.local}</p>}
      <div className="linha-confirma">
        {confirmado
          ? <span className="ok">✓ Presença confirmada</span>
          : <button className="btn-confirmar" onClick={() => aoConfirmar(escala)}>Confirmar presença</button>}
      </div>
    </div>
  );
}

function Vazio({ texto }) {
  return <div className="vazio">{texto}</div>;
}

function TelaPrincipal({ usuario, aoSair }) {
  const [aba, setAba] = useState('inicio');
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : DEMO.avisos);
  const [escalas, setEscalas] = useState(CONFIGURADO ? [] : DEMO.escalas);
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
    const paraEscalas = onSnapshot(
      query(collection(fb.db, 'escalas'), orderBy('data')),
      snap => setEscalas(snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.voluntarios?.some(v => v.uid === usuario.uid)))
    );
    // Batimento da central: o programa Windows atualiza central/status a cada
    // minuto; se o último batimento tem menos de 3 minutos, ela está online.
    const paraCentral = onSnapshot(doc(fb.db, 'central', 'status'), snap => {
      const s = snap.data();
      const ultimo = s?.atualizadoEm?.toDate?.();
      setCentralOnline(!!ultimo && Date.now() - ultimo.getTime() < 3 * 60 * 1000);
    });
    return () => { paraAvisos(); paraEscalas(); paraCentral(); };
  }, [usuario.uid]);

  async function confirmar(escala) {
    if (!CONFIGURADO) {
      setEscalas(es => es.map(e => e.id === escala.id ? { ...e, confirmados: { ...e.confirmados, [usuario.uid]: true } } : e));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'escalas', escala.id), { [`confirmados.${usuario.uid}`]: true });
  }

  return (
    <div className="tela-principal">
      <header>
        <div className="header-titulo">
          <span className="logo-mini">🌱</span>
          <div>
            <strong>Semeador</strong>
            <div className={centralOnline ? 'status online' : 'status'}>
              {centralOnline ? '● Central conectada' : '○ Central offline'}
            </div>
          </div>
        </div>
      </header>

      <main>
        {aba === 'inicio' && (
          <>
            <h2>Avisos</h2>
            {avisos.length ? avisos.map(a => <CartaoAviso key={a.id} aviso={a} />) : <Vazio texto="Nenhum aviso por enquanto." />}
          </>
        )}
        {aba === 'escalas' && (
          <>
            <h2>Minhas escalas</h2>
            {escalas.length ? escalas.map(e => <CartaoEscala key={e.id} escala={e} uid={usuario.uid} aoConfirmar={confirmar} />) : <Vazio texto="Você ainda não está em nenhuma escala." />}
          </>
        )}
        {aba === 'perfil' && (
          <>
            <h2>Meu perfil</h2>
            <div className="cartao">
              <p><strong>{usuario.nome}</strong></p>
              {usuario.ministerio && <p>Ministério: {usuario.ministerio}</p>}
              {usuario.email && <p>{usuario.email}</p>}
            </div>
            <button className="btn-sair" onClick={aoSair}>Sair</button>
          </>
        )}
      </main>

      <nav>
        <button className={aba === 'inicio' ? 'ativo' : ''} onClick={() => setAba('inicio')}>🏠<span>Início</span></button>
        <button className={aba === 'escalas' ? 'ativo' : ''} onClick={() => setAba('escalas')}>📅<span>Escalas</span></button>
        <button className={aba === 'perfil' ? 'ativo' : ''} onClick={() => setAba('perfil')}>👤<span>Perfil</span></button>
      </nav>
    </div>
  );
}

function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [usuario, setUsuario] = useState(null);

  useEffect(() => {
    if (!CONFIGURADO) return;
    let soltar = null;
    ligarFirebase().then(() => {
      soltar = fb.fns.onAuthStateChanged(fb.auth, async u => {
        if (!u) { setUsuario(null); setPronto(true); return; }
        // O cadastro do voluntário (nome, ministério…) fica em voluntarios/{uid},
        // preenchido pela central no programa Windows.
        const { doc, onSnapshot } = fb.fns;
        onSnapshot(doc(fb.db, 'voluntarios', u.uid), snap => {
          setUsuario({ uid: u.uid, email: u.email, nome: u.email, ...snap.data() });
          setPronto(true);
        });
      });
    });
    return () => soltar?.();
  }, []);

  async function sair() {
    if (CONFIGURADO) await fb.fns.signOut(fb.auth);
    setUsuario(null);
  }

  if (!pronto) return <div className="carregando">🌱</div>;
  if (!usuario) return <TelaLogin aoEntrar={setUsuario} />;
  return <TelaPrincipal usuario={usuario} aoSair={sair} />;
}

createRoot(document.getElementById('root')).render(<App />);
