/* ══ FLORESCER — Tela Hoje ═══════════════════════════════════════
   90% do uso do app acontece aqui. Nada sai desta tela para registrar
   nada: água é card fixo, refeição/treino/remédio abrem bottom sheet.

   O FIO DO DIA: a timeline e a barra de progresso são o mesmo objeto.
   A fita vem preenchida até o item atual; o item atual é o card grande.
   ════════════════════════════════════════════════════════════════ */

const AGUA_BOTOES = [200, 300, 500, 1000];

/** Monta os nós do dia, em ordem de horário. */
function itensDoDia(data) {
  const itens = [];
  const dieta = dietaAtiva();

  // Abre o dia, antes de tudo — é o que "em jejum" quer dizer.
  if (perfil().registrarJejum) itens.push({
    tipo: 'jejum', id: 'jejum', hora: '00:01', nome: 'Água em jejum',
  });

  // Sem horário fixo: `hora` aqui é só posição interna no dia (a ordem que a
  // clínica pensou), nunca uma promessa mostrada pra ela. O horário que
  // aparece de verdade é o que ela registrou na hora que confirmou.
  if (dieta) refeicoesAtivas(dieta).forEach(r => itens.push({
    tipo: 'refeicao', id: r.id, hora: r.hora, nome: r.nome, ref: r,
  }));

  medsDoDia(data).forEach(m => itens.push({
    tipo: 'remedio', id: m.id, hora: m.hora, nome: m.nome, ref: m,
  }));

  if (ehDiaDeTreino(data)) itens.push({
    tipo: 'treino', id: 'treino', hora: perfil().horaExercicio || '18:00', nome: 'Exercício',
  });

  (DB.get('sessoes') || []).filter(s => s.data === data).forEach(s => itens.push({
    tipo: 'sessao', id: s.id, hora: s.hora || '09:00', nome: 'Sessão na clínica', ref: s,
  }));

  // Refeições extras registradas neste dia — nascem prontas, na hora real
  // que ela marcou, e entram no fio na posição que essa hora ocupa.
  (DB.get('logRefeicoes') || []).filter(l => l.data === data && l.extra).forEach(l => itens.push({
    tipo: 'refeicao-extra', id: l.id, hora: l.hora, ordem: l.ordem,
    nome: l.refeicaoNome || 'Refeição extra', estado: 'feito', log: l,
  }));

  // Último item do dia: ela dá o check quando deita, e o app carimba a hora.
  if (perfil().registrarSono) itens.push({
    tipo: 'dormir', id: 'dormir', hora: perfil().horaSono || '23:00', nome: 'Dormir',
  });

  // Estado de cada nó
  const logR = (DB.get('logRefeicoes') || []).filter(l => l.data === data);
  const logM = (DB.get('logMedicamentos') || []).filter(l => l.data === data);
  const logE = (DB.get('logExercicios') || []).filter(l => l.data === data);
  const logS = (DB.get('logSono') || []).filter(l => l.data === data);

  itens.forEach(i => {
    if (i.tipo === 'refeicao') {
      const l = logR.find(x => x.refeicaoId === i.id);
      i.estado = l ? (l.status === 'pulada' ? 'pulado' : 'feito') : 'pendente';
      i.log = l || null;
    } else if (i.tipo === 'refeicao-extra') {
      // já vem pronta lá em cima
    } else if (i.tipo === 'remedio') {
      i.log = logM.find(x => x.medId === i.id) || null;
      i.estado = i.log ? 'feito' : 'pendente';
    } else if (i.tipo === 'treino') {
      i.logs = logE;                       // pode ter mais de uma atividade no dia
      i.log = logE[0] || null;
      i.estado = logE.length ? 'feito' : 'pendente';
    } else if (i.tipo === 'dormir') {
      i.log = logS[0] || null;
      i.estado = i.log ? 'feito' : 'pendente';
    } else if (i.tipo === 'jejum') {
      i.log = jejumDoDia(data);
      i.estado = i.log ? 'feito' : 'pendente';
    } else {
      i.estado = i.ref.feita ? 'feito' : 'pendente';
    }
  });

  return itens.sort((a, b) => ordemDoItem(a) - ordemDoItem(b));
}

/** Onde o item senta no fio. Os do plano usam a `hora` interna (a ordem que a
 *  clínica pensou). A refeição extra usa a `ordem` que ela ganhou ao ser
 *  criada — ver `ordemParaExtra()`. Registro antigo, sem `ordem`, cai na hora. */
function ordemDoItem(i) {
  if (i.tipo === 'refeicao-extra' && i.ordem != null) return i.ordem;
  return minutosDe(i.hora);
}

/** A extra entra ONDE ELA ACONTECEU NA SEQUÊNCIA DELA, não onde o relógio diz.
 *  Comeu algo às 22h mas ainda nem tinha marcado o café? Então aconteceu antes
 *  do café, e é ali que ela entra — senão a extra pularia pro fim do dia e a
 *  próxima refeição pendente deixaria de ser a próxima. O relógio continua
 *  guardado e aparece como carimbo; o que muda é só a posição. */
function ordemParaExtra(data) {
  const itens = itensDoDia(data);          // a nova ainda não existe aqui
  let ultimo = -1, primeiro = 24 * 60 + 1;

  itens.forEach(i => {
    const k = ordemDoItem(i);
    if (i.estado === 'pendente') { if (k < primeiro) primeiro = k; }
    else if (k > ultimo) ultimo = k;
  });

  // Fora de ordem (pendente antes de coisa já feita): fica logo após o último feito
  if (primeiro <= ultimo) return ultimo + 0.5;
  return (ultimo + primeiro) / 2;
}

// ══ Render principal ═══════════════════════════════════════════
RENDER.hoje = function () {
  const data = hoje();
  const p = perfil();
  const itens = itensDoDia(data);
  const { nota } = notaDoDia(data);

  const pendentes = itens.filter(i => i.estado === 'pendente');
  const ativo = pendentes[0] || null;

  const el = document.getElementById('tela-hoje');
  el.innerHTML = `
    <header class="cabeca">
      <div class="cabeca-txt">
        <h1>${esc(saudacao())}, ${esc(p.nome || 'você')} <span aria-hidden="true">🌸</span></h1>
        <div class="data">${esc(fmt.longa(data))}</div>
      </div>
      <div class="nota">
        <div class="n num" style="${nota >= 100 ? 'color:var(--ouro-forte)' : ''}">${nota}<sup>%</sup></div>
        <div class="cap">do dia</div>
      </div>
    </header>

    <div id="card-agua"></div>

    <div class="fio" id="fio">
      ${itens.map(i => noHTML(i, ativo && i === ativo)).join('')}
    </div>

    <button class="btn btn-vazio btn-sm" style="width:100%;margin-top:14px" onclick="abrirRefeicaoExtra()">${IC.mais} Refeição extra</button>

    ${ativo ? '' : fimDoDiaHTML(itens, nota)}
  `;

  renderAgua();
  ajustarFio();
};

/** Altura do preenchimento do fio = até a conta do item atual. */
function ajustarFio() {
  const fio = document.getElementById('fio');
  if (!fio) return;
  const alvo = fio.querySelector('.no.agora');
  const h = alvo
    ? alvo.offsetTop + (alvo.querySelector('.card-agora') ? 26 : alvo.offsetHeight / 2)
    : fio.offsetHeight - 22;                      // dia inteiro percorrido
  fio.style.setProperty('--fio-preenchido', Math.max(0, h - 14) + 'px');
}

// As fontes chegam depois do primeiro layout e mudam as alturas — recalcula.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => { if (telaAtual === 'hoje') ajustarFio(); });
}

// ── Um nó do fio ─────────────────────────────────────────────────
// A cor conta o ESTADO (feito / agora / pendente); o ícone conta a CATEGORIA —
// e nos remédios ele diferencia gota de cápsula, que é o que ela precisa saber
// antes de abrir qualquer coisa.
function iconeItem(i) {
  if (i.tipo === 'refeicao' || i.tipo === 'refeicao-extra') return IC.refeicao;
  if (i.tipo === 'treino')   return IC.treino;
  if (i.tipo === 'sessao')   return IC.sessao;
  if (i.tipo === 'dormir')   return IC.lua;
  if (i.tipo === 'jejum')    return IC.agua;
  return i.ref && i.ref.forma === 'gotas' ? IC.gota : IC.capsula;
}

