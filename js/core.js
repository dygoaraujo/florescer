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
  // Só a primeira letra — `text-transform: capitalize` estragaria o "de" do meio.
  maiuscula(s) { return s ? s[0].toUpperCase() + s.slice(1) : s; },
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
  km(n) {
    if (!n) return '';
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' km';
  },
  // 95 → "1h35", 45 → "45 min"
  duracao(min) {
    if (!min) return '';
    const h = Math.floor(min / 60);
    return h ? `${h}h${String(min % 60).padStart(2, '0')}` : `${min} min`;
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
  gota:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M12 3.5s5.5 6 5.5 9.7a5.5 5.5 0 0 1-11 0C6.5 9.5 12 3.5 12 3.5z"/></svg>`,
  capsula:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><rect x="1.8" y="8.6" width="20.4" height="6.8" rx="3.4" transform="rotate(-45 12 12)"/><path d="M9.6 9.6l4.8 4.8"/></svg>`,
  lua:      `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="18" height="18"><path d="M20 14.5A8.2 8.2 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5z"/></svg>`,
  check:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4.5 12.5l5 5 10-11"/></svg>`,
  seta:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M9 5l7 7-7 7"/></svg>`,
  mais:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="17" height="17"><path d="M12 5v14M5 12h14"/></svg>`,
  lapis:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/></svg>`,
  lixo:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13"/></svg>`,
};
// ══ MEDIDAS ══════════════════════════════════════════════════════
// Toda opção carrega a própria medida: {valor, unidade}. Assim o app já
// mostra "150 g" na hora de montar o prato, e ela ajusta no −/+ sem teclado.
// valor null = "à vontade".
const med = (valor, unidade) => ({ valor, unidade });

// Passo do −/+ por unidade, pra ajustar sem digitar.
const PASSO_MEDIDA = { g: 10, ml: 50, un: 1, fatia: 1, 'col sopa': 1, 'col chá': 1, xc: 1, gomos: 1, copo: 1, pote: 1, porção: 1 };
const passoDe = u => PASSO_MEDIDA[u] || 1;

function medidaTexto(m) {
  if (!m) return '';
  if (m.valor == null) return m.unidade || '';
  const v = Number(m.valor);
  return `${Number.isInteger(v) ? v : v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} ${m.unidade}`;
}

// ── Catálogos do plano da clínica ────────────────────────────────
// Listas cruas; os ids saem do nome, então continuam estáveis entre versões
// da dieta (e o histórico antigo segue legível).
const idDe = nome => 'o-' + nome.toLowerCase()
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const opcoes = (lista, medidaPadrao, secao) => lista.map(item => {
  const [nome, medida] = Array.isArray(item) ? item : [item, medidaPadrao];
  const o = { id: idDe(nome), nome, medida: medida || medidaPadrao || null };
  if (secao) o.secao = secao;
  return o;
});

/** Listas grandes (chá, proteína, fruta) vêm divididas como no papel da clínica:
 *  o sheet mostra o subtítulo e só os chips daquele subgrupo embaixo. Sem isso
 *  viram 40 botões soltos e ela tem que caçar. */
const opcoesPorSecao = (blocos, medidaPadrao) =>
  blocos.flatMap(b => opcoes(b.itens, b.medida || medidaPadrao, b.secao));

