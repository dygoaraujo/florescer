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

  if (dieta) dieta.refeicoes.forEach(r => itens.push({
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

  // Estado de cada nó
  const logR = (DB.get('logRefeicoes') || []).filter(l => l.data === data);
  const logM = (DB.get('logMedicamentos') || []).filter(l => l.data === data);
  const logE = (DB.get('logExercicios') || []).filter(l => l.data === data);

  itens.forEach(i => {
    if (i.tipo === 'refeicao') {
      const l = logR.find(x => x.refeicaoId === i.id);
      i.estado = l ? (l.status === 'pulada' ? 'pulado' : 'feito') : 'pendente';
      i.log = l || null;
    } else if (i.tipo === 'remedio') {
      i.log = logM.find(x => x.medId === i.id) || null;
      i.estado = i.log ? 'feito' : 'pendente';
    } else if (i.tipo === 'treino') {
      i.log = logE[0] || null;
      i.estado = i.log ? 'feito' : 'pendente';
    } else {
      i.estado = i.ref.feita ? 'feito' : 'pendente';
    }
  });

  return itens.sort((a, b) => minutosDe(a.hora) - minutosDe(b.hora));
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
  if (i.tipo === 'refeicao') return IC.refeicao;
  if (i.tipo === 'treino')   return IC.treino;
  if (i.tipo === 'sessao')   return IC.sessao;
  return i.ref && i.ref.forma === 'gotas' ? IC.gota : IC.capsula;
}

function noHTML(i, ativo) {
  if (ativo) return cardAgoraHTML(i);

  const cls = ['no', i.estado === 'feito' ? 'feito' : i.estado === 'pulado' ? 'pulado' : ''].join(' ');
  const marca = i.estado === 'feito' ? IC.check
              : i.estado === 'pulado' ? '<span style="font-size:13px">—</span>'
              : '';
  return `
    <div class="${cls}">
      <button class="no-linha" onclick="abrirItem('${i.tipo}','${esc(i.id)}')">
        <span class="no-hora num">${esc(i.hora)}</span>
        <span class="no-cat">${iconeItem(i)}</span>
        <span class="no-nome">${esc(i.nome)}</span>
        <span class="no-ic">${marca}</span>
      </button>
    </div>`;
}

// ── O card grande: a próxima coisa a fazer ───────────────────────
function cardAgoraHTML(i) {
  const agora = minutosDe(horaLocal());
  const atrasado = minutosDe(i.hora) < agora - 20;

  let oque = '', acoes = '';

  if (i.tipo === 'refeicao') {
    const nomes = i.ref.grupos.map(g => (g.qtd > 1 ? g.qtd + ' ' : '') + g.nome.toLowerCase());
    oque = nomes.slice(0, 3).join(' · ') + (nomes.length > 3 ? ` +${nomes.length - 3}` : '');
    acoes = `<button class="btn btn-cheio" onclick="abrirRefeicao('${esc(i.id)}')">Montar ${primeiraPalavra(i.nome)}</button>`;
  } else if (i.tipo === 'remedio') {
    oque = [i.ref.dose, i.ref.obs].filter(Boolean).join(' · ');
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="tomarMedicamento('${esc(i.id)}')">Tomei</button>`;
  } else if (i.tipo === 'treino') {
    oque = 'Escolha o que você fez hoje.';
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="abrirExercicio()">Registrar treino</button>`;
  } else {
    const etapa = etapaSessao(i.ref);
    oque = etapa === 'chegada'
      ? [i.ref.clinica, 'Pese-se ao chegar, antes dos procedimentos.'].filter(Boolean).join(' · ')
      : `Chegou com ${fmt.peso(i.ref.pesoEntrada)}. Falta registrar o peso de saída.`;
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="abrirSessao('${esc(i.id)}')">
      ${etapa === 'chegada' ? 'Cheguei na clínica' : 'Continuar a sessão'}</button>`;
  }

  return `
    <div class="no agora">
      <div class="card-agora ${atrasado ? 'tarde' : ''}">
        <div class="quando">
          <span class="quando-ic">${iconeItem(i)}</span>
          <span>${atrasado ? 'Passou da hora' : 'Agora'}</span>
          <span class="h">· ${esc(i.hora)}</span>
        </div>
        <h3>${esc(i.nome)}</h3>
        ${oque ? `<p class="oque">${esc(oque)}</p>` : ''}
        <div class="acoes">${acoes}</div>
      </div>
    </div>`;
}

const primeiraPalavra = s => String(s).split(' ')[0].toLowerCase();

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
  if (tipo === 'refeicao') return abrirRefeicao(id);
  if (tipo === 'remedio')  return abrirMedicamento(id);
  if (tipo === 'treino')   return abrirExercicio();
  return abrirSessao(id);
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
        <div class="dica">${esc(r.grupos.map(g => `${g.qtd} ${g.nome.toLowerCase()}`).join(' · '))}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo" id="sheet-grupos"></div>
    <div class="sheet-pe" id="sheet-pe"></div>
  `);

  renderGrupos();
}

/** Aceita o formato novo (itens) e o antigo (opcaoIds), pro histórico não quebrar. */
function itensDoLog(escolha) {
  if (escolha.itens) return escolha.itens;
  return (escolha.opcaoIds || []).map(id => ({ opcaoId: id, nome: '', medida: null }));
}

function grupoCompleto(g) { return (sel[g.id] || []).length >= g.qtd; }

function renderGrupos() {
  const cx = document.getElementById('sheet-grupos');
  if (!cx) return;
  cx.innerHTML = refAtual.grupos.map(grupoHTML).join('');
}

function grupoHTML(g, gi) {
  const escolhidos = sel[g.id] || [];
  const cheio = grupoCompleto(g);
  const recolhido = cheio && !gruposAbertos.has(g.id);
  const busca = (buscaGrupo[g.id] || '').trim().toLowerCase();

  const visiveis = busca
    ? g.opcoes.filter(o => semAcento(o.nome).includes(semAcento(busca)))
    : g.opcoes;

  return `
    <div class="grupo ${cheio ? 'completo' : ''}">
      <div class="grupo-topo">
        <span class="rotulo">${esc(g.nome)}</span>
        <span class="grupo-cont num">${escolhidos.length} de ${g.qtd}${cheio ? ' ✓' : ''}</span>
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
          <div class="chips">
            ${visiveis.slice(0, busca ? 40 : 400).map(o => {
              const on = escolhidos.some(it => it.opcaoId === o.id);
              const travado = !on && cheio;
              return `<button class="chip ${on ? 'on' : ''} ${travado ? 'travado' : ''}"
                        onclick="escolher('${esc(g.id)}','${esc(o.id)}')" aria-pressed="${on}">
                        ${esc(o.nome)}${o.medida && o.medida.valor != null ? `<i class="chip-med">${esc(medidaTexto(o.medida))}</i>` : ''}
                      </button>`;
            }).join('')}
            ${visiveis.length === 0 ? '<span class="sem-achado">Nada com esse nome neste grupo.</span>' : ''}
          </div>`}
    </div>`;
}

const semAcento = s => String(s).toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
const nomeOpcao = (g, id) => (g.opcoes.find(o => o.id === id) || {}).nome || '';

function filtrarGrupo(grupoId, texto) {
  buscaGrupo[grupoId] = texto;
  const g = refAtual.grupos.find(x => x.id === grupoId);
  const gi = refAtual.grupos.indexOf(g);
  // Redesenha só este grupo, pra não perder o foco do campo de busca.
  const alvo = document.querySelectorAll('#sheet-grupos .grupo')[gi];
  if (!alvo) return renderGrupos();
  const molde = document.createElement('div');
  molde.innerHTML = grupoHTML(g, gi);
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
    renderGrupos();
    return renderPeRefeicao();
  } else if (atual.length < g.qtd) {
    atual.push(novo());
    if (atual.length >= g.qtd) gruposAbertos.delete(grupoId);
  } else {
    return;                                   // grupo cheio: ignora o toque
  }
  sel[grupoId] = atual;
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

function renderPeRefeicao() {
  const pe = document.getElementById('sheet-pe');
  if (!pe) return;

  const total = Object.values(sel).reduce((s, a) => s + a.length, 0);
  const faltando = refAtual.grupos.filter(g => !grupoCompleto(g));
  const jaFeita = (DB.get('logRefeicoes') || [])
    .some(l => l.data === hoje() && l.refeicaoId === refAtual.id && l.status === 'feita');
  const anterior = ultimaEscolha(refAtual.id);

  pe.innerHTML = `
    ${anterior && !total ? `<button class="btn btn-vazio btn-sm" style="width:100%;margin-bottom:9px"
        onclick="repetirUltima()">↺ Repetir o que comi da última vez</button>` : ''}
    <button class="btn btn-cheio" onclick="confirmarRefeicao()" ${total ? '' : 'disabled style="opacity:.4"'}>
      ${jaFeita ? 'Salvar alteração' : 'Confirmar ' + esc(primeiraPalavra(refAtual.nome))}
    </button>
    ${total && faltando.length ? `<div class="aviso-falta">
        Falta ${esc(fmt.lista(faltando.map(g => g.nome)))} — pode confirmar assim mesmo,
        que o relatório registra o que ficou de fora.</div>` : ''}
    ${jaFeita
      ? `<button class="link-fraco" onclick="desmarcarRefeicao()">Desmarcar esta refeição</button>`
      : `<button class="link-fraco" onclick="pularRefeicao()">Não fiz esta refeição</button>`}
  `;
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
  const escolhas = refAtual.grupos
    .map(g => ({ grupoId: g.id, grupoNome: g.nome, itens: sel[g.id] || [] }))
    .filter(e => e.itens.length);
  if (!escolhas.length) return;

  const faltou = refAtual.grupos.filter(g => !grupoCompleto(g)).map(g => g.nome);

  const logs = DB.get('logRefeicoes') || [];
  const i = logs.findIndex(l => l.data === hoje() && l.refeicaoId === refAtual.id);
  const reg = {
    id: i >= 0 ? logs[i].id : uid(),
    data: hoje(),
    dietaId: dietaAtiva().id,
    refeicaoId: refAtual.id,
    refeicaoNome: refAtual.nome,
    hora: horaLocal(),
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
    hora: horaLocal(), escolhas: [], completa: false, faltou: refAtual.grupos.map(g => g.nome), status: 'pulada',
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

// ══ MEDICAMENTOS ═══════════════════════════════════════════════

function tomarMedicamento(medId) {
  const logs = DB.get('logMedicamentos') || [];
  if (logs.some(l => l.data === hoje() && l.medId === medId)) return;
  logs.push({ id: uid(), data: hoje(), medId, hora: horaLocal() });
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

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div>
        <h2>${esc(m.nome)}</h2>
        <div class="dica">${esc([m.dose, m.hora].filter(Boolean).join(' · '))}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo">
      ${m.obs ? `<p style="font-size:14px;color:var(--tinta-dim);line-height:1.6;margin-bottom:6px">${esc(m.obs)}</p>` : ''}
      ${log ? `<div class="pill pill-folha" style="margin-bottom:6px">Tomado às ${esc(log.hora)}</div>` : ''}
    </div>
    <div class="sheet-pe">
      ${log
        ? `<button class="btn btn-vazio" style="width:100%" onclick="desmarcarMedicamento('${esc(medId)}')">Desmarcar</button>`
        : `<button class="btn btn-cheio btn-lavanda" style="width:100%" onclick="fecharSheet();tomarMedicamento('${esc(medId)}')">Tomei</button>`}
    </div>
  `);
}