/** Cada categoria tem sua cor no fio: bate o olho e já sabe o que é aquilo,
 *  sem ler. Refeição fica na tinta padrão (é a maioria das linhas). */
function corDoItem(i) {
  if (i.tipo === 'remedio') return 'cat-remedio';
  if (i.tipo === 'treino')  return 'cat-treino';
  if (i.tipo === 'sessao')  return 'cat-sessao';
  if (i.tipo === 'dormir')  return 'cat-dormir';
  if (i.tipo === 'jejum')   return 'cat-agua';
  return 'cat-refeicao';
}

/** NADA no dia tem hora marcada. O horário é sempre um carimbo do que já
 *  aconteceu: aparece depois de registrado, com a hora real, na coluna da
 *  esquerda. A única exceção é a sessão da clínica — ali é hora marcada de
 *  verdade, um compromisso fora de casa que ela precisa saber antes. */
function horaVisivel(i) {
  if (i.tipo === 'sessao') return i.hora;
  if (i.tipo === 'refeicao-extra') return i.hora;
  // Treinou de manhã e à tarde? A coluna mostra quando ela COMEÇOU o dia de
  // treino; o tempo somado vai pro detalhe, à direita.
  if (i.tipo === 'treino') {
    const horas = (i.logs || []).map(l => l.hora).filter(Boolean).sort();
    return horas[0] || '';
  }
  return i.log ? i.log.hora : '';
}

/** O "quanto", que não é horário e por isso não cabe na coluna dele. */
function detalheItem(i) {
  if (i.tipo === 'jejum')  return i.log ? `${i.log.ml} ml` : '';
  if (i.tipo === 'treino') {
    const min = (i.logs || []).reduce((s, l) => s + (l.duracao || 0), 0);
    return min ? fmt.duracao(min) : '';
  }
  return '';
}

function noHTML(i, ativo) {
  if (ativo) return cardAgoraHTML(i);

  const cls = ['no', corDoItem(i),
    i.estado === 'feito' ? 'feito' : i.estado === 'pulado' ? 'pulado' : ''].join(' ');
  const marca = i.estado === 'feito' ? IC.check
              : i.estado === 'pulado' ? '<span style="font-size:13px">—</span>'
              : '';
  const det = detalheItem(i);
  const hora = horaVisivel(i);
  return `
    <div class="${cls}">
      <button class="no-linha" onclick="abrirItem('${i.tipo}','${esc(i.id)}')">
        ${hora ? `<span class="no-hora num">${esc(hora)}</span>` : ''}
        <span class="no-cat">${iconeItem(i)}</span>
        <span class="no-nome">${esc(i.nome)}</span>
        ${det ? `<span class="no-det">${esc(det)}</span>` : ''}
        <span class="no-ic" ${det ? '' : 'style="margin-left:auto"'}>${marca}</span>
      </button>
    </div>`;
}