const CATALOGO = {
  // Grupo A — à vontade
  grupoA: ['Abóbora', 'Abobrinha', 'Acelga', 'Agrião', 'Aipo', 'Alcachofra', 'Alface', 'Almeirão',
    'Aspargo', 'Berinjela', 'Brócolis', 'Caxi', 'Chicória', 'Chuchu', 'Couve', 'Escarola', 'Espinafre',
    'Folhas da beterraba', 'Guariroba', 'Jiló', 'Maxixe', 'Moranga', 'Nabo', 'Palmito', 'Pepino',
    'Pimentão', 'Quiabo', 'Rabanete', 'Repolho', 'Rúcula', 'Tomate', 'Tomate-cereja', 'Vagem'],

  // Grupo B — 2 colheres de sopa / 50 g
  grupoB: ['Batata Astérix', 'Batata baroa', 'Batata-doce', 'Batata inglesa', 'Batata yacon',
    'Beterraba', 'Cará', 'Cenoura', 'Inhame', 'Mandioca', 'Mandioquinha-salsa', 'Milho-verde'],

  // Proteínas — 150 g (animal: peso cru; vegetal: peso cozido). Ovos têm medida
  // própria. Divididas como no papel da clínica.
  proteinas: [
    { secao: 'Bovina',        itens: ['Alcatra', 'Coxão duro', 'Coxão mole', 'Filé mignon', 'Lagarto', 'Músculo', 'Patinho'] },
    { secao: 'Frango',        itens: ['Coxa de frango', 'Peito de frango', 'Sobrecoxa sem pele'] },
    { secao: 'Suína',         itens: ['Bisteca suína', 'Filé mignon suíno', 'Lombo suíno'] },
    { secao: 'Peixes',        itens: ['Atum', 'Badejo', 'Corvina', 'Linguado', 'Merluza', 'Peixe branco', 'Salmão', 'Tilápia'] },
    { secao: 'Frutos-do-mar', itens: ['Camarão', 'Caranguejo', 'Lagosta', 'Lula', 'Mexilhão', 'Polvo', 'Siri'] },
    { secao: 'Ovos',          itens: [['Ovo de galinha', med(2, 'un')], ['Ovo de codorna', med(10, 'un')]] },
    { secao: 'Vegetal',       itens: ['Cogumelos', 'Edamame', 'Ervilha', 'Feijão', 'Grão-de-bico', 'Lentilha', 'Soja',
                                      'Proteína texturizada de soja'] },
  ],

  // Frutas — cada uma com a porção da clínica
  frutas: [
    { secao: 'Frutas', itens: [
      ['Abacate', med(2, 'col sopa')], ['Abacaxi', med(1, 'fatia')], ['Acerola', med(10, 'un')],
      ['Ameixa', med(1, 'un')], ['Amora', med(6, 'un')], ['Atemoia', med(0.5, 'un')],
      ['Banana', med(1, 'un')], ['Cajá', med(6, 'un')], ['Caqui', med(1, 'un')],
      ['Carambola', med(1, 'un')], ['Cereja', med(10, 'un')], ['Coco', med(1, 'col sopa')],
      ['Figo', med(1, 'un')], ['Goiaba', med(1, 'un')], ['Jabuticaba', med(10, 'un')],
      ['Jaca', med(6, 'gomos')], ['Kiwi', med(1, 'un')], ['Lichia', med(6, 'un')], ['Maçã', med(1, 'un')],
      ['Mamão', med(1, 'fatia')], ['Manga', med(0.5, 'un')], ['Mangaba', med(6, 'un')],
      ['Maracujá', med(0.5, 'un')], ['Melancia', med(1, 'fatia')], ['Melão', med(1, 'fatia')],
      ['Morango', med(6, 'un')], ['Nectarina', med(1, 'un')], ['Pequi', med(4, 'un')],
      ['Pera', med(1, 'un')], ['Pêssego', med(1, 'un')], ['Pitanga', med(10, 'un')],
      ['Pitaya', med(0.5, 'un')], ['Romã', med(1, 'un')], ['Seriguela', med(4, 'un')],
      ['Tâmara', med(1, 'un')], ['Tangerina', med(1, 'un')], ['Uva', med(10, 'un')] ] },
    { secao: 'Frutas secas', itens: [
      ['Coco seco', med(10, 'un')], ['Cranberry', med(10, 'un')], ['Damasco', med(3, 'un')],
      ['Gojiberry', med(10, 'un')], ['Uva-passa', med(10, 'un')] ] },
  ],

  // Oleaginosas — só quando substituir a fruta
  oleaginosas: [
    { secao: 'Oleaginosas', itens: [
      ['Amêndoas', med(5, 'un')], ['Castanha baru', med(4, 'un')], ['Castanha de caju', med(5, 'un')],
      ['Castanha do pará', med(2, 'un')], ['Nozes', med(3, 'un')] ] },
  ],

  // Chás — por função, como a clínica escreveu
  chas: [
    { secao: 'Termogênicos', itens: ['Canela', 'Chá preto', 'Chá verde', 'Gengibre', 'Hibisco', 'Pimenta'] },
    { secao: 'Diuréticos',   itens: ['Anis', 'Cavalinha', 'Chá branco', 'Cravo', 'Dente de leão', 'Limão', 'Mate', 'Salsinha'] },
    { secao: 'Digestivos',   itens: ['Boldo', 'Erva cidreira', 'Hortelã'] },
    { secao: 'Calmantes',    itens: ['Camomila', 'Erva doce', 'Funcho', 'Melissa', 'Valeriana'] },
  ],

  folhasSuco: ['Couve', 'Hortelã', 'Pepino', 'Salsinha'],
  frutasSuco: [
    ['Maracujá', med(0.5, 'un')], ['Limão', med(1, 'un')], ['Abacaxi', med(1, 'fatia')],
    ['Melão', med(1, 'fatia')], ['Maçã', med(0.5, 'un')],
  ],
};

