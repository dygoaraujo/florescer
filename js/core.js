/* ══ FLORESCER — núcleo ══════════════════════════════════════════
   DB sobre localStorage (prefixo lo_), datas em horário local,
   navegação por hash, toast e confirmação in-app.
   Arquitetura portada do Design Studio / Command Center.
   ════════════════════════════════════════════════════════════════ */

// ── Datas sempre em horário LOCAL (evita o bug de UTC vs BRT) ──
function dataLocal(d) {
  const dt = d || new Date();
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function horaLocal(d) {
  const dt = d || new Date();
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}
function deData(s) { return new Date(s + 'T00:00:00'); }
function somaDias(s, n) { const d = deData(s); d.setDate(d.getDate() + n); return dataLocal(d); }
function minutosDe(hhmm) { const [h, m] = String(hhmm || '00:00').split(':').map(Number); return h * 60 + (m || 0); }

// Segunda-feira da semana de uma data (semana = seg→dom)
function inicioSemana(s) {
  const d = deData(s);
  const dow = (d.getDay() + 6) % 7;   // 0 = segunda
  d.setDate(d.getDate() - dow);
  return dataLocal(d);
}

// ── Armazenamento ────────────────────────────────────────────────
const DB = {
  get(k)    { try { return JSON.parse(localStorage.getItem('lo_' + k)); } catch { return null; } },
  set(k, v) {
    localStorage.setItem('lo_' + k, JSON.stringify(v));
    if (typeof marcarEdicao === 'function') marcarEdicao(k);
  },
  push(k, item) { const a = DB.get(k) || []; a.push(item); DB.set(k, a); return item; },
};

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ── Formatação ───────────────────────────────────────────────────
const fmt = {
  data(s)  { return s ? deData(s).toLocaleDateString('pt-BR') : '—'; },
  curta(s) { return s ? deData(s).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '') : '—'; },
  longa(s) {
    if (!s) return '—';
    return deData(s).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  },
  litros(ml) {
    if (ml == null) return '—';
    return (ml / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' L';
  },
  peso(kg) {
    if (kg == null || kg === '') return '—';
    return Number(kg).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' kg';
  },
  lista(arr) { // ["a","b","c"] → "a, b e c"
    if (!arr.length) return '';
    if (arr.length === 1) return arr[0];
    return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  },
};

const DIAS_CURTOS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const DIAS_LETRA  = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

// ── Ícones (a categoria é o ícone, não a cor) ────────────────────
const IC = {
  refeicao: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M4 3v7a2.5 2.5 0 0 0 5 0V3M6.5 10v11"/><path d="M17.5 3c-1.4 1.4-2 3.2-2 5.5 0 1.7.7 2.9 2 3.2V21"/></svg>`,
  remedio:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M8.7 8.7l6.6 6.6"/></svg>`,
  treino:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/></svg>`,
  sessao:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 21s-7-4.6-7-9.7A4.3 4.3 0 0 1 12 8a4.3 4.3 0 0 1 7 3.3C19 16.4 12 21 12 21z"/></svg>`,
  agua:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 3s6 6.4 6 10.4A6 6 0 0 1 6 13.4C6 9.4 12 3 12 3z"/></svg>`,
  check:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4.5 12.5l5 5 10-11"/></svg>`,
  seta:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>`,
  mais:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="17" height="17"><path d="M12 5v14M5 12h14"/></svg>`,
  lapis:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg>`,
  lixo:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13"/></svg>`,
};

// ── Semente ──────────────────────────────────────────────────────
// Dieta de exemplo, coerente com o que a clínica costuma passar.
// Tudo editável em Ajustes → Plano alimentar; trocar não apaga histórico.
const SEED = {
  perfil: {
    nome: 'Lorena',
    metaAgua: 3000,
    pesoInicial: null,
    pesoMeta: null,
    diasExercicio: [1, 2, 3, 4, 5],     // 0 = domingo
    metaSemanalExercicio: 4,
    horaExercicio: '18:00',
    inicioTratamento: dataLocal(),
  },

  dietas: [{
    id: 'dieta-1',
    nome: 'Plano inicial',
    criadaEm: dataLocal(),
    ativa: true,
    obs: 'Exemplo — troque pelos alimentos que a nutricionista passou.',
    refeicoes: [
      { id: 'r-cafe', nome: 'Café da manhã', hora: '07:30', grupos: [
        { id: 'g1', nome: 'Proteína',    qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o1', nome: 'Ovo mexido' }, { id: 'o2', nome: 'Queijo branco' }, { id: 'o3', nome: 'Iogurte natural' } ] },
        { id: 'g2', nome: 'Carboidrato', qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o4', nome: 'Tapioca' }, { id: 'o5', nome: 'Pão integral' }, { id: 'o6', nome: 'Aveia' } ] },
        { id: 'g3', nome: 'Fruta',       qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o7', nome: 'Banana' }, { id: 'o8', nome: 'Mamão' }, { id: 'o9', nome: 'Maçã' } ] },
      ]},
      { id: 'r-lm', nome: 'Lanche da manhã', hora: '10:00', grupos: [
        { id: 'g4', nome: 'Fruta ou oleaginosa', qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o10', nome: 'Maçã' }, { id: 'o11', nome: 'Pera' }, { id: 'o12', nome: 'Castanhas' }, { id: 'o13', nome: 'Iogurte' } ] },
      ]},
      { id: 'r-almoco', nome: 'Almoço', hora: '12:30', grupos: [
        { id: 'g5', nome: 'Proteína',    qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o14', nome: 'Frango grelhado' }, { id: 'o15', nome: 'Patinho' }, { id: 'o16', nome: 'Peixe' }, { id: 'o17', nome: 'Ovo' } ] },
        { id: 'g6', nome: 'Carboidrato', qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o18', nome: 'Arroz integral' }, { id: 'o19', nome: 'Batata doce' }, { id: 'o20', nome: 'Macarrão integral' } ] },
        { id: 'g7', nome: 'Legume',      qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o21', nome: 'Abobrinha' }, { id: 'o22', nome: 'Cenoura' }, { id: 'o23', nome: 'Brócolis' }, { id: 'o24', nome: 'Chuchu' } ] },
        { id: 'g8', nome: 'Salada',      qtd: 2, selecao: 'multipla', opcoes: [
          { id: 'o25', nome: 'Alface' }, { id: 'o26', nome: 'Tomate' }, { id: 'o27', nome: 'Pepino' }, { id: 'o28', nome: 'Rúcula' }, { id: 'o29', nome: 'Beterraba' } ] },
      ]},
      { id: 'r-lt', nome: 'Lanche da tarde', hora: '15:30', grupos: [
        { id: 'g9', nome: 'Proteína', qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o30', nome: 'Iogurte natural' }, { id: 'o31', nome: 'Queijo branco' }, { id: 'o32', nome: 'Ovo cozido' } ] },
        { id: 'g10', nome: 'Fruta',   qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o33', nome: 'Banana' }, { id: 'o34', nome: 'Morango' }, { id: 'o35', nome: 'Melão' } ] },
      ]},
      { id: 'r-jantar', nome: 'Jantar', hora: '19:30', grupos: [
        { id: 'g11', nome: 'Proteína', qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o36', nome: 'Frango' }, { id: 'o37', nome: 'Peixe' }, { id: 'o38', nome: 'Omelete' } ] },
        { id: 'g12', nome: 'Legume',   qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o39', nome: 'Abobrinha' }, { id: 'o40', nome: 'Berinjela' }, { id: 'o41', nome: 'Couve-flor' } ] },
        { id: 'g13', nome: 'Salada',   qtd: 2, selecao: 'multipla', opcoes: [
          { id: 'o42', nome: 'Alface' }, { id: 'o43', nome: 'Tomate' }, { id: 'o44', nome: 'Pepino' }, { id: 'o45', nome: 'Rúcula' } ] },
      ]},
      { id: 'r-ceia', nome: 'Ceia', hora: '21:30', grupos: [
        { id: 'g14', nome: 'Opção leve', qtd: 1, selecao: 'unica', opcoes: [
          { id: 'o46', nome: 'Chá' }, { id: 'o47', nome: 'Iogurte' }, { id: 'o48', nome: 'Gelatina' } ] },
      ]},
    ],
  }],

  medicamentos: [
    { id: 'm1', nome: 'Vitamina D', dose: '1 cápsula', hora: '08:00', frequencia: 'diaria', dias: [], obs: '', ativo: true },
    { id: 'm2', nome: 'Mounjaro',   dose: 'conforme a clínica', hora: '20:00', frequencia: 'semanal', dias: [0], obs: 'Aplicação semanal', ativo: true },
  ],

  exercicios: ['Academia', 'Caminhada', 'Dança', 'Pilates', 'Outro'],
};

const CHAVES_DADOS = [
  'perfil', 'dietas', 'medicamentos', 'exercicios',
  'logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios',
  'pesos', 'sessoes', 'scores', 'relatorios', 'conquistas',
];

function iniciarDB() {
  if (!DB.get('perfil'))        DB.set('perfil', SEED.perfil);
  if (!DB.get('dietas'))        DB.set('dietas', SEED.dietas);
  if (!DB.get('medicamentos'))  DB.set('medicamentos', SEED.medicamentos);
  if (!DB.get('exercicios'))    DB.set('exercicios', SEED.exercicios);
  ['logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios',
   'pesos', 'sessoes', 'scores', 'relatorios', 'conquistas']
    .forEach(k => { if (!DB.get(k)) DB.set(k, []); });

  // Completa campos que possam faltar num perfil salvo por versão antiga
  const p = DB.get('perfil');
  let mudou = false;
  Object.entries(SEED.perfil).forEach(([k, v]) => {
    if (p[k] === undefined) { p[k] = v; mudou = true; }
  });
  if (mudou) DB.set('perfil', p);
}

// ── Atalhos de leitura ───────────────────────────────────────────
const perfil     = () => DB.get('perfil') || SEED.perfil;
const dietaAtiva = () => (DB.get('dietas') || []).find(d => d.ativa) || null;
const hoje       = () => dataLocal();

/** Medicamentos que valem para uma data (respeitando frequência). */
function medsDoDia(data) {
  const dow = deData(data).getDay();
  return (DB.get('medicamentos') || []).filter(m => {
    if (!m.ativo) return false;
    if (m.frequencia === 'diaria') return true;
    return (m.dias || []).includes(dow);
  });
}

/** É dia de treino? */
function ehDiaDeTreino(data) {
  return (perfil().diasExercicio || []).includes(deData(data).getDay());
}

const aguaDoDia = data => (DB.get('logAgua') || []).filter(l => l.data === data).reduce((s, l) => s + l.ml, 0);

// ══ NOTA DO DIA ════════════════════════════════════════════════
// Refeições 40 · água 25 · medicamentos 20 · exercício 15.
// Em dia SEM treino os 15 pontos do exercício se redistribuem — não dá
// pra perder ponto por não treinar num dia de descanso.
function notaDoDia(data) {
  const dieta = dietaAtiva();
  const refs  = dieta ? dieta.refeicoes : [];
  const meds  = medsDoDia(data);
  const treina = ehDiaDeTreino(data);

  const logR = (DB.get('logRefeicoes') || []).filter(l => l.data === data && l.status === 'feita');
  const logM = (DB.get('logMedicamentos') || []).filter(l => l.data === data);
  const logE = (DB.get('logExercicios') || []).filter(l => l.data === data);

  const partes = {
    refeicoes:    refs.length ? logR.length / refs.length : null,
    agua:         Math.min(1, aguaDoDia(data) / (perfil().metaAgua || 3000)),
    medicamentos: meds.length ? Math.min(1, logM.length / meds.length) : null,
    exercicio:    treina ? (logE.length ? 1 : 0) : null,
  };

  const pesos = { refeicoes: 40, agua: 25, medicamentos: 20, exercicio: 15 };
  let total = 0, base = 0;
  Object.entries(partes).forEach(([k, v]) => {
    if (v === null) return;                 // não se aplica hoje → sai da conta
    base  += pesos[k];
    total += pesos[k] * v;
  });

  return { nota: base ? Math.round(total / base * 100) : 0, partes };
}

/** Fecha o dia num registro imutável (chamado quando a data vira). */
function congelarScore(data) {
  if (data >= hoje()) return;
  const scores = DB.get('scores') || [];
  if (scores.some(s => s.data === data)) return;
  const { nota, partes } = notaDoDia(data);
  scores.push({ data, nota, partes });
  DB.set('scores', scores);
}

/** Nota de qualquer dia: congelada se passou, ao vivo se é hoje. */
function notaDe(data) {
  if (data === hoje()) return notaDoDia(data).nota;
  const s = (DB.get('scores') || []).find(x => x.data === data);
  return s ? s.nota : notaDoDia(data).nota;
}

/** Congela todos os dias com registro que já passaram. */
function congelarPendentes() {
  const datas = new Set();
  ['logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios']
    .forEach(k => (DB.get(k) || []).forEach(l => datas.add(l.data)));
  [...datas].filter(d => d < hoje()).sort().forEach(congelarScore);
}

// ── Navegação ────────────────────────────────────────────────────
const TELAS = ['hoje', 'alimentacao', 'progresso', 'agenda', 'ajustes'];
let telaAtual = 'hoje';

const RENDER = {};   // cada módulo registra RENDER.hoje = fn, etc.

function ir(tela, opts = {}) {
  if (!TELAS.includes(tela)) tela = 'hoje';
  telaAtual = tela;

  document.querySelectorAll('.tela').forEach(el => el.classList.toggle('ativa', el.id === 'tela-' + tela));
  document.querySelectorAll('.tab').forEach(el => {
    const on = el.dataset.tela === tela;
    el.classList.toggle('ativa', on);
    el.setAttribute('aria-current', on ? 'page' : 'false');
  });

  if (RENDER[tela]) RENDER[tela]();
  if (!opts.semHash && location.hash.slice(1) !== tela) history.pushState({ tela }, '', '#' + tela);
  window.scrollTo({ top: 0, behavior: opts.instantaneo ? 'auto' : 'smooth' });
}

function aplicarHash() {
  const t = location.hash.slice(1);
  ir(TELAS.includes(t) ? t : 'hoje', { semHash: true, instantaneo: true });
}

// ── Toast ────────────────────────────────────────────────────────
function toast(msg) {
  const cx = document.getElementById('toasts');
  if (!cx) return;
  while (cx.children.length >= 3) cx.removeChild(cx.firstChild);
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  cx.appendChild(el);
  setTimeout(() => {
    el.classList.add('sai');
    setTimeout(() => el.remove(), 260);
  }, 2600);
}

// ── Confirmação in-app (nunca confirm() nativo) ──────────────────
let _confirmaOk = null;
function confirmar(titulo, texto, rotuloOk, onOk, opts = {}) {
  _confirmaOk = onOk;
  document.getElementById('confirma-titulo').textContent = titulo;
  document.getElementById('confirma-texto').textContent = texto;
  const b = document.getElementById('confirma-ok');
  b.textContent = rotuloOk;
  b.className = 'btn ' + (opts.perigo ? 'btn-cheio' : 'btn-cheio');
  document.getElementById('confirma').classList.add('on');
}
function fecharConfirma(executar) {
  document.getElementById('confirma').classList.remove('on');
  const fn = _confirmaOk; _confirmaOk = null;
  if (executar && fn) fn();
}

// ── Bottom sheet ─────────────────────────────────────────────────
let _sheetFechar = null;
function abrirSheet(html, aoFechar) {
  const sh = document.getElementById('sheet');
  sh.innerHTML = html;
  document.getElementById('veu').classList.add('on');
  requestAnimationFrame(() => sh.classList.add('on'));
  document.body.style.overflow = 'hidden';
  _sheetFechar = aoFechar || null;
}
function fecharSheet() {
  const sh = document.getElementById('sheet');
  sh.classList.remove('on');
  document.getElementById('veu').classList.remove('on');
  document.body.style.overflow = '';
  const fn = _sheetFechar; _sheetFechar = null;
  setTimeout(() => { sh.innerHTML = ''; }, 380);
  if (fn) fn();
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const sheetAberto = () => document.getElementById('sheet').classList.contains('on')
                       || document.getElementById('confirma').classList.contains('on');

/** Arrastar o topo do sheet pra baixo fecha — o gesto que todo mundo tenta. */
function ligarArrastoSheet(sh) {
  let y0 = null, dy = 0;
  const inicio = e => {
    if (!e.target.closest || !e.target.closest('.sheet-alca, .sheet-cabeca')) return;
    y0 = e.touches[0].clientY; dy = 0;
    sh.style.transition = 'none';
  };
  const mover = e => {
    if (y0 === null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    sh.style.transform = `translateY(${dy}px)`;
  };
  const soltar = () => {
    if (y0 === null) return;
    sh.style.transition = '';
    sh.style.transform = '';
    if (dy > 90) fecharSheet();
    y0 = null;
  };
  sh.addEventListener('touchstart', inicio, { passive: true });
  sh.addEventListener('touchmove', mover, { passive: true });
  sh.addEventListener('touchend', soltar);
  sh.addEventListener('touchcancel', soltar);
}

// ── Saudação ─────────────────────────────────────────────────────
function saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ── Boot ─────────────────────────────────────────────────────────
function iniciar() {
  iniciarDB();
  congelarPendentes();

  document.querySelectorAll('.tab').forEach(el => {
    el.addEventListener('click', () => ir(el.dataset.tela));
  });
  document.getElementById('veu').addEventListener('click', fecharSheet);
  ligarArrastoSheet(document.getElementById('sheet'));
  document.getElementById('confirma').addEventListener('click', e => {
    if (e.target.id === 'confirma') fecharConfirma(false);
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('confirma').classList.contains('on')) fecharConfirma(false);
    else if (document.getElementById('sheet').classList.contains('on')) fecharSheet();
  });
  window.addEventListener('popstate', aplicarHash);

  // Storage persistente — principal defesa contra a eviction do iOS
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  aplicarHash();

  // Ao voltar pro app depois de horas, o dia pode ter virado
  let ultimoDia = hoje();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || sheetAberto()) return;
    if (hoje() !== ultimoDia) { ultimoDia = hoje(); congelarPendentes(); }
    if (RENDER[telaAtual]) RENDER[telaAtual]();
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