// ── O card grande: a próxima coisa a fazer ───────────────────────
function cardAgoraHTML(i) {
  // Só a sessão na clínica tem hora marcada — logo, é a única que pode atrasar.
  const semHorario = i.tipo !== 'sessao';
  const agora = minutosDe(horaLocal());
  const atrasado = !semHorario && minutosDe(i.hora) < agora - 20;

  let oque = '', acoes = '';

  if (i.tipo === 'refeicao') {
    oque = resumoRefeicao(i.ref);
    acoes = `<button class="btn btn-cheio" onclick="abrirRefeicao('${esc(i.id)}')">Montar ${primeiraPalavra(i.nome)}</button>`;
  } else if (i.tipo === 'remedio') {
    oque = [i.ref.dose, i.ref.obs].filter(Boolean).join(' · ');
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="tomarMedicamento('${esc(i.id)}')">Tomei</button>`;
  } else if (i.tipo === 'treino') {
    oque = 'Escolha o que você fez hoje. Dá pra registrar mais de uma atividade.';
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="abrirExercicio()">Registrar treino</button>`;
  } else if (i.tipo === 'dormir') {
    oque = 'Feche o dia quando estiver deitada — o app guarda a hora.';
    acoes = `<button class="btn btn-cheio" style="background:var(--tinta-dim);color:#fff" onclick="abrirSono()">Vou dormir</button>`;
  } else if (i.tipo === 'jejum') {
    oque = 'Água pura, antes do café e de qualquer outra coisa.';
    acoes = `<button class="btn btn-cheio btn-ceu" onclick="abrirJejum()">Bebi em jejum</button>`;
  } else {
    const etapa = etapaSessao(i.ref);
    oque = etapa === 'chegada'
      ? [i.ref.clinica, 'Pese-se ao chegar, antes dos procedimentos.'].filter(Boolean).join(' · ')
      : `Chegou com ${fmt.peso(i.ref.pesoEntrada)}. Falta registrar o peso de saída.`;
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="abrirSessao('${esc(i.id)}')">
      ${etapa === 'chegada' ? 'Cheguei na clínica' : 'Continuar a sessão'}</button>`;
  }

  return `
    <div class="no agora ${corDoItem(i)}">
      <div class="card-agora ${atrasado ? 'tarde' : ''}">
        <div class="quando">
          <span class="quando-ic">${iconeItem(i)}</span>
          <span>${atrasado ? 'Passou da hora' : 'Agora'}</span>
          ${semHorario ? '' : `<span class="h">· ${esc(i.hora)}</span>`}
        </div>
        <h3>${esc(i.nome)}</h3>
        ${oque ? `<p class="oque">${esc(oque)}</p>` : ''}
        <div class="acoes">${acoes}</div>
      </div>
    </div>`;
}

const primeiraPalavra = s => String(s).split(' ')[0].toLowerCase();

/** Resumo curto do que a refeição pede. Onde existe bloco, o bloco é o nome
 *  que importa ("Suco verde", não "folhas + fruta + completar"), e grupos que
 *  só aparecem depois de uma escolha ficam de fora. */
function resumoRefeicao(r) {
  const nomes = [];
  r.grupos.forEach(g => {
    if (g.dependeDe) return;
    const nome = (g.bloco || g.nome).toLowerCase();
    if (!nomes.includes(nome)) nomes.push(nome);
  });
  return nomes.slice(0, 3).join(' · ') + (nomes.length > 3 ? ` +${nomes.length - 3}` : '');
}

function fimDoDiaHTML(itens, nota) {
  if (!itens.length) {
    return `<div class="fim-dia" style="margin-top:18px">
      <div class="flor" aria-hidden="true">🌱</div>
      <h3>Nada marcado hoje</h3>
      <p>Cadastre o plano alimentar e os medicamentos em Ajustes.</p>
    </div>`;
  }
  const feitos = itens.filter(i => i.estado === 'feito').length;
  const falta = perfil().metaAgua - aguaDoDia(hoje());
  const msg = falta > 0 ? `Só falta a água: mais ${esc(fmt.litros(falta))} até a meta.`
            : nota >= 100 ? 'Dia perfeito. Cada item do plano, cumprido.'
            : nota >= 70  ? `${feitos} de ${itens.length} concluídos. Bom dia de tratamento.`
            :               'Amanhã tem mais. O que ficou pra trás não volta pra te cobrar.';
  return `
    <div class="fim-dia" style="margin-top:18px">
      <div class="flor" aria-hidden="true">${falta > 0 ? '💧' : '🌷'}</div>
      <h3>${falta > 0 ? 'Tudo feito por hoje' : 'Dia completo'}</h3>
      <p>${msg}</p>
    </div>`;
}

// ── Roteamento do toque num nó ───────────────────────────────────
function abrirItem(tipo, id) {
  if (tipo === 'jejum')          return abrirJejum();
  if (tipo === 'refeicao')       return abrirRefeicao(id);
  if (tipo === 'refeicao-extra') return abrirRefeicaoExtra(id);
  if (tipo === 'remedio')        return abrirMedicamento(id);
  if (tipo === 'treino')         return abrirExercicio();
  if (tipo === 'dormir')         return abrirSono();
  return abrirSessao(id);
}

// ══ ÁGUA EM JEJUM ══════════════════════════════════════════════
// Primeira coisa do dia. Não vira registro próprio: grava direto em `logAgua`
// com origem 'jejum', então já soma no contador sozinha — pedir pra ela marcar
// a mesma água duas vezes seria o tipo de atrito que faz largar o app.
// Fora da nota de propósito (ela já pontua pela água), igual ao Dormir.

let jejumMl = 300;
let jejumHora = null;
const JEJUM_OPCOES = [200, 300, 500];

function abrirJejum() {
  const log = jejumDoDia(hoje());
  jejumMl = log ? log.ml : (perfil().mlJejum || 300);
  jejumHora = log ? log.hora : horaLocal();

  abrirSheet('<div class="sheet-alca"></div><div id="jejum-cx"></div>', () => RENDER.hoje());
  renderJejum();
}

function renderJejum() {
  const cx = document.getElementById('jejum-cx');
  if (!cx) return;
  const log = jejumDoDia(hoje());
  const total = aguaDoDia(hoje());

  cx.innerHTML = `
    <div class="sheet-cabeca">
      <div style="flex:1;min-width:0">
        <h2>Água em jejum</h2>
        <div class="dica">${log ? `Você registrou ${esc(String(log.ml))} ml às ${esc(log.hora)}.`
                               : 'Água pura, antes de comer qualquer coisa.'}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>

    <div class="sheet-corpo">
      <div class="grupo">
        <div class="grupo-topo">
          <span class="grupo-nome">Quanto você bebeu</span>
          <span class="grupo-cont num">${jejumMl} ml</span>
        </div>
        <div class="chips" style="margin-bottom:12px">
          ${JEJUM_OPCOES.map(ml => `<button class="chip ${jejumMl === ml ? 'on' : ''}"
              onclick="definirJejum(${ml})">${ml} ml</button>`).join('')}
        </div>
        <div class="stepper" style="width:fit-content">
          <button onclick="definirJejum(${jejumMl - 50})" aria-label="Diminuir">−</button>
          <span class="stepper-v num">${jejumMl} ml</span>
          <button onclick="definirJejum(${jejumMl + 50})" aria-label="Aumentar">+</button>
        </div>
      </div>
      <div class="hora-registro" style="justify-content:flex-start">
        <span class="hora-registro-lbl">Bebi às</span>
        ${horaToqueHTML(jejumHora, 'definirHoraJejum(this.value)')}
      </div>

      <p class="sono-obs" style="text-align:left;padding:0">
        Isso já entra na conta de água do dia${log ? '' : ` — hoje você está em ${esc(fmt.litros(total))}`}.
        Não precisa marcar de novo no card lá em cima.
      </p>
    </div>

    <div class="sheet-pe">
      <button class="btn btn-cheio btn-ceu" style="width:100%" onclick="confirmarJejum()">
        ${log ? `Salvar ${jejumMl} ml` : `Bebi ${jejumMl} ml em jejum`}
      </button>
      ${log ? `<button class="link-fraco" onclick="desmarcarJejum()">Desmarcar</button>` : ''}
    </div>`;
}

function definirJejum(ml) {
  jejumMl = Math.max(50, Math.min(2000, Math.round(ml / 50) * 50));
  renderJejum();
}

/** Ela pode registrar de noite o copo que bebeu ao acordar — a hora tem que
 *  ser editável como em qualquer outro registro do app. */
function definirHoraJejum(v) {
  if (!v) return;
  jejumHora = v;
  renderJejum();
}

function confirmarJejum() {
  const data = hoje();
  const logs = (DB.get('logAgua') || []).filter(l => !(l.data === data && l.origem === 'jejum'));
  logs.push({ id: uid(), data, hora: jejumHora || horaLocal(), ml: jejumMl, origem: 'jejum' });
  DB.set('logAgua', logs);

  // Guarda o quanto ela costuma beber: amanhã o sheet já abre certo, num toque.
  const p = perfil();
  p.mlJejum = jejumMl;
  DB.set('perfil', p);

  fecharSheet();
  toast(`${jejumMl} ml em jejum · já entrou na conta do dia`);
  checarConquistas();
  RENDER.hoje();
}

function desmarcarJejum() {
  DB.set('logAgua', (DB.get('logAgua') || [])
    .filter(l => !(l.data === hoje() && l.origem === 'jejum')));
  fecharSheet();
  RENDER.hoje();
}

// ══ SONO ═══════════════════════════════════════════════════════
// Deitar depois da meia-noite ainda pertence ao dia que acabou — senão a noite
// de terça apareceria como se fosse a de quarta.
function diaDoSono() {
  const agora = new Date();
  return agora.getHours() < 5 ? somaDias(dataLocal(agora), -1) : dataLocal(agora);
}

let sonoHora = null;

/** Fecha o dia. Abre com a hora de agora, mas ajustável: muita gente lembra de
 *  marcar meia hora depois de já estar deitada, e aí o registro sairia errado. */
function abrirSono() {
  const data = diaDoSono();
  const log = (DB.get('logSono') || []).find(l => l.data === data);
  sonoHora = log ? log.hora : horaLocal();

  abrirSheet('<div class="sheet-alca"></div><div id="sono-cx"></div>', () => RENDER.hoje());
  renderSono();
}

function renderSono() {
  const cx = document.getElementById('sono-cx');
  if (!cx) return;
  const data = diaDoSono();
  const log = (DB.get('logSono') || []).find(l => l.data === data);
  const agora = horaLocal();

  cx.innerHTML = `
    <div class="sheet-cabeca">
      <div style="flex:1;min-width:0">
        <h2>Fim do dia</h2>
        <div class="dica">${log ? `Você registrou que deitou às ${esc(log.hora)}.`
                                : `São ${esc(agora)} agora.`}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>

    <div class="sheet-corpo">
      <div class="sono-relogio">
        <button class="peso-btn" onclick="ajustarSono(-5)" aria-label="5 minutos antes">−</button>
        ${horaToqueHTML(sonoHora, 'definirSono(this.value)')}
        <button class="peso-btn" onclick="ajustarSono(5)" aria-label="5 minutos depois">+</button>
      </div>
      <p class="sono-obs">${sonoHora === agora
        ? 'Se já faz um tempo que você deitou, toque na hora para escolher outra.'
        : 'Ajustado. Toque na hora para escolher outra.'}</p>
    </div>

    <div class="sheet-pe">
      <button class="btn btn-cheio btn-ceu" style="width:100%" onclick="confirmarSono()">
        ${log ? `Salvar ${esc(sonoHora)}` : 'Vou dormir agora'}
      </button>
      ${log ? `<button class="link-fraco" onclick="desmarcarSono()">Desmarcar</button>` : ''}
    </div>`;
}

function ajustarSono(delta) {
  const m = (minutosDe(sonoHora) + delta + 24 * 60) % (24 * 60);
  sonoHora = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  renderSono();
}

function definirSono(v) {
  if (!v) return;
  sonoHora = v;
  renderSono();
}

function confirmarSono() {
  registrarSono(sonoHora);
  fecharSheet();
}

function registrarSono(hora) {
  const data = diaDoSono();
  const logs = (DB.get('logSono') || []).filter(l => l.data !== data);
  const h = hora || horaLocal();
  logs.push({ id: uid(), data, hora: h });
  DB.set('logSono', logs);
  toast(`Boa noite 🌙 · deitou às ${h}`);
  RENDER.hoje();
}

function desmarcarSono() {
  DB.set('logSono', (DB.get('logSono') || []).filter(l => l.data !== diaDoSono()));
  fecharSheet();
  RENDER.hoje();
}

// ══ ÁGUA — card fixo, nunca abre outra tela ════════════════════

function renderAgua() {
  const cx = document.getElementById('card-agua');
  if (!cx) return;
  const data = hoje();
  const meta = perfil().metaAgua || 3000;
  const total = aguaDoDia(data);
  const temLog = (DB.get('logAgua') || []).some(l => l.data === data);

  const SEGS = 10;
  const porSeg = meta / SEGS;
  const copos = Array.from({ length: SEGS }, (_, k) => {
    const f = Math.max(0, Math.min(1, (total - k * porSeg) / porSeg));
    return `<span class="copo"><i style="transform:scaleX(${f.toFixed(3)})"></i></span>`;
  }).join('');

  // A clínica pediu de 3 a 4 L: a meta é o piso, o ideal é o alvo do dia bom.
  // Deixa claro que o jejum já contou aqui — senão ela marca de novo no +200
  // e o dia fica com água que não existiu.
  const jejum = jejumDoDia(data);
  const ideal = perfil().metaAguaIdeal;
  let recado = '';
  if (ideal && total >= ideal)      recado = `<span class="agua-extra ouro">Chegou nos ${esc(fmt.litros(ideal))} — o topo do que a clínica pediu ✨</span>`;
  else if (total >= meta && ideal)  recado = `<span class="agua-extra">Meta batida. Faltam ${esc(fmt.litros(ideal - total))} para os ${esc(fmt.litros(ideal))} ideais.</span>`;
  else if (total >= meta)           recado = `<span class="agua-extra">Meta batida hoje.</span>`;

  cx.innerHTML = `
    <div class="agua">
      <div class="agua-topo">
        <span class="rotulo">Água</span>
        <span class="agua-val num">${esc(fmt.litros(total))} <small>de ${esc(fmt.litros(meta))}</small></span>
      </div>
      <div class="copos">${copos}</div>
      ${jejum ? `<span class="agua-extra">${esc(String(jejum.ml))} ml em jejum já entraram nesta conta.</span>` : ''}
      ${recado}
      <div class="agua-btns">
        ${AGUA_BOTOES.map(ml => `<button onclick="beberAgua(${ml})">+${ml >= 1000 ? '1L' : ml}</button>`).join('')}
        <button class="desfazer" onclick="desfazerAgua()" ${temLog ? '' : 'disabled'} aria-label="Desfazer última adição">↺</button>
      </div>
    </div>`;
}

function beberAgua(ml) {
  const meta = perfil().metaAgua || 3000;
  const antes = aguaDoDia(hoje());
  DB.push('logAgua', { id: uid(), data: hoje(), hora: horaLocal(), ml });
  const depois = antes + ml;

  renderAgua();
  atualizarNota();
  if (antes < meta && depois >= meta) {
    toast('Meta de água batida hoje 💧');
    checarConquistas();
  }
}

function desfazerAgua() {
  const logs = DB.get('logAgua') || [];
  for (let k = logs.length - 1; k >= 0; k--) {
    if (logs[k].data === hoje()) {
      logs.splice(k, 1);
      DB.set('logAgua', logs);
      renderAgua();
      atualizarNota();
      return;
    }
  }
}

/** Atualiza só o número da nota — sem re-render da tela inteira. */
function atualizarNota() {
  const el = document.querySelector('#tela-hoje .nota .n');
  if (!el) return;
  const antes = parseInt(el.textContent, 10) || 0;
  const { nota } = notaDoDia(hoje());
  animarNumero(el, antes, nota, '<sup>%</sup>');
  el.style.color = nota >= 100 ? 'var(--ouro-forte)' : '';
  if (nota >= 100 && antes < 100) chuvaDePetalas();
}

// ══ SHEET DA REFEIÇÃO — o fluxo mais importante do app ═════════
// A dieta já diz a quantidade (ex.: 150 g de proteína). Ela toca no alimento,
// a medida vem pronta e o −/+ ajusta sem teclado. Grupo completo se recolhe,
// então uma lista de 40 opções some da tela assim que ela escolhe.

let sel = {};              // { grupoId: [{opcaoId, nome, medida}] }
let refAtual = null;
let buscaGrupo = {};       // { grupoId: 'texto' } — filtro dos grupos grandes
let gruposAbertos = null;  // Set de grupos que ela mandou abrir de novo
let horaConfirmacao = null; // hora REAL do registro — ajustável, não vem do plano

const LIMITE_BUSCA = 12;   // a partir daqui o grupo ganha campo de busca

function abrirRefeicao(refeicaoId) {
  const dieta = dietaAtiva();
  if (!dieta) return toast('Cadastre um plano alimentar em Ajustes.');
  const r = dieta.refeicoes.find(x => x.id === refeicaoId);
  if (!r) return;

  refAtual = r;
  buscaGrupo = {};
  gruposAbertos = new Set();
  sel = {};
  r.grupos.forEach(g => { sel[g.id] = []; });

  // Reabrir uma refeição já registrada traz as escolhas de volta pra edição.
  const log = (DB.get('logRefeicoes') || []).find(l => l.data === hoje() && l.refeicaoId === r.id);
  horaConfirmacao = (log && log.status === 'feita') ? log.hora : horaLocal();
  if (log && log.status === 'feita') {
    (log.escolhas || []).forEach(e => {
      const g = r.grupos.find(x => x.id === e.grupoId);
      if (!g) return;
      sel[g.id] = itensDoLog(e)
        .filter(it => g.opcoes.some(o => o.id === it.opcaoId))
        .map(it => ({ ...it }));
    });
  }

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div>
        <h2>${esc(r.nome)}</h2>
        <div class="dica">${esc(resumoRefeicao(r))}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo" id="sheet-grupos"></div>
    <div class="sheet-pe" id="sheet-pe"></div>
  `);

  renderGrupos();
  renderPeRefeicao();
}