/** Categorias soltas pra "Refeição extra" — algo fora do horário do plano.
 *  Mesmo catálogo das refeições normais, sem mínimo/máximo: ela escolhe o
 *  que quiser em quantas categorias quiser, ou só escreve o que comeu. */
const GRUPOS_EXTRA = [
  { id: 'x-prot',  nome: 'Proteína',       opcoes: opcoesPorSecao(CATALOGO.proteinas, med(150, 'g')) },
  { id: 'x-carbo', nome: 'Carboidrato',    opcoes: opcoes(CATALOGO.grupoB, med(50, 'g')) },
  { id: 'x-veg',   nome: 'Vegetais',       opcoes: opcoes(CATALOGO.grupoA, med(null, 'à vontade')) },
  { id: 'x-fruta', nome: 'Fruta',          opcoes: opcoesPorSecao(CATALOGO.frutas) },
  { id: 'x-olea',  nome: 'Oleaginosa',     opcoes: opcoesPorSecao(CATALOGO.oleaginosas) },
  { id: 'x-cha',   nome: 'Chá ou bebida',  opcoes: opcoesPorSecao(CATALOGO.chas, med(1, 'xc')) },
];

// ── Semente ──────────────────────────────────────────────────────
// Plano real da clínica (Planejamento alimentar avançado #1).
// Tudo editável em Ajustes → Plano alimentar; trocar cria uma nova versão e
// nunca apaga a antiga, então o histórico continua fazendo sentido.
const SEED = {
  perfil: {
    nome: 'Lorena',
    metaAgua: 3000,
    metaAguaIdeal: 4000,                // a clínica pediu de 3 a 4 L
    pesoInicial: null,
    pesoMeta: null,
    diasExercicio: [1, 2, 3, 4, 5],     // 0 = domingo
    metaSemanalExercicio: 4,
    horaExercicio: '18:00',
    registrarSono: true,
    horaSono: '23:00',
    registrarJejum: true,               // primeira coisa do dia: água pura
    mlJejum: 300,                       // último valor que ela usou, pra abrir já certo
    inicioTratamento: dataLocal(),
  },

  dietas: [{
    id: 'dieta-1',
    nome: 'Dieta 1',
    criadaEm: dataLocal(),
    ativa: true,
    obs: 'Planejamento alimentar avançado #1, da clínica. Proteína animal: peso do alimento cru. Proteína vegetal: peso do alimento cozido.',
    refeicoes: [
      // `bloco` junta grupos que são uma coisa só na cabeça dela (o suco verde
      // é uma receita, não três decisões soltas). `dependeDe` faz um grupo só
      // aparecer depois de uma escolha — a lista de chás não polui quem tomou café.
      { id: 'r-cafe', nome: 'Café da manhã', hora: '07:30', grupos: [
        // A folha não tem quantidade no plano: é à vontade, e pode misturar.
        { id: 'g-suco-folha', bloco: 'Suco verde', nome: 'Folhas verdes', qtd: 3, min: 1, selecao: 'multipla',
          obs: 'Pode misturar mais de uma.',
          opcoes: opcoes(CATALOGO.folhasSuco, med(null, 'à vontade')) },
        { id: 'g-suco-fruta', bloco: 'Suco verde', nome: 'Fruta do suco', qtd: 1, selecao: 'unica',
          opcoes: opcoes(CATALOGO.frutasSuco) },
        // Itens sem substituto também precisam de check — senão o app não tem
        // como saber que faltou o gengibre, e a refeição passaria por completa.
        { id: 'g-suco-extra', bloco: 'Suco verde', nome: 'Complementos do suco', qtd: 3, min: 3, selecao: 'multipla',
          obs: 'Bate tudo junto no liquidificador. Não precisa coar.',
          opcoes: opcoes([['Semente de chia', med(1, 'col chá')], ['Gengibre', med(1, 'pedaço')],
                          ['Água', med(200, 'ml')]]) },
        { id: 'g-cafe-bebida', bloco: 'Bebida quente', nome: 'Chá ou café', qtd: 1, selecao: 'unica',
          opcoes: opcoes(['Chá', 'Café'], med(1, 'xc')) },
        { id: 'g-cafe-cha', bloco: 'Bebida quente', nome: 'Tipo de chá', qtd: 1, selecao: 'unica',
          dependeDe: { grupoId: 'g-cafe-bebida', opcaoId: idDe('Chá') },
          opcoes: opcoesPorSecao(CATALOGO.chas, med(1, 'xc')) },
        { id: 'g-cafe-prot', bloco: 'Para comer', nome: 'Proteína', qtd: 1, selecao: 'unica',
          opcoes: opcoes([['Ovo', med(1, 'un')], ['Queijo minas frescal', med(20, 'g')],
                          ['Requeijão light', med(1, 'col sopa')]]) },
        { id: 'g-cafe-carbo', bloco: 'Para comer', nome: 'Carboidrato ou fruta', qtd: 1, selecao: 'unica',
          opcoes: opcoes([['Pão de forma 100% integral', med(1, 'fatia')], ['Torrada', med(1, 'un')]], null, 'Pães e torradas')
                  .concat(opcoesPorSecao(CATALOGO.frutas)) },
      ]},

      // Pausada: a nutricionista liberou e ela não estava mais fazendo.
      // Fica no plano (editável, reativável), só sai do Hoje e da Alimentação.
      { id: 'r-lm', nome: 'Lanche da manhã', hora: '10:00', pausada: true, grupos: [
        { id: 'g-lm-olea', nome: 'Oleaginosas', qtd: 1, selecao: 'unica',
          opcoes: opcoesPorSecao(CATALOGO.oleaginosas) },
        { id: 'g-lm-cha', nome: 'Chá', qtd: 1, selecao: 'unica',
          opcoes: opcoesPorSecao(CATALOGO.chas, med(1, 'xc')) },
      ]},

      { id: 'r-almoco', nome: 'Almoço', hora: '12:30', grupos: [
        { id: 'g-al-a', nome: 'Vegetais do Grupo A', qtd: 6, min: 2, selecao: 'multipla',
          obs: 'À vontade — marque o que entrou no prato.',
          opcoes: opcoes(CATALOGO.grupoA, med(null, 'à vontade')) },
        { id: 'g-al-b', nome: 'Vegetais do Grupo B', qtd: 1, selecao: 'unica',
          obs: '2 colheres de sopa.',
          opcoes: opcoes(CATALOGO.grupoB, med(50, 'g')) },
        { id: 'g-al-prot', nome: 'Proteína', qtd: 1, selecao: 'unica',
          opcoes: opcoesPorSecao(CATALOGO.proteinas, med(150, 'g')) },
      ]},

      { id: 'r-lt', nome: 'Lanche da tarde', hora: '15:30', grupos: [
        { id: 'g-lt-fruta', nome: 'Fruta ou oleaginosa', qtd: 1, selecao: 'unica',
          opcoes: opcoesPorSecao(CATALOGO.frutas).concat(opcoesPorSecao(CATALOGO.oleaginosas)) },
        { id: 'g-lt-cha', nome: 'Chá', qtd: 1, selecao: 'unica',
          opcoes: opcoesPorSecao(CATALOGO.chas, med(1, 'xc')) },
      ]},

      { id: 'r-jantar', nome: 'Jantar', hora: '19:30', grupos: [
        { id: 'g-ja-a', nome: 'Vegetais do Grupo A', qtd: 6, min: 2, selecao: 'multipla',
          obs: 'À vontade — marque o que entrou no prato.',
          opcoes: opcoes(CATALOGO.grupoA, med(null, 'à vontade')) },
        { id: 'g-ja-prot', nome: 'Proteína', qtd: 1, selecao: 'unica',
          opcoes: opcoesPorSecao(CATALOGO.proteinas, med(150, 'g')) },
      ]},

      { id: 'r-ceia', nome: 'Ceia', hora: '21:30', pausada: true, grupos: [
        { id: 'g-ceia', nome: 'Opção da ceia', qtd: 1, selecao: 'unica',
          opcoes: opcoes([['Suco de uva integral', med(150, 'ml')],
                          ['Gelatina zero açúcar', med(150, 'ml')],
                          ['Leite desnatado', med(150, 'ml')]]) },
      ]},
    ],
  }],

  // Mounjaro NÃO entra aqui: a aplicação acontece na sessão da clínica e fica
  // registrada junto com a pesagem, no fluxo da Agenda.
  medicamentos: [
    { id: 'm-coentro', nome: 'Tintura de coentro', forma: 'gotas', dose: '20 gotas em 100 ml',
      hora: '12:00', frequencia: 'diaria', dias: [], obs: 'Antes das principais refeições — tomar antes do almoço.', ativo: true },
    { id: 'm-multi', nome: 'Multiminerais', forma: 'capsula', dose: '2 cápsulas',
      hora: '13:30', frequencia: 'diaria', dias: [], obs: 'Depois do almoço.', ativo: true },
    { id: 'm-berberina', nome: 'Berberina', forma: 'capsula', dose: '2 cápsulas',
      hora: '19:15', frequencia: 'diaria', dias: [], obs: 'Uma vez ao dia, junto da refeição — antes do jantar.', ativo: true },
    { id: 'm-sono', nome: 'Shot do sono', forma: 'gotas', dose: '20 gotas em 100 ml',
      hora: '22:00', frequencia: 'diaria', dias: [], obs: 'Dissolver em água ou chá, antes de dormir.', ativo: true },
  ],

  exercicios: ['Academia', 'Musculação', 'Caminhada', 'Corrida', 'Bicicleta',
               'Dança', 'Pilates', 'Funcional', 'Outro'],

  // O que costuma acontecer num dia de sessão
  // A aplicação do Mounjaro é SEMPRE na clínica, junto da sessão — por isso ela
  // vive aqui e não na lista de medicamentos do dia a dia.
  procedimentos: ['Aplicação de Mounjaro', 'Manta térmica', 'Drenagem linfática', 'Avaliação'],
};

