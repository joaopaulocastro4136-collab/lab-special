// ═══════════════════════════════════════════════════════════════════════════
//  SEJA SEMENTE — aplicativo central do projeto (versão mobile)
//
//  Fluxo da clínica, na ordem da barra de baixo:
//    1. CADASTRO — a ficha inicial do paciente (nome, contato)
//    2. TRIAGEM — o formulário de diagnóstico (saúde + tipo de procedimento)
//       e as caixinhas por procedimento com o TOTAL de pacientes de cada um
//    3. PACIENTES — todos os pacientes (toque abre a ficha com fotos)
//    4. AGENDAMENTO — marca o paciente com o voluntário/dentista, vendo os
//       horários já ocupados dele no dia
//    5. VOLUNTÁRIOS — solicitações e equipe; toque abre o voluntário com a
//       agenda dele
//    6. PERFIL — quem está usando a central
//  Avisos ficam no sino do topo. Tudo conversa com o Semeador em tempo real
//  pelo Firebase — contrato em ../PONTE.md.
// ═══════════════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { FIREBASE_CONFIG } from '../firebase-config.js';
import { Bolha, lerLocal, gravarLocal, corDoNome, Abertura, GoogleG, BrotoMini } from '../logo.jsx';
import { UserPlus, Stethoscope, ClipboardList, CalendarDays, Users, User, Megaphone, Bell, TriangleAlert, Sparkles, HeartPulse, Wrench, Syringe, Scissors, Crown, ClipboardCheck, Plus, ChevronLeft, ChevronRight, Scan, Camera, Tag, Clock, Inbox, Mail, Lock, Eye, EyeOff, Flag } from 'lucide-react';
import { FichaPaciente, comprimirImagem } from '../ficha.jsx';
import icone from '../icones/icone-central-1024.png';

function LogoApp({ tamanho = 120 }) {
  return <img src={icone} width={tamanho} height={tamanho} alt="Seja Semente"
    style={{ display: 'block', borderRadius: tamanho * 0.24, boxShadow: tamanho >= 90 ? '0 12px 30px rgba(30,43,34,0.20)' : 'none' }} />;
}

const CONFIGURADO = FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.startsWith('COLE');

let fb = null;

async function ligarFirebase() {
  const { initializeApp } = await import('firebase/app');
  const modAuth = await import('firebase/auth');
  const modFs = await import('firebase/firestore');
  const app = initializeApp(FIREBASE_CONFIG);
  // Dentro do aplicativo do iPhone (WebView), o jeito padrão de iniciar a
  // autenticação e o banco falha — estes dois ajustes são os recomendados:
  let auth;
  if (window.__entrarNativoGoogle) {
    // iPhone (WKWebView): inicialização especial recomendada
    try {
      auth = modAuth.initializeAuth(app, {
        persistence: [modAuth.indexedDBLocalPersistence, modAuth.browserLocalPersistence],
        popupRedirectResolver: modAuth.browserPopupRedirectResolver,
      });
    } catch (e) { auth = modAuth.getAuth(app); }
  } else {
    // Navegador/computador: o padrão já configura o login web (Google) certo
    auth = modAuth.getAuth(app);
  }
  const db = modFs.initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  fb = { auth, db, fns: { ...modAuth, ...modFs } };
}

// ─── Procedimentos (as caixinhas da triagem) e ficha de saúde ───
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
const OPCOES_DURACAO = [15, 20, 30, 40, 45, 60, 90, 120];

// Um paciente pode precisar de vários procedimentos ao mesmo tempo
// (aceita também os formatos antigos: `area` e `procedimento`)
function areasDoPaciente(p) {
  const t = p?.triagem;
  if (!t) return [];
  if (Array.isArray(t.areas)) return t.areas;
  if (t.area) return [t.area];
  return t.procedimento ? [t.procedimento] : [];
}