/** Aceita o formato novo (itens) e o antigo (opcaoIds), pro histórico não quebrar. */
function itensDoLog(escolha) {
  if (escolha.itens) return escolha.itens;
  return (escolha.opcaoIds || []).map(id => ({ opcaoId: id, nome: '', medida: null }));
}

// `min` = quantos ela PRECISA marcar (é o que decide se a refeição ficou
// completa). `qtd` = o teto de quantos cabem. Quando os dois são iguais, o
// grupo é exato ("1 de 1"); quando min < qtd, é "à vontade a partir de min".
const minDoGrupo = g => (g.min != null ? g.min : g.qtd);
function grupoCompleto(g) { return (sel[g.id] || []).length >= minDoGrupo(g); }
const grupoCheio  = g => (sel[g.id] || []).length >= g.qtd;

/** Um grupo pode depender de uma escolha anterior (a lista de chás só existe
 *  se ela marcou "Chá"). Grupo inativo não aparece nem entra na completude. */
function grupoAtivo(g) {
  if (!g.dependeDe) return true;
  return (sel[g.dependeDe.grupoId] || []).some(it => it.opcaoId === g.dependeDe.opcaoId);
}

const gruposAtivos = () => refAtual.grupos.filter(grupoAtivo);

/** Todo grupo tem nome que se sustenta sozinho ("Complementos do suco", não
 *  só "Completar"), então fora do sheet basta o nome — concatenar o bloco
 *  fazia "Bebida quente · Tipo de chá" parecer dois itens numa lista. */
const nomeCheio = g => g.nome;

function renderGrupos() {
  const cx = document.getElementById('sheet-grupos');
  if (!cx) return;

  // Três níveis de leitura: BLOCO (o suco verde inteiro) › grupo (folhas) ›
  // subgrupo (calmantes). Sem essa hierarquia tudo tinha o mesmo peso e a
  // tela virava uma lista embolada.
  const blocos = [];
  gruposAtivos().forEach(g => {
    const nome = g.bloco || null;
    const ultimo = blocos[blocos.length - 1];
    if (ultimo && ultimo.nome === nome) ultimo.grupos.push(g);
    else blocos.push({ nome, grupos: [g] });
  });

  // O botão de confirmar mora no FIM da rolagem, depois do último grupo: assim
  // ela passa o olho por tudo antes de salvar, em vez de marcar o primeiro
  // item e apertar salvar sem ver o resto.
  cx.innerHTML = blocos.map(b => b.nome
    ? `<section class="bloco">
         <h3 class="bloco-tit">${esc(b.nome)}</h3>
         ${b.grupos.map(grupoHTML).join('')}
       </section>`
    : `<section class="bloco bloco-solto">${b.grupos.map(grupoHTML).join('')}</section>`
  ).join('') + '<div id="fim-grupos"></div>';

  renderFimGrupos();
}