// Suba este número toda vez que o SEED mudar de verdade (plano novo da clínica,
// medicamento novo). É o que faz a mudança chegar em quem já abriu o app —
// sem isso o iniciarDB() só semeia chave que ainda não existe, e o aparelho
// fica preso no plano antigo pra sempre.
/** Só nestes a distância diz alguma coisa — perguntar quilômetros de pilates
 *  seria um campo pra ela ignorar todo dia. */
const EXERCICIOS_COM_DISTANCIA = ['Caminhada', 'Corrida', 'Bicicleta', 'Natação'];
const temDistancia = tipo => EXERCICIOS_COM_DISTANCIA.includes(tipo);

const SEED_VERSAO = 8;
const ID_DIETA_CLINICA = 'dieta-clinica-v' + SEED_VERSAO;

const CHAVES_DADOS = [
  'perfil', 'dietas', 'medicamentos', 'exercicios', 'procedimentos',
  'logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios',
  'pesos', 'sessoes', 'scores', 'relatorios', 'conquistas', 'logSono', 'seedVersao',
];

function iniciarDB() {
  if (!DB.get('perfil'))        DB.set('perfil', SEED.perfil);
  if (!DB.get('dietas'))        DB.set('dietas', SEED.dietas);
  if (!DB.get('medicamentos'))  DB.set('medicamentos', SEED.medicamentos);
  if (!DB.get('exercicios'))    DB.set('exercicios', SEED.exercicios);
  if (!DB.get('procedimentos')) DB.set('procedimentos', SEED.procedimentos);
  ['logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios',
   'pesos', 'sessoes', 'scores', 'relatorios', 'conquistas', 'logSono']
    .forEach(k => { if (!DB.get(k)) DB.set(k, []); });

  // Completa campos que possam faltar num perfil salvo por versão antiga
  const p = DB.get('perfil');
  let mudou = false;
  Object.entries(SEED.perfil).forEach(([k, v]) => {
    if (p[k] === undefined) { p[k] = v; mudou = true; }
  });
  if (mudou) DB.set('perfil', p);

  migrarSeed();
}