function desmarcarMedicamento(medId) {
  DB.set('logMedicamentos', (DB.get('logMedicamentos') || [])
    .filter(l => !(l.data === hoje() && l.medId === medId)));
  fecharSheet();
  RENDER.hoje();
}

// ══ EXERCÍCIO ══════════════════════════════════════════════════

let exercicioSel = null;

function abrirExercicio() {
  const tipos = DB.get('exercicios') || SEED.exercicios;
  const log = (DB.get('logExercicios') || []).find(l => l.data === hoje());
  exercicioSel = log ? log.tipo : null;

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div>
        <h2>Exercício de hoje</h2>
        <div class="dica">O que você fez?</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo">
      <div class="chips" id="ex-chips">
        ${tipos.map(t => `<button class="chip ${exercicioSel === t ? 'on' : ''}"
            onclick="selecionarExercicio('${esc(t)}')">${esc(t)}</button>`).join('')}
      </div>
    </div>
    <div class="sheet-pe" id="ex-pe"></div>
  `);
  renderPeExercicio();
}

function selecionarExercicio(t) {
  exercicioSel = exercicioSel === t ? null : t;
  document.querySelectorAll('#ex-chips .chip').forEach(c => {
    c.classList.toggle('on', c.textContent.trim() === exercicioSel);
  });
  renderPeExercicio();
}

function renderPeExercicio() {
  const pe = document.getElementById('ex-pe');
  if (!pe) return;
  const jaFeito = (DB.get('logExercicios') || []).some(l => l.data === hoje());
  pe.innerHTML = `
    <button class="btn btn-cheio btn-lavanda" style="width:100%${exercicioSel ? '' : ';opacity:.4'}"
      onclick="confirmarExercicio()" ${exercicioSel ? '' : 'disabled'}>Concluir treino</button>
    ${jaFeito ? `<button class="link-fraco" onclick="desmarcarExercicio()">Desmarcar o treino de hoje</button>` : ''}
  `;
}

function confirmarExercicio() {
  if (!exercicioSel) return;
  const logs = (DB.get('logExercicios') || []).filter(l => l.data !== hoje());
  logs.push({ id: uid(), data: hoje(), tipo: exercicioSel, obs: '' });
  DB.set('logExercicios', logs);
  fecharSheet();
  toast(`${exercicioSel} registrado 💜`);
  checarConquistas();
  RENDER.hoje();
}

function desmarcarExercicio() {
  DB.set('logExercicios', (DB.get('logExercicios') || []).filter(l => l.data !== hoje()));
  fecharSheet();
  RENDER.hoje();
}