function renderFimGrupos() {
  const cx = document.getElementById('fim-grupos');
  if (!cx) return;

  const total = Object.values(sel).reduce((s, a) => s + a.length, 0);
  const faltando = gruposAtivos().filter(g => !grupoCompleto(g));
  const jaFeita = (DB.get('logRefeicoes') || [])
    .some(l => l.data === hoje() && l.refeicaoId === refAtual.id && l.status === 'feita');
  const anterior = ultimaEscolha(refAtual.id);

  cx.innerHTML = `
    ${anterior && !total ? `<button class="btn btn-vazio btn-sm" style="width:100%;margin-bottom:10px"
        onclick="repetirUltima()">↺ Repetir o que comi da última vez</button>` : ''}
    ${total && faltando.length ? `<div class="aviso-falta">
        Falta ${esc(fmt.lista(faltando.map(nomeCheio)))}. Pode confirmar assim mesmo —
        o relatório registra o que ficou de fora.</div>` : ''}
    ${total ? `<div class="hora-registro">
      <span class="hora-registro-lbl">${jaFeita ? 'Registrado às' : 'Confirmar às'}</span>
      ${horaToqueHTML(horaConfirmacao, 'definirHoraConfirmacao(this.value)')}
    </div>` : ''}
    <button class="btn btn-cheio" style="width:100%;margin-top:4px" onclick="confirmarRefeicao()"
      ${total ? '' : 'disabled'}>
      ${jaFeita ? 'Salvar alteração' : total && faltando.length ? 'Confirmar assim mesmo' : 'Confirmar ' + esc(primeiraPalavra(refAtual.nome))}
    </button>
    ${jaFeita
      ? `<button class="link-fraco" onclick="desmarcarRefeicao()">Desmarcar esta refeição</button>`
      : `<button class="link-fraco" onclick="pularRefeicao()">Não fiz esta refeição</button>`}
    <div style="height:6px"></div>`;
}

/** Hora REAL do registro: abre já em "agora", e o toque abre a rodinha do
 *  iPhone se ela lembrou depois de já ter comido. */
function definirHoraConfirmacao(v) {
  if (!v) return;
  horaConfirmacao = v;
  renderFimGrupos();
}

/** Rola até o primeiro grupo que ainda falta — é o que a barra de baixo faz
 *  enquanto a refeição não está completa. */
function irParaGrupoQueFalta() {
  const g = gruposAtivos().find(x => !grupoCompleto(x));
  const alvo = g && document.getElementById('grupo-' + g.id);
  const corpo = document.getElementById('sheet-grupos');
  if (!alvo || !corpo) return;
  corpo.scrollTo({ top: alvo.offsetTop - 12, behavior: 'smooth' });
}

function grupoHTML(g, gi) {
  const escolhidos = sel[g.id] || [];
  const completo = grupoCompleto(g);
  const cheio = grupoCheio(g);
  const min = minDoGrupo(g);
  // Só recolhe quando não cabe mais nada — se ainda dá pra incluir, ela vê.
  const recolhido = cheio && !gruposAbertos.has(g.id);
  const busca = (buscaGrupo[g.id] || '').trim().toLowerCase();

  const visiveis = busca
    ? g.opcoes.filter(o => semAcento(o.nome).includes(semAcento(busca)))
    : g.opcoes;

  return `
    <div class="grupo ${completo ? 'completo' : ''}" id="grupo-${esc(g.id)}">
      <div class="grupo-topo">
        <span class="grupo-nome">${esc(g.nome)}</span>
        <span class="grupo-cont num">${escolhidos.length} de ${min}${completo ? ' ✓' : ''}${
          !completo && g.qtd > min ? ` · até ${g.qtd}` : ''}</span>
      </div>
      ${g.obs && !recolhido ? `<p class="grupo-obs">${esc(g.obs)}</p>` : ''}

      ${escolhidos.map((it, i) => {
        const passo = passoDe(it.medida?.unidade);
        const livre = it.medida?.valor == null;
        return `
        <div class="escolhido">
          <span class="esc-nome">${esc(it.nome || nomeOpcao(g, it.opcaoId))}</span>
          ${livre
            ? `<span class="esc-livre">${esc(it.medida?.unidade || '')}</span>`
            : `<div class="stepper">
                 <button onclick="mudarMedida('${esc(g.id)}',${i},-${passo})" aria-label="Diminuir">−</button>
                 <span class="stepper-v num">${esc(medidaTexto(it.medida))}</span>
                 <button onclick="mudarMedida('${esc(g.id)}',${i},${passo})" aria-label="Aumentar">+</button>
               </div>`}
          <button class="esc-x" onclick="tirarEscolha('${esc(g.id)}',${i})" aria-label="Tirar">✕</button>
        </div>`;
      }).join('')}

      ${recolhido
        ? `<button class="trocar" onclick="abrirGrupo('${esc(g.id)}')">Trocar</button>`
        : `
          ${g.opcoes.length > LIMITE_BUSCA ? `
            <input class="busca-grupo" type="search" inputmode="search" placeholder="Buscar em ${g.opcoes.length} opções"
                   value="${esc(buscaGrupo[g.id] || '')}" oninput="filtrarGrupo('${esc(g.id)}', this.value)">` : ''}
          ${visiveis.length === 0
            ? '<span class="sem-achado">Nada com esse nome neste grupo.</span>'
            : chipsHTML(g, visiveis, escolhidos, cheio)}`}
    </div>`;
}

/** Chips agrupados pelos subgrupos do papel da clínica (Termogênicos,
 *  Diuréticos, Bovina, Peixes…). Sem seção, cai numa grade única. */
function chipsHTML(g, lista, escolhidos, cheio) {
  const chip = o => {
    const on = escolhidos.some(it => it.opcaoId === o.id);
    const travado = !on && cheio;
    return `<button class="chip ${on ? 'on' : ''} ${travado ? 'travado' : ''}"
              onclick="escolher('${esc(g.id)}','${esc(o.id)}')" aria-pressed="${on}">
              ${esc(o.nome)}${o.medida && o.medida.valor != null ? `<i class="chip-med">${esc(medidaTexto(o.medida))}</i>` : ''}
            </button>`;
  };

  if (!lista.some(o => o.secao)) return `<div class="chips">${lista.map(chip).join('')}</div>`;

  const secoes = [];
  lista.forEach(o => {
    const nome = o.secao || 'Outros';
    const s = secoes.find(x => x.nome === nome);
    if (s) s.itens.push(o); else secoes.push({ nome, itens: [o] });
  });

  // Uma seção só? O subtítulo repetiria o nome do grupo ("OLEAGINOSAS" duas
  // vezes seguidas). Nesse caso ele não acrescenta nada e sai.
  if (secoes.length === 1) return `<div class="chips">${lista.map(chip).join('')}</div>`;

  return secoes.map(s => `
    <div class="subgrupo">
      <div class="subgrupo-tit">${esc(s.nome)}</div>
      <div class="chips">${s.itens.map(chip).join('')}</div>
    </div>`).join('');
}

const semAcento = s => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const nomeOpcao = (g, id) => (g.opcoes.find(o => o.id === id) || {}).nome || '';

function filtrarGrupo(grupoId, texto) {
  buscaGrupo[grupoId] = texto;
  const g = refAtual.grupos.find(x => x.id === grupoId);
  // Redesenha só este grupo (achado pelo id, não pela posição), pra não perder
  // o foco do campo de busca enquanto ela digita.
  const alvo = document.getElementById('grupo-' + grupoId);
  if (!g || !alvo) return renderGrupos();

  const molde = document.createElement('div');
  molde.innerHTML = grupoHTML(g);
  const novo = molde.firstElementChild;
  const campo = alvo.querySelector('.busca-grupo');
  const pos = campo ? campo.selectionStart : null;
  alvo.replaceWith(novo);
  const novoCampo = novo.querySelector('.busca-grupo');
  if (novoCampo) { novoCampo.focus(); if (pos != null) novoCampo.setSelectionRange(pos, pos); }
}

function abrirGrupo(grupoId) {
  gruposAbertos.add(grupoId);
  renderGrupos();
}