/** Leva o plano novo pra quem já tinha o app aberto.
 *  - Sem histórico de refeição: troca o plano de exemplo direto, sem cerimônia.
 *  - Com histórico: entra como NOVA versão e arquiva a antiga, porque cada
 *    registro guarda o dietaId da época e o passado não pode mudar. */
function migrarSeed() {
  if ((DB.get('seedVersao') || 1) >= SEED_VERSAO) return;

  const dietas = DB.get('dietas') || [];
  const jaTem = dietas.some(d => d.id === ID_DIETA_CLINICA);   // guarda anti-duplicata
  const temHistorico = (DB.get('logRefeicoes') || []).length > 0;

  if (!jaTem) {
    if (temHistorico) {
      dietas.forEach(d => { d.ativa = false; });
      dietas.push({ ...JSON.parse(JSON.stringify(SEED.dietas[0])),
                    id: ID_DIETA_CLINICA, nome: `Dieta ${dietas.length + 1}`, criadaEm: dataLocal(), ativa: true });
      DB.set('dietas', dietas);
    } else {
      DB.set('dietas', JSON.parse(JSON.stringify(SEED.dietas)));
    }
  }

  // Medicamentos: com histórico só acrescenta o que falta (nunca apaga o dela).
  // Sem histórico, o plano da clínica manda. Em qualquer caso o Mounjaro sai:
  // a aplicação é sempre na clínica, e virou procedimento da sessão.
  let meds = temHistorico ? (DB.get('medicamentos') || []) : [];
  SEED.medicamentos.forEach(m => { if (!meds.some(x => x.id === m.id)) meds.push({ ...m }); });
  meds = meds.filter(m => !/mounjaro/i.test(m.nome || ''));
  meds.forEach(m => { if (!m.forma) m.forma = 'capsula'; });   // campo novo
  DB.set('medicamentos', meds);

  const procs = DB.get('procedimentos') || [];
  SEED.procedimentos.forEach(p => { if (!procs.includes(p)) procs.push(p); });
  DB.set('procedimentos', procs);

  const tipos = DB.get('exercicios') || [];
  SEED.exercicios.forEach(t => { if (!tipos.includes(t)) tipos.push(t); });
  DB.set('exercicios', tipos);

  DB.set('seedVersao', SEED_VERSAO);
}