function horaFim(hora, dur) {
  const [h, m] = String(hora || '00:00').split(':').map(Number);
  const total = h * 60 + m + (dur || DURACAO_PADRAO);
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
function conflita(hora, dur, g) {
  const ini = t => { const [h, m] = String(t || '00:00').split(':').map(Number); return h * 60 + m; };
  const a1 = ini(hora), a2 = a1 + (dur || DURACAO_PADRAO);
  const b1 = ini(g.hora), b2 = b1 + (g.duracaoMin || DURACAO_PADRAO);
  return a1 < b2 && b1 < a2;
}
const CONDICOES_SAUDE = ['Hipertensão / pressão alta', 'Diabetes', 'Problema cardíaco', 'Alergia a medicamento', 'Medicação contínua', 'Gestante'];
const PROXIMO_STATUS = { 'triado': 'em atendimento', 'em atendimento': 'concluído', 'concluído': 'triado' };

// ─── Dados de exemplo do modo demonstração ───
const DEMO = {
  usuario: { uid: 'central-demo', nome: 'Coordenação (teste)' },
  pacientes: [
    { id: 'p1', codigo: 'SS-0001', nome: 'José da Silva', idade: '52', telefone: '(11) 98888-1111', observacoes: 'Sente dor no dente há duas semanas.', status: 'triado', criadoEm: new Date(), triagem: { areas: ['Cirurgia', 'Raio-X'], saude: ['Hipertensão / pressão alta'], outrasCondicoes: '' } },
    { id: 'p2', codigo: 'SS-0002', nome: 'Ana Paula', idade: '34', telefone: '(11) 94444-2222', observacoes: 'Chegou pela campanha do agasalho.', status: 'cadastrado', criadoEm: new Date(Date.now() - 864e5), triagem: null },
    { id: 'p3', codigo: 'SS-0003', nome: 'Carlos Mendes', idade: '41', telefone: '(11) 97777-2222', observacoes: '', status: 'em atendimento', prioridade: true, criadoEm: new Date(Date.now() - 3 * 864e5), triagem: { areas: ['Prótese'], saude: ['Diabetes', 'Medicação contínua'], outrasCondicoes: 'Insulina 2x ao dia' } },
  ],
  agendamentos: [
    { id: 'g1', area: 'Cirurgia', titulo: 'Cirurgia (extração)', pacienteId: 'p1', pacienteNome: 'José da Silva', data: hojeISO(), hora: '14:00', profissionalUid: 'v1', profissionalNome: 'Maria Souza', origem: 'central', criadoEm: new Date() },
  ],
  avisos: [
    { id: 'a1', titulo: 'Bem-vindo à central Seja Semente!', texto: 'Fluxo: cadastre o paciente, faça a triagem, e agende com o voluntário.', autor: 'Sistema', criadoEm: new Date() },
  ],
  voluntarios: [
    { id: 'v1', nome: 'Maria Souza', ministerio: 'Dentista', telefone: '(11) 91234-5678', status: 'ativo', ativo: true },
    { id: 'v2', nome: 'Pedro Lima', ministerio: 'Dentista', telefone: '(11) 99876-5432', status: 'ativo', ativo: true },
    { id: 'v3', nome: 'Lucas Andrade', email: 'lucas.andrade@gmail.com', telefone: '(11) 95555-4444', cpf: '123.456.789-00', nascimento: '1995-03-14', status: 'pendente', ativo: false },
  ],
};

function hojeISO() { return new Date().toISOString().slice(0, 10); }
function somaDias(iso, n) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function dataBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`;
}
function dataNascimentoBonita(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}
function areaDe(nome) { return AREAS.find(a => a.nome === nome); }

// ═══════════════════════════════════════════════════════════════════════════
//  Telas
// ═══════════════════════════════════════════════════════════════════════════

function TelaLogin({ aoEntrarDemo }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [novaConta, setNovaConta] = useState(false);

  async function entrarGoogle() {
    setErro('');
    if (!CONFIGURADO) {
      aoEntrarDemo({ ...DEMO.usuario });
      return;
    }
    setCarregando(true);
    try {
      if (window.__entrarNativoGoogle) await window.__entrarNativoGoogle(fb.auth);
      else {
        // No computador/navegador o mais confiável é navegar a própria
        // página para o Google e voltar logado (janelinha é bloqueada no Mac)
        await fb.fns.signInWithRedirect(fb.auth, new fb.fns.GoogleAuthProvider());
        return; // a página vai para o Google
      }
    } catch (e) {
      if (!String(e?.message || '').includes('cancelado')) {
        setErro('Google não entrou — código: ' + (e?.code || '') + ' · ' + String(e?.message || e).slice(0, 160));
        console.log('detalhe login Google:', e?.code || '', e?.message || e);
      }
    }
    setCarregando(false);
  }

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
      <h1>Seja Semente</h1>
      <p className="login-etiqueta">Central do projeto</p>
      <div className="divisor-broto"><i /><BrotoMini tamanho={19} /><i /></div>
      <p className="missao">Um mundo onde cada semente pode <em>florescer</em>.</p>
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

function Campo({ rotulo, children }) {
  return <label className="campo"><span>{rotulo}</span>{children}</label>;
}

// TRIAGEM: o formulário de diagnóstico do paciente (vários procedimentos)
function FormTriagem({ paciente, areas, aoAdicionarTipo, aoSalvar, aoCancelar }) {
  const inicial = paciente.triagem;
  const [f, setF] = useState({
    areas: inicial ? (Array.isArray(inicial.areas) ? inicial.areas : (inicial.area ? [inicial.area] : [])) : [],
    saude: inicial?.saude || [],
    outrasCondicoes: inicial?.outrasCondicoes || '',
  });
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
          {CONDICOES_SAUDE.map(c => (
            <label key={c} className={f.saude.includes(c) ? 'caixa marcada' : 'caixa'}>
              <input type="checkbox" checked={f.saude.includes(c)} onChange={() => alternaSaude(c)} />
              {c}
            </label>
          ))}
        </div>
      </div>
      <Campo rotulo="Outras condições de saúde"><input value={f.outrasCondicoes} onChange={e => setF({ ...f, outrasCondicoes: e.target.value })} placeholder="Ex.: cirurgia recente, asma…" /></Campo>
      <p className="dica">Depois da triagem, o paciente entra nas caixinhas dos procedimentos marcados e já pode ser agendado com um voluntário.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={f.areas.length === 0} onClick={() => aoSalvar(f)}>Concluir triagem</button>
      </div>
    </div>
  );
}

// Cadastro manual de voluntário/dentista (sem celular, feito pela central)
function FormVoluntario({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ nome: '', ministerio: '', telefone: '', email: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="folha">
      <h2>Novo voluntário / dentista</h2>
      <Campo rotulo="Nome"><input value={f.nome} onChange={muda('nome')} /></Campo>
      <Campo rotulo="Função / especialidade"><input value={f.ministerio} onChange={muda('ministerio')} placeholder="Ex.: Dentista" /></Campo>
      <Campo rotulo="Telefone"><input value={f.telefone} onChange={muda('telefone')} inputMode="tel" /></Campo>
      <Campo rotulo="E-mail (opcional)"><input value={f.email} onChange={muda('email')} type="email" placeholder="para quando ele entrar no aplicativo" /></Campo>
      <p className="dica">Ele já entra na equipe e pode receber agendamentos. Se um dia baixar o Semeador e entrar com este e-mail, fica fácil localizar e ligar os atendimentos dele.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.nome.trim()} onClick={() => aoSalvar(f)}>Adicionar</button>
      </div>
    </div>
  );
}

// AGENDAMENTO: paciente + voluntário. CADA procedimento marcado vira UM
// agendamento próprio — os horários se emendam pelo tempo de cada um, e
// cada linha pode ter a hora ajustada à mão.
function FormMarcar({ pacientes, voluntarios, agendamentos, dataInicial, pacienteInicial, areaInicial, todasAreas, duracaoDe, aoSalvar, aoCancelar }) {
  const triados = pacientes.filter(p => p.triagem)
    .sort((a, b) => (b.prioridade ? 1 : 0) - (a.prioridade ? 1 : 0)); // prioridade primeiro
  const primeiro = pacienteInicial || triados[0];
  const [f, setF] = useState({
    pacienteId: primeiro?.id || '',
    profissionalUid: voluntarios[0]?.id || '',
    data: dataInicial, horaInicio: '08:00',
  });
  const [marcadas, setMarcadas] = useState(areaInicial ? [areaInicial] : areasDoPaciente(primeiro));
  const [horasProprias, setHorasProprias] = useState({}); // procedimento → hora fixada à mão
  const [profsProprios, setProfsProprios] = useState({}); // procedimento → profissional próprio
  const [salvando, setSalvando] = useState(false);
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  const mudaPaciente = e => {
    const p = triados.find(x => x.id === e.target.value);
    setF({ ...f, pacienteId: e.target.value });
    setMarcadas(areasDoPaciente(p));
    setHorasProprias({});
    setProfsProprios({});
  };
  const alterna = nome => setMarcadas(m => m.includes(nome) ? m.filter(x => x !== nome) : [...m, nome]);
  const pac = triados.find(p => p.id === f.pacienteId);
  const prof = voluntarios.find(p => p.id === f.profissionalUid);
  const areasPac = areasDoPaciente(pac);
  const ocupadosDe = uid => agendamentos
    .filter(g => g.profissionalUid === uid && g.data === f.data)
    .sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const ocupados = ocupadosDe(f.profissionalUid);

  // A sequência: um agendamento por procedimento, um começando no fim do
  // outro — e cada um pode ter um profissional diferente
  const sequencia = [];
  let cursor = f.horaInicio;
  for (const nome of areasPac.filter(a => marcadas.includes(a))) {
    const hora = horasProprias[nome] || cursor;
    const dur = duracaoDe(nome);
    const profUid = profsProprios[nome] || f.profissionalUid;
    const profDele = voluntarios.find(p => p.id === profUid);
    const choque = ocupadosDe(profUid).find(g => conflita(hora, dur, g));
    sequencia.push({ nome, hora, dur, fim: horaFim(hora, dur), profUid, profNome: profDele?.nome || '', choque });
    cursor = horaFim(hora, dur);
  }

  async function agendarTodos() {
    setSalvando(true);
    await aoSalvar(sequencia.map(s => {
      const area = todasAreas.find(a => a.nome === s.nome);
      return {
        area: s.nome,
        titulo: s.nome + (area?.detalhe ? ` (${area.detalhe})` : ''),
        duracaoMin: s.dur,
        pacienteId: pac.id, pacienteNome: pac.nome,
        profissionalUid: s.profUid, profissionalNome: s.profNome,
        data: f.data, hora: s.hora,
      };
    }));
  }

  return (
    <div className="folha">
      <h2>Agendar paciente</h2>
      {triados.length === 0 && <p className="dica">Nenhum paciente com triagem ainda — faça a triagem primeiro.</p>}
      <Campo rotulo="Paciente">
        <select value={f.pacienteId} onChange={mudaPaciente}>
          {triados.map(p => <option key={p.id} value={p.id}>{p.prioridade ? '★ ' : ''}{p.codigo ? `${p.codigo} · ` : ''}{p.nome}{p.prioridade ? ' — PRIORIDADE' : ''}</option>)}
        </select>
      </Campo>
      {areasPac.length > 0 && (
        <div className="campo"><span>Procedimentos a agendar (cada um vira um agendamento)</span>
          <div className="caixas">
            {areasPac.map(nome => {
              const a = todasAreas.find(x => x.nome === nome);
              return (
                <label key={nome} className={marcadas.includes(nome) ? 'caixa marcada' : 'caixa'} onClick={() => alterna(nome)}>
                  {a?.Icone && <a.Icone size={15} style={{ color: a.cor }} />}{nome} · {duracaoDe(nome)} min
                </label>
              );
            })}
          </div>
        </div>
      )}
      <Campo rotulo="Voluntário / dentista padrão (dá pra trocar por procedimento ali embaixo)">
        <select value={f.profissionalUid} onChange={e => { setF({ ...f, profissionalUid: e.target.value }); setProfsProprios({}); }}>
          {voluntarios.map(p => <option key={p.id} value={p.id}>{p.nome}{p.ministerio ? ` — ${p.ministerio}` : ''}</option>)}
        </select>
      </Campo>
      <Campo rotulo="Data"><input type="date" value={f.data} onChange={muda('data')} /></Campo>
      <Campo rotulo="Hora de início"><input type="time" value={f.horaInicio} onChange={e => { setF({ ...f, horaInicio: e.target.value }); setHorasProprias({}); }} /></Campo>
      {sequencia.length > 0 && (
        <div className="campo"><span>Como fica ({sequencia.length} agendamento{sequencia.length === 1 ? '' : 's'})</span>
          {sequencia.map(s => (
            <div key={s.nome} className="linha-sequencia">
              <div className="seq-topo">
                <strong>{s.nome}</strong>
                <span className="seq-tempo">{s.hora}–{s.fim} · {s.dur} min</span>
                <input type="time" value={s.hora} onChange={e => setHorasProprias(h => ({ ...h, [s.nome]: e.target.value }))} />
              </div>
              <select className="seq-prof" value={s.profUid} onChange={e => setProfsProprios(m => ({ ...m, [s.nome]: e.target.value }))}>
                {voluntarios.map(p => <option key={p.id} value={p.id}>com {p.nome}{p.ministerio ? ` — ${p.ministerio}` : ''}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
      {prof && (
        <p className="dica">
          {ocupados.length
            ? `Horários já ocupados de ${prof.nome} em ${dataBonita(f.data)}: ${ocupados.map(g => `${g.hora}–${horaFim(g.hora, g.duracaoMin)}`).join(', ')}`
            : `${prof.nome} está com o dia ${dataBonita(f.data)} livre.`}
        </p>
      )}
      {sequencia.filter(s => s.choque).map(s => (
        <p key={s.nome} className="erro">⚠ {s.nome} ({s.hora}–{s.fim}) conflita na agenda de {s.profNome}: {s.choque.pacienteNome || s.choque.titulo} ({s.choque.hora}–{horaFim(s.choque.hora, s.choque.duracaoMin)}). Pode agendar mesmo assim, mas confira.</p>
      ))}
      <p className="dica">Os agendamentos caem na hora na agenda do voluntário, no Semeador dele.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!pac || !prof || sequencia.length === 0 || salvando} onClick={agendarTodos}>
          {salvando ? 'Agendando…' : `Agendar ${sequencia.length > 1 ? `os ${sequencia.length}` : ''}`.trim()}
        </button>
      </div>
    </div>
  );
}

function FormAviso({ aoSalvar, aoCancelar }) {
  const [f, setF] = useState({ titulo: '', texto: '' });
  const muda = k => e => setF({ ...f, [k]: e.target.value });
  return (
    <div className="folha">
      <h2>Novo aviso</h2>
      <Campo rotulo="Título"><input value={f.titulo} onChange={muda('titulo')} /></Campo>
      <Campo rotulo="Texto"><textarea rows={4} value={f.texto} onChange={muda('texto')} /></Campo>
      <p className="dica">O aviso aparece na hora no aplicativo Semeador de todos os voluntários.</p>
      <div className="linha-botoes">
        <button className="btn-secundario" onClick={aoCancelar}>Cancelar</button>
        <button className="btn-principal" disabled={!f.titulo.trim() || !f.texto.trim()} onClick={() => aoSalvar(f)}>Publicar</button>
      </div>
    </div>
  );
}

// Formulário de novo tipo de procedimento (ex.: Pediatria) com o tempo dele
function NovoProcedimento({ aoAdicionar }) {
  const [nome, setNome] = useState('');
  const [dur, setDur] = useState(DURACAO_PADRAO);
  return (
    <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <strong>Adicionar novo procedimento</strong>
      <input className="busca" style={{ margin: 0 }} value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome (ex.: Pediatria)" />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <select value={dur} onChange={e => setDur(Number(e.target.value))}
          style={{ flex: 1, padding: '11px 12px', border: '1.5px solid #DBE3D8', borderRadius: 12, fontSize: 15, background: '#fff' }}>
          {OPCOES_DURACAO.map(d => <option key={d} value={d}>{d} minutos</option>)}
        </select>
        <button className="btn-mais" disabled={!nome.trim()} onClick={async () => { await aoAdicionar(nome.trim(), dur); setNome(''); }}>+ Adicionar</button>
      </div>
    </div>
  );
}

function TelaPrincipal({ usuario, aoSair }) {
  const [aba, setAba] = useState('cadastro');
  const [tela, setTela] = useState(null); // null | 'avisos' | 'novoAviso' | 'marcar' | {triagem} | {area} | {voluntario}
  const [dia, setDia] = useState(hojeISO());
  const [cadastradoMsg, setCadastradoMsg] = useState('');
  const [novo, setNovo] = useState({ nome: '', idade: '', telefone: '', observacoes: '', prioridade: false });
  const [fotoNovo, setFotoNovo] = useState('');
  const [buscaPacientes, setBuscaPacientes] = useState('');
  const [buscaArea, setBuscaArea] = useState('');
  const [visaoAgenda, setVisaoAgenda] = useState('dia'); // 'dia' | 'sem'
  const [configProc, setConfigProc] = useState(CONFIGURADO ? { personalizados: [], duracoes: {} } : lerLocal('ss-config-proc', { personalizados: [], duracoes: {} }));
  const [pacientes, setPacientes] = useState(CONFIGURADO ? [] : lerLocal('ss-pacientes', DEMO.pacientes));
  const [agendamentos, setAgendamentos] = useState(CONFIGURADO ? [] : lerLocal('ss-agendamentos', DEMO.agendamentos));
  const [avisos, setAvisos] = useState(CONFIGURADO ? [] : lerLocal('ss-avisos', DEMO.avisos));
  const [voluntarios, setVoluntarios] = useState(CONFIGURADO ? [] : lerLocal('ss-voluntarios', DEMO.voluntarios));

  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-pacientes', pacientes); }, [pacientes]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-agendamentos', agendamentos); }, [agendamentos]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-avisos', avisos); }, [avisos]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-voluntarios', voluntarios); }, [voluntarios]);
  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-config-proc', configProc); }, [configProc]);

  // Configuração dos procedimentos (tipos personalizados + tempos)
  useEffect(() => {
    if (!CONFIGURADO) return;
    const { doc, onSnapshot } = fb.fns;
    return onSnapshot(doc(fb.db, 'config', 'procedimentos'), snap => {
      if (snap.exists()) setConfigProc({ personalizados: [], duracoes: {}, ...snap.data() });
    });
  }, []);

  async function salvarConfig(nova) {
    setConfigProc(nova);
    if (!CONFIGURADO) return;
    const { doc, setDoc } = fb.fns;
    await setDoc(doc(fb.db, 'config', 'procedimentos'), nova);
  }

  // Todas as áreas: as fixas + as adicionadas pela central (ex.: Pediatria)
  const todasAreas = [
    ...AREAS,
    ...(configProc.personalizados || []).map(p => ({ nome: p.nome, detalhe: p.detalhe || '', Icone: Tag, cor: corDoNome(p.nome), personalizado: true })),
  ];
  const duracaoDe = nome => configProc.duracoes?.[nome] || DURACAO_PADRAO;

  async function adicionarTipo(nome) {
    if (todasAreas.some(a => a.nome.toLowerCase() === nome.toLowerCase())) return;
    await salvarConfig({
      ...configProc,
      personalizados: [...(configProc.personalizados || []), { nome, detalhe: '' }],
    });
  }

  useEffect(() => {
    if (!CONFIGURADO) return;
    const { collection, onSnapshot, query, orderBy } = fb.fns;
    const escuta = (col, ord, poe) => onSnapshot(query(collection(fb.db, col), orderBy(...ord)), s => poe(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const soltar = [
      escuta('pacientes', ['criadoEm', 'desc'], setPacientes),
      escuta('agendamentos', ['hora'], setAgendamentos),
      escuta('avisos', ['criadoEm', 'desc'], setAvisos),
      escuta('voluntarios', ['nome'], setVoluntarios),
    ];
    return () => soltar.forEach(s => s());
  }, []);

  useEffect(() => {
    if (!CONFIGURADO) return;
    const { doc, setDoc, serverTimestamp } = fb.fns;
    const bater = () => setDoc(doc(fb.db, 'central', 'status'), { online: true, atualizadoEm: serverTimestamp() }).catch(() => {});
    bater();
    const timer = setInterval(bater, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  async function salvar(col, dados, local, poe) {
    if (!CONFIGURADO) {
      poe(xs => [{ id: 'novo-' + Math.floor(Math.random() * 1e6), ...local, ...dados }, ...xs]);
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    await addDoc(collection(fb.db, col), { ...dados, ...local, criadoEm: serverTimestamp() });
  }

  async function cadastrarPaciente() {
    const nome = novo.nome.trim();
    if (!nome) return;
    // Código do paciente: SS-0001, SS-0002… (continua do maior já usado)
    const maior = Math.max(0, ...pacientes.map(p => parseInt(String(p.codigo || '').replace(/\D/g, ''), 10) || 0));
    const codigo = 'SS-' + String(maior + 1).padStart(4, '0');
    await salvar('pacientes', { ...novo, nome, codigo, foto: fotoNovo || '' }, { status: 'cadastrado', triagem: null, criadoEm: new Date() }, setPacientes);
    setNovo({ nome: '', idade: '', telefone: '', observacoes: '', prioridade: false });
    setFotoNovo('');
    setCadastradoMsg(`${nome} cadastrado com o código ${codigo}! Agora é só fazer a triagem.`);
    setTimeout(() => setCadastradoMsg(''), 6000);
  }

  async function fotoDoCadastro(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dataUrl = await comprimirImagem(file, 0.7, 400);
      setFotoNovo(dataUrl);
    } catch (e2) { /* imagem inválida */ }
  }

  async function salvarEdicaoPaciente(dados) {
    if (!CONFIGURADO) {
      setPacientes(ps => ps.map(p => p.id === fichaId ? { ...p, ...dados } : p));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'pacientes', fichaId), dados);
  }

  async function apagarPaciente() {
    const id = fichaId;
    setFichaId(null);
    if (!CONFIGURADO) {
      setPacientes(ps => ps.filter(p => p.id !== id));
      return;
    }
    const { doc, deleteDoc } = fb.fns;
    await deleteDoc(doc(fb.db, 'pacientes', id));
  }

  async function salvarTriagem(paciente, triagem) {
    if (!CONFIGURADO) {
      setPacientes(ps => ps.map(p => p.id === paciente.id ? { ...p, triagem, status: 'triado' } : p));
      setTela(null);
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'pacientes', paciente.id), { triagem, status: 'triado' });
    setTela(null);
  }

  async function removerAgendamento(g) {
    if (!CONFIGURADO) {
      setAgendamentos(gs => gs.filter(x => x.id !== g.id));
      return;
    }
    const { doc, deleteDoc } = fb.fns;
    await deleteDoc(doc(fb.db, 'agendamentos', g.id));
  }

  async function responderSolicitacao(v, aprovar) {
    const mudanca = aprovar ? { status: 'ativo', ativo: true } : { status: 'recusado', ativo: false };
    if (!CONFIGURADO) {
      setVoluntarios(vs => vs.map(x => x.id === v.id ? { ...x, ...mudanca } : x));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'voluntarios', v.id), mudanca);
  }

  async function mudarStatus(p) {
    if (!p.triagem) return;
    const status = PROXIMO_STATUS[p.status] || 'triado';
    if (!CONFIGURADO) {
      setPacientes(ps => ps.map(x => x.id === p.id ? { ...x, status } : x));
      return;
    }
    const { doc, updateDoc } = fb.fns;
    await updateDoc(doc(fb.db, 'pacientes', p.id), { status });
  }

  const profissionais = voluntarios.filter(v => v.status === 'ativo' || v.ativo === true);

  // ─── Ficha do paciente (dados + fotos do que foi feito) ───
  const [fichaId, setFichaId] = useState(null);
  const [fichaPaciente, setFichaPaciente] = useState(null);
  const [fichaArquivos, setFichaArquivos] = useState([]);
  const [demoArquivos, setDemoArquivos] = useState({});

  useEffect(() => {
    if (!fichaId) { setFichaPaciente(null); setFichaArquivos([]); return; }
    if (!CONFIGURADO) {
      setFichaPaciente(pacientes.find(p => p.id === fichaId) || null);
      setFichaArquivos(demoArquivos[fichaId] || []);
      return;
    }
    const { doc, onSnapshot, collection, query, orderBy } = fb.fns;
    const s1 = onSnapshot(doc(fb.db, 'pacientes', fichaId), snap => setFichaPaciente(snap.exists() ? { id: snap.id, ...snap.data() } : null));
    const s2 = onSnapshot(query(collection(fb.db, 'pacientes', fichaId, 'arquivos'), orderBy('criadoEm', 'desc')), snap => setFichaArquivos(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { s1(); s2(); };
  }, [fichaId, pacientes, demoArquivos]);

  async function salvarArquivo(dataUrl, legenda) {
    const registro = { dataUrl, legenda, autorUid: usuario.uid, autorNome: usuario.nome || '' };
    if (!CONFIGURADO) {
      setDemoArquivos(a => ({ ...a, [fichaId]: [{ id: 'f' + Math.floor(Math.random() * 1e9), ...registro, criadoEm: new Date() }, ...(a[fichaId] || [])] }));
      return;
    }
    const { collection, addDoc, serverTimestamp } = fb.fns;
    await addDoc(collection(fb.db, 'pacientes', fichaId, 'arquivos'), { ...registro, criadoEm: serverTimestamp() });
  }

  // ─── Telas por cima das abas ───
  if (tela?.triagem) return <FormTriagem paciente={tela.triagem} areas={todasAreas} aoAdicionarTipo={adicionarTipo} aoCancelar={() => setTela(null)} aoSalvar={t => salvarTriagem(tela.triagem, t)} />;
  if (tela === 'procedimentos') return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
      <h2>Procedimentos e tempos</h2>
      <p className="dica">Ajuste quanto tempo cada procedimento leva — a agenda usa isso para calcular início e fim de cada paciente no dia.</p>
      {todasAreas.map(a => (
        <div className="cartao" key={a.nome} style={{ padding: '12px 14px' }}>
          <div className="cartao-linha" style={{ alignItems: 'center' }}>
            <span className="caixa-area-icone" style={{ background: a.cor + '22', color: a.cor, width: 40, height: 40 }}><a.Icone size={21} /></span>
            <div style={{ flex: 1 }}>
              <strong>{a.nome}</strong>
              {a.detalhe && <p className="obs" style={{ margin: 0 }}>{a.detalhe}</p>}
            </div>
            <select value={duracaoDe(a.nome)} onChange={async e => salvarConfig({ ...configProc, duracoes: { ...(configProc.duracoes || {}), [a.nome]: Number(e.target.value) } })}
              style={{ padding: '9px 10px', border: '1.5px solid #DBE3D8', borderRadius: 11, fontSize: 15, background: '#fff' }}>
              {OPCOES_DURACAO.map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
            {a.personalizado && (
              <button className="btn-remover" style={{ marginLeft: 6 }} onClick={() => {
                if (!window.confirm(`Remover o procedimento "${a.nome}"?`)) return;
                salvarConfig({ ...configProc, personalizados: (configProc.personalizados || []).filter(p => p.nome !== a.nome) });
              }}>✕</button>
            )}
          </div>
        </div>
      ))}
      <NovoProcedimento aoAdicionar={async (nome, dur) => {
        if (todasAreas.some(a => a.nome.toLowerCase() === nome.toLowerCase())) return;
        await salvarConfig({
          ...configProc,
          personalizados: [...(configProc.personalizados || []), { nome, detalhe: '' }],
          duracoes: { ...(configProc.duracoes || {}), [nome]: dur },
        });
      }} />
    </div>
  );
  if (fichaId) return <FichaPaciente paciente={fichaPaciente} arquivos={fichaArquivos} aoVoltar={() => setFichaId(null)} aoSalvarArquivo={salvarArquivo}
    podeEditar aoSalvarEdicao={salvarEdicaoPaciente} aoApagar={apagarPaciente} aoEditarTriagem={() => fichaPaciente && setTela({ triagem: fichaPaciente })} />;
  if (tela === 'marcar' || tela?.marcarPaciente) return <FormMarcar pacientes={pacientes} voluntarios={profissionais} agendamentos={agendamentos} dataInicial={dia} pacienteInicial={tela?.marcarPaciente || null} areaInicial={tela?.marcarArea || null} todasAreas={todasAreas} duracaoDe={duracaoDe} aoCancelar={() => setTela(null)} aoSalvar={async lista => { for (const f of lista) await salvar('agendamentos', f, { origem: 'central', criadoEm: new Date() }, setAgendamentos); setTela(null); }} />;
  if (tela === 'novoVoluntario') return <FormVoluntario aoCancelar={() => setTela(null)} aoSalvar={async f => { await salvar('voluntarios', f, { status: 'ativo', ativo: true, criadoPelaCentral: true, criadoEm: new Date() }, setVoluntarios); setTela(null); setAba('voluntarios'); }} />;
  if (tela === 'novoAviso') return <FormAviso aoCancelar={() => setTela('avisos')} aoSalvar={async f => { await salvar('avisos', f, { autor: usuario.nome, criadoEm: new Date() }, setAvisos); setTela('avisos'); }} />;

  if (tela === 'avisos') return (
    <div className="folha">
      <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
      <div className="titulo-com-botao"><h2>Avisos</h2><button className="btn-mais" onClick={() => setTela('novoAviso')}>+ Novo</button></div>
      {avisos.length ? avisos.map(a => (
        <div className="cartao" key={a.id}>
          <div className="cartao-linha">
            <Bolha nome={a.titulo} Icone={Megaphone} />
            <div>
              <strong>{a.titulo}</strong>
              <p>{a.texto}</p>
              {a.autor && <div className="obs">— {a.autor}</div>}
            </div>
          </div>
        </div>
      )) : <div className="vazio">Nenhum aviso publicado.</div>}
    </div>
  );

  if (tela === 'entradaTriagem') {
    const pendentes = pacientes.filter(p => !p.triagem);
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
        <h2>Caixa de entrada</h2>
        <p className="dica">Pacientes aguardando triagem:</p>
        {pendentes.length ? pendentes.map(p => (
          <div className="cartao" key={p.id}>
            <div className="cartao-linha">
              <Bolha nome={p.nome} foto={p.foto} />
              <div>
                <div className="cartao-topo"><strong>{p.nome}</strong><span className="chip aguardando">sem triagem</span></div>
                <p className="obs">{[p.codigo, p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
                <button className="btn-triagem" onClick={() => setTela({ triagem: p })}>Fazer triagem</button>
              </div>
            </div>
          </div>
        )) : <div className="vazio">Tudo em dia — nenhuma triagem pendente 🌱</div>}
      </div>
    );
  }
  if (tela?.area) {
    const A = tela.area;
    const filtro = buscaArea.trim().toLowerCase();
    const daAreaTodos = pacientes.filter(p => areasDoPaciente(p).includes(A.nome));
    const daArea = daAreaTodos.filter(p => !filtro || p.nome.toLowerCase().includes(filtro) || String(p.codigo || '').toLowerCase().includes(filtro));
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => { setTela(null); setBuscaArea(''); }}><ChevronLeft size={18} /> Voltar</button>
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
                    <button className={'chip ' + p.status.replace(' ', '-')} onClick={e => { e.stopPropagation(); mudarStatus(p); }}>{p.status}</button>
                  </span>
                </div>
                <p className="obs">{[p.codigo, p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
              </div>
            </div>
          </div>
        )) : <div className="vazio">{filtro ? 'Nenhum paciente encontrado na pesquisa.' : `Nenhum paciente de ${A.nome} ainda.`}</div>}
      </div>
    );
  }

  if (tela?.voluntario) {
    const v = tela.voluntario;
    const dele = agendamentos.filter(g => g.profissionalUid === v.id)
      .sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora));
    return (
      <div className="folha">
        <button className="btn-voltar" onClick={() => setTela(null)}><ChevronLeft size={18} /> Voltar</button>
        <div className="cartao">
          <div className="cartao-linha">
            <Bolha nome={v.nome} />
            <div>
              <strong style={{ fontSize: 18 }}>{v.nome}</strong>
              <p className="obs">{[v.ministerio, v.telefone, v.email].filter(Boolean).join(' · ')}</p>
              {v.cpf && <p className="obs">CPF: {v.cpf}{v.nascimento ? ` · Nascimento: ${dataNascimentoBonita(v.nascimento)}` : ''}</p>}
            </div>
          </div>
        </div>
        <h2 style={{ fontSize: 20, margin: '8px 0 2px' }}>Agenda de {v.nome.split(' ')[0]}</h2>
        {dele.length ? dele.map(g => (
          <div className="cartao" key={g.id} onClick={() => g.pacienteId && setFichaId(g.pacienteId)} style={g.pacienteId ? { cursor: 'pointer' } : undefined}>
            <div className="linha-agenda">
              <div className="hora-col">{g.hora}<span className="hora-fim">{horaFim(g.hora, g.duracaoMin)}</span></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong>{g.pacienteNome || g.titulo}</strong>
                <p className="obs">{dataBonita(g.data)}{g.titulo && g.pacienteNome ? ` · ${g.titulo}` : ''}</p>
              </div>
            </div>
          </div>
        )) : <div className="vazio">Nada agendado para {v.nome.split(' ')[0]} ainda.</div>}
      </div>
    );
  }

  const doDia = agendamentos.filter(g => g.data === dia).sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
  const semTriagem = pacientes.filter(p => !p.triagem);

  return (
    <div className="tela-principal">
      <header>
        <div className="header-titulo">
          <div className="logo-bolha"><LogoApp tamanho={40} /></div>
          <div style={{ flex: 1 }}>
            <strong>Seja Semente</strong>
            <div className="status">Central · {usuario.nome}</div>
          </div>
          <button className="btn-header" onClick={() => setTela('avisos')} title="Avisos"><Bell size={20} /></button>
          <button className="btn-header" onClick={() => setTela('novoAviso')} title="Novo aviso"><Megaphone size={20} /></button>
        </div>
      </header>

      <main>
        {aba === 'cadastro' && (
          <>
            <h2>Cadastro</h2>
            {cadastradoMsg && <div className="banner-ok">✓ {cadastradoMsg}</div>}
            <div className="cartao" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {fotoNovo
                  ? <img src={fotoNovo} alt="rosto" style={{ width: 74, height: 74, borderRadius: 22, objectFit: 'cover' }} />
                  : <div style={{ width: 74, height: 74, borderRadius: 22, background: '#EAF2EC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B897F' }}><Camera size={26} /></div>}
                <label className="btn-acao" style={{ cursor: 'pointer' }}>
                  <Camera size={16} /> {fotoNovo ? 'Trocar foto' : 'Foto do rosto (opcional)'}
                  <input type="file" accept="image/*" onChange={fotoDoCadastro} style={{ display: 'none' }} />
                </label>
                {fotoNovo && <button className="btn-acao vermelho" onClick={() => setFotoNovo('')}>✕</button>}
              </div>
              <Campo rotulo="Nome do paciente"><input value={novo.nome} onChange={e => setNovo({ ...novo, nome: e.target.value })} /></Campo>
              <Campo rotulo="Idade"><input value={novo.idade} onChange={e => setNovo({ ...novo, idade: e.target.value })} inputMode="numeric" /></Campo>
              <Campo rotulo="Telefone"><input value={novo.telefone} onChange={e => setNovo({ ...novo, telefone: e.target.value })} inputMode="tel" /></Campo>
              <Campo rotulo="Observações"><textarea rows={3} value={novo.observacoes} onChange={e => setNovo({ ...novo, observacoes: e.target.value })} /></Campo>
              <label className={novo.prioridade ? 'caixa marcada' : 'caixa'} onClick={() => setNovo({ ...novo, prioridade: !novo.prioridade })} style={{ alignSelf: 'flex-start' }}>
                <Flag size={15} style={{ color: '#C23A1E' }} /> Prioridade — fura a fila do agendamento
              </label>
              <button className="btn-principal" style={{ maxWidth: 'none' }} disabled={!novo.nome.trim()} onClick={cadastrarPaciente}>Cadastrar paciente</button>
            </div>
            <p className="dica" style={{ marginTop: 10 }}>Depois do cadastro, o próximo passo é a aba Triagem.</p>
          </>
        )}

        {aba === 'triagem' && (
          <>
            <h2>Triagem</h2>
            <button className={`caixa-entrada ${semTriagem.length ? 'pendente' : 'vazia'}`} onClick={() => setTela('entradaTriagem')}>
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
                const total = pacientes.filter(p => areasDoPaciente(p).includes(a.nome)).length;
                return (
                  <button key={a.nome} className="caixa-area" onClick={() => setTela({ area: a })}>
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
              <button className="caixa-area tracejada" onClick={() => setTela('procedimentos')}>
                <span className="tracejada-mais"><Plus size={22} strokeWidth={2.6} /></span>
                <span className="tracejada-texto">
                  <strong>Outros / tempos</strong>
                  <span>Adicionar procedimento e tempo</span>
                </span>
                <ChevronRight size={20} className="tracejada-seta" strokeWidth={2.6} />
              </button>
            </div>
          </>
        )}

        {aba === 'pacientes' && (() => {
          const filtro = buscaPacientes.trim().toLowerCase();
          const lista = pacientes.filter(p => !filtro || p.nome.toLowerCase().includes(filtro) || String(p.codigo || '').toLowerCase().includes(filtro));
          return (
            <>
              <h2>Pacientes</h2>
              <input className="busca" placeholder="Pesquisar por nome ou código…" value={buscaPacientes} onChange={e => setBuscaPacientes(e.target.value)} />
              {lista.length ? lista.map(p => (
                <div className="cartao" key={p.id} onClick={() => setFichaId(p.id)} style={{ cursor: 'pointer' }}>
                  <div className="cartao-linha">
                    <Bolha nome={p.nome} foto={p.foto} />
                    <div>
                      <div className="cartao-topo">
                        <strong>{p.nome}</strong>
                        <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {p.prioridade && <span className="chip prioridade">prioridade</span>}
                          {p.triagem
                            ? <button className={'chip ' + p.status.replace(' ', '-')} onClick={e => { e.stopPropagation(); mudarStatus(p); }}>{p.status}</button>
                            : <span className="chip aguardando">sem triagem</span>}
                        </span>
                      </div>
                      {p.triagem && <p>{areasDoPaciente(p).join(' · ')}</p>}
                      <p className="obs">{[p.codigo, p.idade ? `${p.idade} anos` : '', p.telefone].filter(Boolean).join(' · ')}</p>
                      {p.triagem && (p.triagem.saude?.length > 0 || p.triagem.outrasCondicoes) && (
                        <p className="saude"><TriangleAlert size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />{[...(p.triagem.saude || []), p.triagem.outrasCondicoes].filter(Boolean).join(', ')}</p>
                      )}
                    </div>
                  </div>
                </div>
              )) : <div className="vazio">{filtro ? 'Nenhum paciente encontrado na pesquisa.' : 'Nenhum paciente ainda — cadastre na aba Cadastro.'}</div>}
            </>
          );
        })()}

        {aba === 'agenda' && (
          <>
            <div className="titulo-com-botao"><h2>Agendamento</h2><button className="btn-mais" onClick={() => setTela('marcar')}>+ Agendar</button></div>
            <div className="seletor">
              <button className={visaoAgenda === 'dia' ? 'ativo' : ''} onClick={() => setVisaoAgenda('dia')}>Agendados</button>
              <button className={visaoAgenda === 'sem' ? 'ativo' : ''} onClick={() => setVisaoAgenda('sem')}>Não agendados</button>
            </div>
            {visaoAgenda === 'sem' ? (() => {
              // Cada PROCEDIMENTO da triagem que ainda não tem agendamento
              // fica pendente aqui (não a pessoa — o procedimento dela)
              const pendentes = [];
              for (const p of pacientes.filter(x => x.triagem)) {
                for (const area of areasDoPaciente(p)) {
                  const ja = agendamentos.some(g => g.pacienteId === p.id && (g.area === area || (g.titulo || '').startsWith(area)));
                  if (!ja) pendentes.push({ p, area });
                }
              }
              // Prioridade fura a fila
              pendentes.sort((x, y) => (y.p.prioridade ? 1 : 0) - (x.p.prioridade ? 1 : 0));
              return pendentes.length ? pendentes.map(({ p, area }) => {
                const a = todasAreas.find(x => x.nome === area);
                return (
                  <div className="cartao" key={p.id + area}>
                    <div className="cartao-linha">
                      <span className="caixa-area-icone" style={{ background: (a?.cor || '#2F7D4E') + '22', color: a?.cor || '#2F7D4E', width: 46, height: 46, borderRadius: 15 }}>
                        {a?.Icone ? <a.Icone size={22} strokeWidth={2.2} /> : <Tag size={22} />}
                      </span>
                      <div>
                        <div className="cartao-topo">
                          <strong>{area}</strong>
                          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {p.prioridade && <span className="chip prioridade">prioridade</span>}
                            <span className="quando">{duracaoDe(area)} min</span>
                          </span>
                        </div>
                        <p className="obs">{p.codigo ? `${p.codigo} · ` : ''}{p.nome}</p>
                        <button className="btn-confirmar" style={{ marginTop: 8 }} onClick={() => setTela({ marcarPaciente: p, marcarArea: area })}>Agendar</button>
                      </div>
                    </div>
                  </div>
                );
              }) : <div className="vazio">Nenhum procedimento pendente — tudo agendado. 🌱</div>;
            })() : (
            <>
            <div className="dia-nav">
              <button onClick={() => setDia(somaDias(dia, -1))}>‹</button>
              <div className="dia-titulo">
                <strong>{dataBonita(dia)}</strong>
                {dia !== hojeISO() ? <span onClick={() => setDia(hojeISO())} style={{ cursor: 'pointer' }}>voltar para hoje</span> : <span>hoje</span>}
              </div>
              <button onClick={() => setDia(somaDias(dia, 1))}>›</button>
            </div>
            {doDia.length ? doDia.map(g => (
              <div className="cartao" key={g.id} onClick={() => g.pacienteId && setFichaId(g.pacienteId)} style={g.pacienteId ? { cursor: 'pointer' } : undefined}>
                <div className="linha-agenda">
                  <div className="hora-col">{g.hora}<span className="hora-fim">{horaFim(g.hora, g.duracaoMin)}</span></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{g.pacienteNome || g.titulo}</strong>
                    {g.pacienteNome && g.titulo && <p style={{ marginTop: 3 }}>{g.titulo} · {g.duracaoMin || DURACAO_PADRAO} min</p>}
                    {g.profissionalNome && <p className="obs">com {g.profissionalNome}</p>}
                  </div>
                  <button className="btn-remover" onClick={e => { e.stopPropagation(); removerAgendamento(g); }} title="Remover">✕</button>
                </div>
              </div>
            )) : <div className="vazio">Nada marcado em {dataBonita(dia)}.<br />Toque em "+ Agendar".</div>}
            </>
            )}
          </>
        )}

        {aba === 'voluntarios' && (() => {
          const pendentes = voluntarios.filter(v => v.status === 'pendente');
          const equipe = voluntarios.filter(v => v.status !== 'pendente' && v.status !== 'recusado');
          return (
            <>
              {pendentes.length > 0 && (
                <>
                  <h2>Solicitações de cadastro</h2>
                  {pendentes.map(v => (
                    <div className="cartao pendente" key={v.id}>
                      <div className="cartao-topo"><strong>{v.nome}</strong><span className="chip aguardando">pendente</span></div>
                      <p>
                        {v.email && <>{v.email}<br /></>}
                        {v.telefone && <>{v.telefone}<br /></>}
                        {v.cpf && <>CPF: {v.cpf}<br /></>}
                        {v.nascimento && <>Nascimento: {dataNascimentoBonita(v.nascimento)}</>}
                      </p>
                      <div className="linha-botoes">
                        <button className="btn-recusar" onClick={() => responderSolicitacao(v, false)}>Recusar</button>
                        <button className="btn-aprovar" onClick={() => responderSolicitacao(v, true)}>Aprovar voluntário</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div className="titulo-com-botao"><h2>Voluntários</h2><button className="btn-mais" onClick={() => setTela('novoVoluntario')}>+ Adicionar</button></div>
              {equipe.length ? equipe.map(v => (
                <div className="cartao" key={v.id} onClick={() => setTela({ voluntario: v })} style={{ cursor: 'pointer' }}>
                  <div className="cartao-linha">
                    <Bolha nome={v.nome} />
                    <div>
                      <div className="cartao-topo"><strong>{v.nome}</strong>{v.ativo === false && <span className="chip aguardando">inativo</span>}</div>
                      <p>{[v.ministerio, v.telefone].filter(Boolean).join(' · ')}</p>
                      <p className="obs">{agendamentos.filter(g => g.profissionalUid === v.id).length} agendamento(s) — toque para ver a agenda</p>
                    </div>
                  </div>
                </div>
              )) : <div className="vazio">Nenhum voluntário cadastrado ainda.</div>}
            </>
          );
        })()}

        {aba === 'perfil' && (
          <>
            <h2>Meu perfil</h2>
            <div className="cartao">
              <div className="cartao-linha">
                <Bolha nome={usuario.nome} />
                <div>
                  <p style={{ marginTop: 0 }}><strong>{usuario.nome}</strong></p>
                  {usuario.email && <p>{usuario.email}</p>}
                  <p className="obs">Central do Seja Semente</p>
                </div>
              </div>
            </div>
            <button className="btn-principal" style={{ maxWidth: 'none', marginBottom: 10 }} onClick={() => setTela('novoVoluntario')}>+ Adicionar novo dentista / usuário</button>
            <p className="dica" style={{ marginBottom: 10 }}>Para dentistas sem celular: eles entram na equipe e recebem agendamentos normalmente. Com o e-mail preenchido, fica fácil ligar a conta quando baixarem o Semeador.</p>
            <button className="btn-sair" onClick={aoSair}>Sair</button>
          </>
        )}
      </main>

      <nav>
        <button className={aba === 'cadastro' ? 'ativo' : ''} onClick={() => setAba('cadastro')}><UserPlus size={22} /><span>Cadastro</span></button>
        <button className={aba === 'triagem' ? 'ativo' : ''} onClick={() => setAba('triagem')}>
          <span className="icone-aba"><Stethoscope size={22} />{semTriagem.length > 0 && <i className="bolinha" />}</span>
          <span>Triagem</span>
        </button>
        <button className={aba === 'pacientes' ? 'ativo' : ''} onClick={() => setAba('pacientes')}><ClipboardList size={22} /><span>Pacientes</span></button>
        <button className={aba === 'agenda' ? 'ativo' : ''} onClick={() => setAba('agenda')}><CalendarDays size={22} /><span>Agenda</span></button>
        <button className={aba === 'voluntarios' ? 'ativo' : ''} onClick={() => setAba('voluntarios')}>
          <span className="icone-aba"><Users size={22} />{voluntarios.some(v => v.status === 'pendente') && <i className="bolinha" />}</span>
          <span>Voluntár.</span>
        </button>
        <button className={aba === 'perfil' ? 'ativo' : ''} onClick={() => setAba('perfil')}><User size={22} /><span>Perfil</span></button>
      </nav>
    </div>
  );
}

function App() {
  const [pronto, setPronto] = useState(!CONFIGURADO);
  const [usuario, setUsuario] = useState(CONFIGURADO ? null : lerLocal('ss-usuario', null));

  useEffect(() => { if (!CONFIGURADO) gravarLocal('ss-usuario', usuario); }, [usuario]);

  const [erroInicial, setErroInicial] = useState('');

  useEffect(() => {
    if (!CONFIGURADO) return;
    const pega = (e) => setErroInicial(atual => atual || String(e?.reason?.message || e?.message || e?.type || e));
    window.addEventListener('unhandledrejection', pega);
    window.addEventListener('error', pega);
    let soltar = null;
    ligarFirebase().then(() => {
      // Completa o login por redirect (plano B do navegador), se houver
      fb.fns.getRedirectResult?.(fb.auth).catch(() => {});
      soltar = fb.fns.onAuthStateChanged(fb.auth, u => {
        setUsuario(u ? { uid: u.uid, email: u.email, nome: u.displayName || u.email } : null);
        setPronto(true);
      });
    }).catch(e => { setErroInicial(String(e?.message || e)); setPronto(true); });
    return () => { soltar?.(); window.removeEventListener('unhandledrejection', pega); window.removeEventListener('error', pega); };
  }, []);

  async function sair() {
    if (CONFIGURADO) await fb.fns.signOut(fb.auth);
    setUsuario(null);
  }

  // A abertura animada cobre a tela nos primeiros ~3s de cada entrada do zero
  const [abrindo, setAbrindo] = useState(true);
  const abertura = abrindo ? <Abertura tema="verde" nome="Seja Semente" frase="semeando sorrisos" aoTerminar={() => setAbrindo(false)} /> : null;

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
  else if (!usuario) conteudo = <TelaLogin aoEntrarDemo={setUsuario} />;
  else conteudo = <TelaPrincipal usuario={usuario} aoSair={sair} />;
  return <>{conteudo}{abertura}</>;
}

createRoot(document.getElementById('root')).render(<App />);