/** Trocou "Chá" por "Café"? A lista de chás some — e o que ela tinha marcado
 *  lá dentro tem que sair junto, senão viraria escolha fantasma no registro. */
function limparGruposInativos() {
  refAtual.grupos.forEach(g => {
    if (!grupoAtivo(g) && (sel[g.id] || []).length) sel[g.id] = [];
  });
}

function escolher(grupoId, opcaoId) {
  const g = refAtual.grupos.find(x => x.id === grupoId);
  const o = g.opcoes.find(x => x.id === opcaoId);
  const atual = sel[grupoId] || [];
  const i = atual.findIndex(it => it.opcaoId === opcaoId);
  const novo = () => ({ opcaoId, nome: o.nome, medida: o.medida ? { ...o.medida } : null });

  if (i >= 0) {
    atual.splice(i, 1);
    gruposAbertos.add(grupoId);              // desmarcar mantém a lista aberta
  } else if (g.selecao === 'unica' && g.qtd === 1) {
    sel[grupoId] = [novo()];                 // troca direta, sem desmarcar antes
    gruposAbertos.delete(grupoId);
    limparGruposInativos();
    renderGrupos();
    return renderPeRefeicao();
  } else if (atual.length < g.qtd) {
    atual.push(novo());
    if (atual.length >= g.qtd) gruposAbertos.delete(grupoId);   // encheu: recolhe
  } else {
    return;                                   // grupo cheio: ignora o toque
  }
  sel[grupoId] = atual;
  limparGruposInativos();
  renderGrupos();
  renderPeRefeicao();
}

function tirarEscolha(grupoId, i) {
  (sel[grupoId] || []).splice(i, 1);
  gruposAbertos.add(grupoId);
  renderGrupos();
  renderPeRefeicao();
}

/** Ajusta a quantidade do item escolhido. Nunca desce de um passo. */
function mudarMedida(grupoId, i, delta) {
  const it = (sel[grupoId] || [])[i];
  if (!it || !it.medida || it.medida.valor == null) return;
  const passo = passoDe(it.medida.unidade);
  const bruto = Number(it.medida.valor) + delta;
  it.medida.valor = Math.round(Math.max(passo === 1 ? 0.5 : passo, bruto) * 10) / 10;
  renderGrupos();
}

/** Barra fixa embaixo: é SÓ indicador de progresso e atalho de navegação.
 *  O botão de confirmar existe uma vez só, no fim da rolagem — dois botões
 *  iguais na tela ao mesmo tempo confundem e tiram o sentido de ter posto o
 *  confirmar lá embaixo. */
function renderPeRefeicao() {
  const pe = document.getElementById('sheet-pe');
  if (!pe) return;
  renderFimGrupos();

  const ativos = gruposAtivos();
  const feitos = ativos.filter(grupoCompleto).length;
  const total = ativos.length;
  const completa = feitos === total;

  pe.innerHTML = `
    <button class="pe-progresso ${completa ? 'pronto' : ''}"
      onclick="${completa ? 'irParaConfirmar()' : 'irParaGrupoQueFalta()'}">
      <span class="pe-barra"><i style="transform:scaleX(${(feitos / total).toFixed(3)})"></i></span>
      <span class="pe-txt">${completa
        ? '<strong>Tudo escolhido ✓</strong> · toque para confirmar'
        : `<strong>${feitos} de ${total}</strong> grupos · toque para ir ao que falta`}</span>
    </button>`;
}

/** Leva até o botão de confirmar e chama atenção pra ele. */
function irParaConfirmar() {
  const corpo = document.getElementById('sheet-grupos');
  const alvo = document.getElementById('fim-grupos');
  if (!corpo || !alvo) return;
  corpo.scrollTo({ top: corpo.scrollHeight, behavior: 'smooth' });
  const btn = alvo.querySelector('.btn-cheio');
  if (!btn) return;
  btn.classList.remove('pulsa');
  void btn.offsetWidth;                 // reinicia a animação se já tocou antes
  btn.classList.add('pulsa');
}

/** Escolhas da última vez que ela fez essa refeição (qualquer dia anterior). */
function ultimaEscolha(refeicaoId) {
  const logs = (DB.get('logRefeicoes') || [])
    .filter(l => l.refeicaoId === refeicaoId && l.status === 'feita' && l.data < hoje())
    .sort((a, b) => (a.data < b.data ? 1 : -1));
  return logs[0] || null;
}

function repetirUltima() {
  const log = ultimaEscolha(refAtual.id);
  if (!log) return;
  refAtual.grupos.forEach(g => {
    const e = (log.escolhas || []).find(x => x.grupoId === g.id);
    sel[g.id] = e
      ? itensDoLog(e)
          .filter(it => g.opcoes.some(o => o.id === it.opcaoId))
          .slice(0, g.qtd)
          .map(it => ({ opcaoId: it.opcaoId, nome: it.nome || nomeOpcao(g, it.opcaoId), medida: it.medida ? { ...it.medida } : null }))
      : [];
    if (grupoCompleto(g)) gruposAbertos.delete(g.id);
  });
  renderGrupos();
  renderPeRefeicao();
  toast('Preenchido como da última vez');
}

function confirmarRefeicao() {
  const escolhas = gruposAtivos()
    .map(g => ({ grupoId: g.id, grupoNome: g.nome, itens: sel[g.id] || [] }))
    .filter(e => e.itens.length);
  if (!escolhas.length) return;

  const faltou = gruposAtivos().filter(g => !grupoCompleto(g)).map(nomeCheio);

  const logs = DB.get('logRefeicoes') || [];
  const i = logs.findIndex(l => l.data === hoje() && l.refeicaoId === refAtual.id);
  const reg = {
    id: i >= 0 ? logs[i].id : uid(),
    data: hoje(),
    dietaId: dietaAtiva().id,
    refeicaoId: refAtual.id,
    refeicaoNome: refAtual.nome,
    hora: horaConfirmacao || horaLocal(),   // a hora REAL do registro, ajustada por ela
    horaPlanejada: refAtual.hora,
    escolhas,
    completa: faltou.length === 0,
    faltou,
    status: 'feita',
  };
  if (i >= 0) logs[i] = reg; else logs.push(reg);
  DB.set('logRefeicoes', logs);

  fecharSheet();
  toast(faltou.length ? `${refAtual.nome} registrado — faltou ${fmt.lista(faltou)}`
                      : `${refAtual.nome} registrado`);
  checarConquistas();
  RENDER.hoje();
}

function pularRefeicao() {
  const logs = DB.get('logRefeicoes') || [];
  const i = logs.findIndex(l => l.data === hoje() && l.refeicaoId === refAtual.id);
  const reg = {
    id: i >= 0 ? logs[i].id : uid(),
    data: hoje(), dietaId: dietaAtiva().id, refeicaoId: refAtual.id, refeicaoNome: refAtual.nome,
    hora: horaLocal(), horaPlanejada: refAtual.hora,
    escolhas: [], completa: false, faltou: gruposAtivos().map(nomeCheio), status: 'pulada',
  };
  if (i >= 0) logs[i] = reg; else logs.push(reg);
  DB.set('logRefeicoes', logs);
  fecharSheet();
  RENDER.hoje();
}

function desmarcarRefeicao() {
  const logs = (DB.get('logRefeicoes') || [])
    .filter(l => !(l.data === hoje() && l.refeicaoId === refAtual.id));
  DB.set('logRefeicoes', logs);
  fecharSheet();
  RENDER.hoje();
}

// ══ REFEIÇÃO EXTRA — algo fora do plano, a qualquer hora ═══════
// Mais livre que a refeição normal: sem mínimo, sem grupo obrigatório. Ela
// escolhe as categorias que quiser (ou nenhuma) e pode só escrever o que
// comeu. Nasce já registrada, com a hora que ela marcar.
let selExtra = {};              // { categoriaId: [{opcaoId, nome, medida}] }
let obsExtra = '';
let horaExtra = null;
let extraEditandoId = null;     // id do log, quando reabre um já registrado
let categoriasExtraAbertas = new Set();

