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
    oque = i.ref.grupos.map(g => `${g.qtd} ${g.nome.toLowerCase()}`).join(' · ');
    acoes = `<button class="btn btn-cheio" onclick="abrirRefeicao('${esc(i.id)}')">Montar ${primeiraPalavra(i.nome)}</button>`;
  } else if (i.tipo === 'remedio') {
    oque = [i.ref.dose, i.ref.obs].filter(Boolean).join(' · ');
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="tomarMedicamento('${esc(i.id)}')">Tomei</button>`;
  } else if (i.tipo === 'treino') {
    oque = 'Escolha o que você fez hoje.';
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="abrirExercicio()">Registrar treino</button>`;
  } else {
    oque = [i.ref.clinica, i.ref.obs].filter(Boolean).join(' · ') || 'Manta térmica e pesagem.';
    acoes = `<button class="btn btn-cheio btn-lavanda" onclick="ir('agenda')">Abrir a sessão</button>`;
  }

  return `
    <div class="no agora">
      <div class="card-agora ${atrasado ? 'tarde' : ''}">
        <div class="quando">
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
  return ir('agenda');
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

  cx.innerHTML = `
    <div class="agua">
      <div class="agua-topo">
        <span class="rotulo">Água</span>
        <span class="agua-val num">${esc(fmt.litros(total))} <small>de ${esc(fmt.litros(meta))}</small></span>
      </div>
      <div class="copos">${copos}</div>
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
  const { nota } = notaDoDia(hoje());
  el.innerHTML = `${nota}<sup>%</sup>`;
  el.style.color = nota >= 100 ? 'var(--ouro-forte)' : '';
}

// ══ SHEET DA REFEIÇÃO — o fluxo mais importante do app ═════════

let sel = {};          // { grupoId: [opcaoId, ...] }
let refAtual = null;

function abrirRefeicao(refeicaoId) {
  const dieta = dietaAtiva();
  if (!dieta) return toast('Cadastre um plano alimentar em Ajustes.');
  const r = dieta.refeicoes.find(x => x.id === refeicaoId);
  if (!r) return;

  refAtual = r;
  const log = (DB.get('logRefeicoes') || []).find(l => l.data === hoje() && l.refeicaoId === r.id);

  sel = {};
  r.grupos.forEach(g => { sel[g.id] = []; });
  if (log && log.status === 'feita') {
    (log.escolhas || []).forEach(e => {
      if (sel[e.grupoId]) sel[e.grupoId] = e.opcaoIds.filter(oid =>
        (r.grupos.find(g => g.id === e.grupoId)?.opcoes || []).some(o => o.id === oid));
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

function renderGrupos() {
  const r = refAtual;
  const cx = document.getElementById('sheet-grupos');
  if (!cx) return;

  cx.innerHTML = r.grupos.map(g => {
    const escolhidos = sel[g.id] || [];
    const cheio = escolhidos.length >= g.qtd;
    return `
      <div class="grupo ${cheio ? 'completo' : ''}">
        <div class="grupo-topo">
          <span class="rotulo">${esc(g.nome)}</span>
          <span class="grupo-cont num">${escolhidos.length} de ${g.qtd}${cheio ? ' ✓' : ''}</span>
        </div>
        <div class="chips">
          ${g.opcoes.map(o => {
            const on = escolhidos.includes(o.id);
            const travado = !on && cheio;
            return `<button class="chip ${on ? 'on' : ''} ${travado ? 'travado' : ''}"
                      onclick="escolher('${esc(g.id)}','${esc(o.id)}')"
                      aria-pressed="${on}">${esc(o.nome)}</button>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  renderPeRefeicao();
}

function escolher(grupoId, opcaoId) {
  const g = refAtual.grupos.find(x => x.id === grupoId);
  const atual = sel[grupoId] || [];
  const i = atual.indexOf(opcaoId);

  if (i >= 0) {
    atual.splice(i, 1);
  } else if (g.selecao === 'unica' && g.qtd === 1) {
    sel[grupoId] = [opcaoId];              // troca direta — sem precisar desmarcar antes
    return renderGrupos();
  } else if (atual.length < g.qtd) {
    atual.push(opcaoId);
  } else {
    return;                                 // grupo cheio: ignora o toque
  }
  sel[grupoId] = atual;
  renderGrupos();
}

function renderPeRefeicao() {
  const pe = document.getElementById('sheet-pe');
  if (!pe) return;

  const total = Object.values(sel).reduce((s, a) => s + a.length, 0);
  const faltam = refAtual.grupos.filter(g => (sel[g.id] || []).length < g.qtd).length;
  const jaFeita = (DB.get('logRefeicoes') || [])
    .some(l => l.data === hoje() && l.refeicaoId === refAtual.id && l.status === 'feita');
  const anterior = ultimaEscolha(refAtual.id);

  pe.innerHTML = `
    ${anterior && !total ? `<button class="btn btn-vazio btn-sm" style="width:100%;margin-bottom:9px"
        onclick="repetirUltima()">↺ Repetir o que comi da última vez</button>` : ''}
    <button class="btn btn-cheio" onclick="confirmarRefeicao()" ${total ? '' : 'disabled style="opacity:.4"'}>
      ${jaFeita ? 'Salvar alteração' : 'Confirmar ' + esc(primeiraPalavra(refAtual.nome))}
    </button>
    ${total && faltam ? `<div style="text-align:center;font-size:12px;color:var(--tinta-fraca);margin-top:9px">
        ${faltam === 1 ? 'falta 1 grupo' : `faltam ${faltam} grupos`} — pode confirmar assim mesmo</div>` : ''}
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
    sel[g.id] = e ? e.opcaoIds.filter(oid => g.opcoes.some(o => o.id === oid)).slice(0, g.qtd) : [];
  });
  renderGrupos();
}

function confirmarRefeicao() {
  const escolhas = refAtual.grupos
    .map(g => ({ grupoId: g.id, opcaoIds: sel[g.id] || [] }))
    .filter(e => e.opcaoIds.length);
  if (!escolhas.length) return;

  const logs = DB.get('logRefeicoes') || [];
  const i = logs.findIndex(l => l.data === hoje() && l.refeicaoId === refAtual.id);
  const reg = {
    id: i >= 0 ? logs[i].id : uid(),
    data: hoje(),
    dietaId: dietaAtiva().id,
    refeicaoId: refAtual.id,
    hora: horaLocal(),
    escolhas,
    status: 'feita',
  };
  if (i >= 0) logs[i] = reg; else logs.push(reg);
  DB.set('logRefeicoes', logs);

  fecharSheet();
  toast(`${refAtual.nome} registrado`);
  checarConquistas();
  RENDER.hoje();
}

function pularRefeicao() {
  const logs = DB.get('logRefeicoes') || [];
  const i = logs.findIndex(l => l.data === hoje() && l.refeicaoId === refAtual.id);
  const reg = {
    id: i >= 0 ? logs[i].id : uid(),
    data: hoje(), dietaId: dietaAtiva().id, refeicaoId: refAtual.id,
    hora: horaLocal(), escolhas: [], status: 'pulada',
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