// ── Atalhos de leitura ───────────────────────────────────────────
const perfil     = () => DB.get('perfil') || SEED.perfil;
const dietaAtiva = () => (DB.get('dietas') || []).find(d => d.ativa) || null;
const hoje       = () => dataLocal();

/** Refeições em uso de verdade — as pausadas (ex.: lanche da manhã, ceia)
 *  continuam no plano pra reativar, mas somem do dia a dia. */
const refeicoesAtivas = dieta => (dieta ? dieta.refeicoes.filter(r => !r.pausada) : []);

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

/** A água em jejum NÃO tem registro próprio: ela é um `logAgua` com origem
 *  marcada. Assim já soma no total do dia sozinha, o ↺ desfaz sem tratamento
 *  especial, e sincroniza junto com o resto — nada pra dessincronizar. */
const jejumDoDia = data =>
  (DB.get('logAgua') || []).find(l => l.data === data && l.origem === 'jejum') || null;

// ══ NOTA DO DIA ════════════════════════════════════════════════
// Refeições 40 · água 25 · medicamentos 20 · exercício 15.
// Em dia SEM treino os 15 pontos do exercício se redistribuem — não dá
// pra perder ponto por não treinar num dia de descanso.
function notaDoDia(data) {
  const dieta = dietaAtiva();
  const refs  = refeicoesAtivas(dieta);
  const meds  = medsDoDia(data);
  const treina = ehDiaDeTreino(data);

  // Só conta pra nota o que ainda está ativo — um log perdido de refeição
  // pausada (ou uma refeição extra, sem refeicaoId) não infla o placar.
  const idsAtivos = new Set(refs.map(r => r.id));
  const logR = (DB.get('logRefeicoes') || [])
    .filter(l => l.data === data && l.status === 'feita' && idsAtivos.has(l.refeicaoId));
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
// `duplo: true` exige DOIS toques no botão: o primeiro só arma. Os Ajustes são
// o coração do app — desconfigurar o plano sem querer estraga o histórico —
// então lá tudo que apaga ou troca passa por aqui.
let _confirmaOk = null;
let _confirmaArmado = false;

function confirmar(titulo, texto, rotuloOk, onOk, opts = {}) {
  _confirmaOk = onOk;
  _confirmaArmado = !opts.duplo;
  document.getElementById('confirma-titulo').textContent = titulo;
  document.getElementById('confirma-texto').textContent = texto;

  const b = document.getElementById('confirma-ok');
  b.textContent = rotuloOk;
  b.dataset.rotulo = rotuloOk;
  b.dataset.duplo = opts.duplo ? '1' : '';
  b.className = 'btn btn-cheio' + (opts.perigo ? ' btn-perigo' : '');

  const aviso = document.getElementById('confirma-aviso');
  aviso.textContent = opts.duplo ? 'Esta ação mexe no plano — vai pedir confirmação duas vezes.' : '';
  aviso.style.display = opts.duplo ? 'block' : 'none';

  document.getElementById('confirma').classList.add('on');
}

function fecharConfirma(executar) {
  const b = document.getElementById('confirma-ok');

  // Primeiro toque num confirme duplo: arma e espera o segundo.
  if (executar && b.dataset.duplo && !_confirmaArmado) {
    _confirmaArmado = true;
    b.textContent = 'Tenho certeza';
    b.classList.add('armado');
    document.getElementById('confirma-aviso').textContent = 'Toque de novo para confirmar.';
    return;
  }

  document.getElementById('confirma').classList.remove('on');
  b.classList.remove('armado');
  b.textContent = b.dataset.rotulo || 'Confirmar';
  const fn = _confirmaOk;
  _confirmaOk = null;
  _confirmaArmado = false;
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

/** Horário tocável: abre a rodinha nativa do iPhone (hora + minuto) no toque.
 *  O input fica POR CIMA, invisível, e quem aparece é o nosso texto — estilizar
 *  o controle nativo do Safari não é confiável e o tamanho dele varia sozinho
 *  (foi exatamente o que causou os campos sobrepostos). Assim a gente fica com
 *  o visual e o iPhone fica com o seletor bom. */
function horaToqueHTML(valor, aoMudar, cls = '') {
  return `<span class="hora-toque ${cls}">
    <span class="hora-toque-v num">${esc(valor)}</span>
    <input type="time" value="${esc(valor)}" aria-label="Escolher o horário"
           onchange="${aoMudar}">
  </span>`;
}

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

// ── Comemoração ──────────────────────────────────────────────────
/** Pétalas caindo — só nos momentos que merecem: dia 100%, conquista nova,
 *  sessão concluída. Puro CSS, some sozinha, respeita reduced-motion. */
function chuvaDePetalas() {
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cx = document.createElement('div');
  cx.className = 'petalas';
  cx.setAttribute('aria-hidden', 'true');
  for (let k = 0; k < 14; k++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDelay = (Math.random() * .5).toFixed(2) + 's';
    p.style.animationDuration = (2.2 + Math.random() * 1.4).toFixed(2) + 's';
    p.style.setProperty('--giro', Math.round(Math.random() * 720 - 360) + 'deg');
    cx.appendChild(p);
  }
  document.body.appendChild(cx);
  setTimeout(() => cx.remove(), 4200);
}

/** Anima um número de um valor a outro — a nota do dia subindo. */
function animarNumero(el, de, para, sufixo = '') {
  if (de === para) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.innerHTML = para + sufixo;
    return;
  }
  const t0 = performance.now(), dur = 550;
  const passo = agora => {
    const t = Math.min(1, (agora - t0) / dur);
    const suave = 1 - Math.pow(1 - t, 3);
    el.innerHTML = Math.round(de + (para - de) * suave) + sufixo;
    if (t < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
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