function abrirRefeicaoExtra(logId) {
  extraEditandoId = logId || null;
  selExtra = {};
  obsExtra = '';
  categoriasExtraAbertas = new Set();
  GRUPOS_EXTRA.forEach(c => { selExtra[c.id] = []; });

  const log = logId ? (DB.get('logRefeicoes') || []).find(l => l.id === logId) : null;
  horaExtra = log ? log.hora : horaLocal();
  if (log) {
    (log.escolhas || []).forEach(e => {
      if (e.grupoId === 'obs') { obsExtra = (e.itens[0] || {}).nome || ''; return; }
      if (selExtra[e.grupoId]) selExtra[e.grupoId] = (e.itens || []).map(it => ({ ...it }));
    });
    categoriasExtraAbertas = new Set(Object.keys(selExtra).filter(k => selExtra[k].length));
  }

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div>
        <h2>Refeição extra</h2>
        <div class="dica">Algo fora do plano? Registre o que lembrar.</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo" id="extra-corpo"></div>
    <div class="sheet-pe" id="extra-pe"></div>
  `, () => RENDER.hoje());

  renderExtra();
}

function renderExtra() {
  const cx = document.getElementById('extra-corpo');
  if (!cx) return;

  cx.innerHTML = `
    ${GRUPOS_EXTRA.map(c => {
      const escolhidos = selExtra[c.id] || [];
      const aberta = escolhidos.length > 0 || categoriasExtraAbertas.has(c.id);
      return `
      <div class="grupo">
        <button class="grupo-topo" style="width:100%;text-align:left" onclick="alternarCategoriaExtra('${c.id}')">
          <span class="grupo-nome">${esc(c.nome)}</span>
          <span class="grupo-cont num">${escolhidos.length ? escolhidos.length + ' escolhido' + (escolhidos.length > 1 ? 's' : '') : 'toque para abrir'}</span>
        </button>
        ${aberta ? `<div class="chips">${c.opcoes.map(o => {
          const on = escolhidos.some(it => it.opcaoId === o.id);
          return `<button class="chip ${on ? 'on' : ''}" onclick="escolherExtra('${c.id}','${esc(o.id)}')">
            ${esc(o.nome)}${o.medida && o.medida.valor != null ? `<i class="chip-med">${esc(medidaTexto(o.medida))}</i>` : ''}
          </button>`;
        }).join('')}</div>` : ''}
      </div>`;
    }).join('')}

    <div class="campo" style="margin-top:4px">
      <label for="extra-obs">Outra coisa (opcional)</label>
      <textarea id="extra-obs" rows="2" placeholder="Ex.: um pedaço de bolo, uma bolacha..."
        oninput="obsExtra=this.value">${esc(obsExtra)}</textarea>
    </div>

    <div class="hora-registro">
      <span class="hora-registro-lbl">Registrado às</span>
      ${horaToqueHTML(horaExtra, 'definirHoraExtra(this.value)')}
    </div>`;

  renderPeExtra();
}

function alternarCategoriaExtra(catId) {
  if (categoriasExtraAbertas.has(catId)) categoriasExtraAbertas.delete(catId);
  else categoriasExtraAbertas.add(catId);
  renderExtra();
}

function escolherExtra(catId, opcaoId) {
  const c = GRUPOS_EXTRA.find(x => x.id === catId);
  const o = c.opcoes.find(x => x.id === opcaoId);
  const atual = selExtra[catId] || [];
  const i = atual.findIndex(it => it.opcaoId === opcaoId);
  if (i >= 0) atual.splice(i, 1);
  else atual.push({ opcaoId, nome: o.nome, medida: o.medida ? { ...o.medida } : null });
  selExtra[catId] = atual;
  renderExtra();
}

function definirHoraExtra(v) {
  if (!v) return;
  horaExtra = v;
  renderExtra();
}

function renderPeExtra() {
  const pe = document.getElementById('extra-pe');
  if (!pe) return;
  const total = Object.values(selExtra).reduce((s, a) => s + a.length, 0) + (obsExtra.trim() ? 1 : 0);
  pe.innerHTML = `
    <button class="btn btn-cheio" style="width:100%" onclick="confirmarExtra()" ${total ? '' : 'disabled'}>
      ${extraEditandoId ? 'Salvar alteração' : 'Registrar refeição extra'}
    </button>
    ${extraEditandoId ? `<button class="link-fraco" onclick="removerExtra()">Remover este registro</button>` : ''}`;
}

function confirmarExtra() {
  const escolhas = GRUPOS_EXTRA
    .map(c => ({ grupoId: c.id, grupoNome: c.nome, itens: selExtra[c.id] || [] }))
    .filter(e => e.itens.length);
  if (obsExtra.trim()) escolhas.push({ grupoId: 'obs', grupoNome: 'Observação', itens: [{ opcaoId: 'obs', nome: obsExtra.trim(), medida: null }] });
  if (!escolhas.length) return;

  const logs = DB.get('logRefeicoes') || [];
  const i = extraEditandoId ? logs.findIndex(l => l.id === extraEditandoId) : -1;
  const reg = {
    id: extraEditandoId || uid(),
    data: hoje(),
    dietaId: dietaAtiva() ? dietaAtiva().id : null,
    refeicaoId: null,
    refeicaoNome: 'Refeição extra',
    hora: horaExtra,
    // Editar não remexe a posição: ela já está no lugar certo da sequência.
    ordem: i >= 0 ? logs[i].ordem : ordemParaExtra(hoje()),
    horaPlanejada: null,
    escolhas,
    completa: true,
    faltou: [],
    status: 'feita',
    extra: true,
  };
  if (i >= 0) logs[i] = reg; else logs.push(reg);
  DB.set('logRefeicoes', logs);

  fecharSheet();
  toast('Refeição extra registrada');
  checarConquistas();
  RENDER.hoje();
}

function removerExtra() {
  if (!extraEditandoId) return;
  DB.set('logRefeicoes', (DB.get('logRefeicoes') || []).filter(l => l.id !== extraEditandoId));
  fecharSheet();
  RENDER.hoje();
}

// ══ MEDICAMENTOS ═══════════════════════════════════════════════
// O "Tomei" do card grande continua sendo UM toque, que é o caso comum: ela
// toma e marca na hora. Quem precisa de outro horário abre o item e ajusta —
// tomou às 8h e só lembrou de marcar à noite.

let medAtualId = null;
let medHora = null;

function tomarMedicamento(medId, hora) {
  const logs = DB.get('logMedicamentos') || [];
  if (logs.some(l => l.data === hoje() && l.medId === medId)) return;
  logs.push({ id: uid(), data: hoje(), medId, hora: hora || horaLocal() });
  DB.set('logMedicamentos', logs);
  const m = (DB.get('medicamentos') || []).find(x => x.id === medId);
  toast(`${m ? m.nome : 'Medicamento'} marcado`);
  checarConquistas();
  RENDER.hoje();
}

function abrirMedicamento(medId) {
  const m = (DB.get('medicamentos') || []).find(x => x.id === medId);
  if (!m) return;
  const log = (DB.get('logMedicamentos') || []).find(l => l.data === hoje() && l.medId === medId);

  medAtualId = medId;
  medHora = log ? log.hora : horaLocal();

  abrirSheet('<div class="sheet-alca"></div><div id="med-cx"></div>', () => RENDER.hoje());
  renderMedicamento();
}

function renderMedicamento() {
  const cx = document.getElementById('med-cx');
  if (!cx) return;
  const m = (DB.get('medicamentos') || []).find(x => x.id === medAtualId);
  if (!m) return;
  const log = (DB.get('logMedicamentos') || []).find(l => l.data === hoje() && l.medId === medAtualId);

  cx.innerHTML = `
    <div class="sheet-cabeca">
      <div style="flex:1;min-width:0">
        <h2>${esc(m.nome)}</h2>
        <div class="dica">${esc(m.dose || '')}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>

    <div class="sheet-corpo">
      ${m.obs ? `<p style="font-size:14px;color:var(--tinta-dim);line-height:1.6;margin-bottom:14px">${esc(m.obs)}</p>` : ''}
      <div class="hora-registro" style="justify-content:flex-start">
        <span class="hora-registro-lbl">${log ? 'Tomei às' : 'Tomar às'}</span>
        ${horaToqueHTML(medHora, 'definirHoraMedicamento(this.value)')}
      </div>
      ${log ? '' : `<p class="sono-obs" style="text-align:left;padding:0">
        Já vem com a hora de agora — se você tomou antes, toque para corrigir.</p>`}
    </div>

    <div class="sheet-pe">
      ${log
        ? `<button class="btn btn-vazio" style="width:100%" onclick="desmarcarMedicamento('${esc(medAtualId)}')">Desmarcar</button>`
        : `<button class="btn btn-cheio btn-lavanda" style="width:100%" onclick="confirmarMedicamento()">Tomei</button>`}
    </div>`;
}

/** Já registrado, mudar a hora salva na hora — não tem botão de confirmar
 *  nessa tela, e deixar a mudança pendurada esperando um "salvar" que não
 *  existe seria a forma mais fácil de perder o ajuste. */
function definirHoraMedicamento(v) {
  if (!v) return;
  medHora = v;

  const logs = DB.get('logMedicamentos') || [];
  const l = logs.find(x => x.data === hoje() && x.medId === medAtualId);
  if (l) {
    l.hora = v;
    DB.set('logMedicamentos', logs);
    toast(`Horário atualizado para ${v}`);
  }
  renderMedicamento();
}

function confirmarMedicamento() {
  tomarMedicamento(medAtualId, medHora);
  fecharSheet();
}

function desmarcarMedicamento(medId) {
  DB.set('logMedicamentos', (DB.get('logMedicamentos') || [])
    .filter(l => !(l.data === hoje() && l.medId === medId)));
  fecharSheet();
  RENDER.hoje();
}

// ══ EXERCÍCIO ══════════════════════════════════════════════════

// Um dia pode ter mais de uma atividade: ela vai na academia de manhã e corre
// à tarde, e as duas contam. Por isso o sheet lista o que já foi registrado e
// tem sempre um formulário aberto embaixo pra somar mais uma.
let exercicioSel = null;
let exercicioMin = 30;                          // duração em minutos
let exercicioKm = 0;                            // 0 = não informado

const DURACOES = [15, 20, 30, 45, 60, 90];
const DISTANCIAS = [1, 2, 3, 5, 10];

const treinosDoDia = data => (DB.get('logExercicios') || []).filter(l => l.data === data);

function abrirExercicio() {
  exercicioSel = null;
  exercicioMin = 30;
  exercicioKm = 0;

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div>
        <h2>Exercício de hoje</h2>
        <div class="dica">Pode registrar mais de uma atividade no mesmo dia.</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo" id="ex-corpo"></div>
    <div class="sheet-pe" id="ex-pe"></div>
  `, () => RENDER.hoje());
  renderExercicio();
}

function renderExercicio() {
  const cx = document.getElementById('ex-corpo');
  if (!cx) return;
  const tipos = DB.get('exercicios') || SEED.exercicios;
  const feitos = treinosDoDia(hoje());
  const pedeKm = temDistancia(exercicioSel);

  cx.innerHTML = `
    ${feitos.length ? `
      <div class="grupo">
        <div class="grupo-topo">
          <span class="grupo-nome">Já registrado hoje</span>
          <span class="grupo-cont num">${esc(fmt.duracao(feitos.reduce((s, l) => s + (l.duracao || 0), 0)))}</span>
        </div>
        ${feitos.map(l => `
          <div class="atividade">
            <span class="no-cat" style="color:var(--lavanda-forte)">${IC.treino}</span>
            <span class="atividade-txt">
              <span class="atividade-nome">${esc(l.tipo)}</span>
              <span class="atividade-sub">${esc([fmt.duracao(l.duracao), fmt.km(l.distancia), l.hora].filter(Boolean).join(' · '))}</span>
            </span>
            <button class="atividade-x" onclick="removerAtividade('${esc(l.id)}')" aria-label="Remover">✕</button>
          </div>`).join('')}
      </div>` : ''}

    <div class="grupo">
      <div class="grupo-topo"><span class="grupo-nome">${feitos.length ? 'Somar outra atividade' : 'Tipo de treino'}</span></div>
      <div class="chips">
        ${tipos.map(t => `<button class="chip ${exercicioSel === t ? 'on' : ''}"
            onclick="selecionarExercicio('${esc(t)}')">${esc(t)}</button>`).join('')}
      </div>
    </div>

    <div class="grupo">
      <div class="grupo-topo">
        <span class="grupo-nome">Duração</span>
        <span class="grupo-cont num">${esc(fmt.duracao(exercicioMin))}</span>
      </div>
      <div class="chips" style="margin-bottom:10px">
        ${DURACOES.map(m => `<button class="chip ${exercicioMin === m ? 'on' : ''}"
            onclick="definirDuracao(${m})">${m} min</button>`).join('')}
      </div>
      <div class="stepper" style="width:fit-content">
        <button onclick="definirDuracao(${Math.max(5, exercicioMin - 5)})" aria-label="Diminuir">−</button>
        <span class="stepper-v num">${esc(fmt.duracao(exercicioMin))}</span>
        <button onclick="definirDuracao(${exercicioMin + 5})" aria-label="Aumentar">+</button>
      </div>
    </div>

    ${pedeKm ? `
      <div class="grupo">
        <div class="grupo-topo">
          <span class="grupo-nome">Distância</span>
          <span class="grupo-cont num">${exercicioKm ? esc(fmt.km(exercicioKm)) : 'não informada'}</span>
        </div>
        <div class="chips" style="margin-bottom:10px">
          ${DISTANCIAS.map(k => `<button class="chip ${exercicioKm === k ? 'on' : ''}"
              onclick="definirDistancia(${k})">${k} km</button>`).join('')}
        </div>
        <div class="stepper" style="width:fit-content">
          <button onclick="definirDistancia(${Math.max(0, Math.round((exercicioKm - 0.5) * 10) / 10)})" aria-label="Diminuir">−</button>
          <span class="stepper-v num">${exercicioKm ? esc(fmt.km(exercicioKm)) : '—'}</span>
          <button onclick="definirDistancia(${Math.round((exercicioKm + 0.5) * 10) / 10})" aria-label="Aumentar">+</button>
        </div>
        <p class="grupo-obs" style="margin-top:8px">Pode deixar em branco se não marcou.</p>
      </div>` : ''}`;

  renderPeExercicio();
}

function selecionarExercicio(t) {
  exercicioSel = exercicioSel === t ? null : t;
  if (!temDistancia(exercicioSel)) exercicioKm = 0;
  renderExercicio();
}

function definirDuracao(m) {
  exercicioMin = Math.max(5, Math.min(300, m));
  renderExercicio();
}

function definirDistancia(k) {
  exercicioKm = Math.max(0, Math.min(200, Math.round(k * 10) / 10));
  renderExercicio();
}

function renderPeExercicio() {
  const pe = document.getElementById('ex-pe');
  if (!pe) return;
  pe.innerHTML = `
    <button class="btn btn-cheio btn-lavanda" style="width:100%${exercicioSel ? '' : ';opacity:.4'}"
      onclick="confirmarExercicio()" ${exercicioSel ? '' : 'disabled'}>
      ${exercicioSel
        ? `Registrar ${esc(fmt.duracao(exercicioMin))} de ${esc(exercicioSel.toLowerCase())}${exercicioKm ? ' · ' + esc(fmt.km(exercicioKm)) : ''}`
        : 'Escolha o tipo de treino'}
    </button>`;
}

function confirmarExercicio() {
  if (!exercicioSel) return;
  DB.push('logExercicios', {
    id: uid(), data: hoje(), tipo: exercicioSel, duracao: exercicioMin,
    distancia: exercicioKm || null, hora: horaLocal(), obs: '',
  });
  toast(`${exercicioSel} · ${fmt.duracao(exercicioMin)} 💜`);
  checarConquistas();

  // Fica aberto: se ela fez duas coisas, a segunda já entra em seguida.
  exercicioSel = null;
  exercicioKm = 0;
  renderExercicio();
}

function removerAtividade(id) {
  DB.set('logExercicios', (DB.get('logExercicios') || []).filter(l => l.id !== id));
  renderExercicio();
}
