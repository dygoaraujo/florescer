/* ══ FLORESCER — Agenda ══════════════════════════════════════════
   Calendário mensal, as sessões na clínica (peso de entrada e saída)
   e a pesagem em casa. Todo peso salvo alimenta o gráfico do Progresso.
   ════════════════════════════════════════════════════════════════ */

let mesAgenda = null;   // 'YYYY-MM'

RENDER.agenda = function () {
  if (!mesAgenda) mesAgenda = hoje().slice(0, 7);

  const sessoes = (DB.get('sessoes') || []).sort((a, b) => a.data.localeCompare(b.data));
  const futuras = sessoes.filter(s => s.data >= hoje() && !s.feita);
  const passadas = sessoes.filter(s => s.data < hoje() || s.feita).reverse();
  const feitas = sessoes.filter(s => s.feita).length;

  document.getElementById('tela-agenda').innerHTML = `
    <header class="cabeca">
      <div class="cabeca-txt">
        <h1>Agenda</h1>
        <div class="data">${sessoes.length ? `${feitas} de ${sessoes.length} sessões feitas` : 'nenhuma sessão marcada'}</div>
      </div>
    </header>

    ${pesoResumoHTML()}

    <div class="cartao" style="margin-top:14px">
      <div class="cal-topo">
        <button class="cal-nav" onclick="mudarMes(-1)" aria-label="Mês anterior">‹</button>
        <span class="mes">${esc(nomeMes(mesAgenda))}</span>
        <button class="cal-nav" onclick="mudarMes(1)" aria-label="Próximo mês">›</button>
      </div>
      ${calendarioHTML(mesAgenda, sessoes)}
    </div>

    <div class="sec"><h2>Próximas sessões</h2></div>
    <div class="cartao">
      ${futuras.length ? futuras.map(sessaoItemHTML).join('')
        : `<div class="vazio"><span class="flor">📅</span>Nenhuma sessão marcada.</div>`}
      <button class="btn btn-vazio btn-sm" style="margin-top:14px" onclick="editarSessao()">${IC.mais} Sessão</button>
    </div>

    ${passadas.length ? `
      <div class="sec"><h2>Já aconteceram</h2></div>
      <div class="cartao">${passadas.map(sessaoItemHTML).join('')}</div>` : ''}

    <div class="sec"><h2>Pesagens em casa</h2></div>
    <div class="cartao">
      ${pesagensCasaHTML()}
      <button class="btn btn-vazio btn-sm" style="margin-top:14px" onclick="registrarPeso()">${IC.mais} Pesagem</button>
    </div>
  `;
};

// ── Resumo de peso ───────────────────────────────────────────────
function pesosOrdenados() {
  return (DB.get('pesos') || []).slice().sort((a, b) =>
    a.data === b.data ? (a.origem === 'sessao-saida' ? 1 : -1) : a.data.localeCompare(b.data));
}

function pesoAtual() {
  const ps = pesosOrdenados();
  return ps.length ? ps[ps.length - 1].peso : (perfil().pesoInicial ?? null);
}

function pesoResumoHTML() {
  const p = perfil();
  const inicial = p.pesoInicial ?? (pesosOrdenados()[0]?.peso ?? null);
  const atual = pesoAtual();
  if (inicial == null && atual == null) {
    return `<div class="cartao"><div class="vazio" style="padding:18px">
      <span class="flor">⚖️</span>Informe o peso inicial em Ajustes para acompanhar a evolução.</div></div>`;
  }
  const dif = (inicial != null && atual != null) ? atual - inicial : null;

  return `
    <div class="kpis">
      <div class="kpi">
        <div class="v num">${esc(fmt.peso(atual))}</div>
        <div class="k">peso agora</div>
      </div>
      <div class="kpi">
        <div class="v num" style="color:${dif == null ? 'inherit' : dif <= 0 ? 'var(--folha)' : 'var(--ambar)'}">
          ${dif == null ? '—' : (dif <= 0 ? '−' : '+') + fmt.peso(Math.abs(dif))}</div>
        <div class="k">desde o início${p.pesoMeta != null && atual != null ? ` · faltam ${fmt.peso(Math.max(0, atual - p.pesoMeta))}` : ''}</div>
      </div>
    </div>`;
}

// ── Calendário ───────────────────────────────────────────────────
function nomeMes(m) {
  return new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

function mudarMes(delta) {
  const d = new Date(Number(mesAgenda.slice(0, 4)), Number(mesAgenda.slice(5, 7)) - 1 + delta, 1);
  mesAgenda = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  RENDER.agenda();
}

function calendarioHTML(mes, sessoes) {
  const ano = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) - 1;
  const primeiro = new Date(ano, m, 1);
  const desloca = (primeiro.getDay() + 6) % 7;         // grade começa na segunda
  const diasNoMes = new Date(ano, m + 1, 0).getDate();
  const hj = hoje();

  const celulas = [];
  for (let k = 0; k < desloca; k++) celulas.push('<div></div>');
  for (let d = 1; d <= diasNoMes; d++) {
    const data = `${mes}-${String(d).padStart(2, '0')}`;
    const s = sessoes.find(x => x.data === data);
    const cls = ['cal-d', data === hj ? 'hoje' : '', s ? 'sessao' : '', s && s.feita ? 'feita' : ''].filter(Boolean).join(' ');
    celulas.push(s
      ? `<button class="${cls}" onclick="editarSessao('${esc(s.id)}')"><span>${d}</span><span class="ponto"></span></button>`
      : `<div class="${cls}"><span>${d}</span></div>`);
  }

  return `
    <div class="cal-grade">
      ${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map(l => `<div class="cal-dow">${l}</div>`).join('')}
      ${celulas.join('')}
    </div>`;
}

// ── Sessões ──────────────────────────────────────────────────────
function sessaoItemHTML(s) {
  const dif = (s.pesoEntrada != null && s.pesoSaida != null) ? s.pesoSaida - s.pesoEntrada : null;
  const detalhe = s.feita
    ? (dif != null ? `${fmt.peso(s.pesoEntrada)} → ${fmt.peso(s.pesoSaida)}` : 'concluída')
    : [s.hora, s.clinica].filter(Boolean).join(' · ');

  return `
    <button class="lista-item" onclick="editarSessao('${esc(s.id)}')">
      <span class="li-txt">
        <span class="li-nome">${esc(fmt.longa(s.data))}</span>
        <span class="li-sub">${esc(detalhe) || '—'}</span>
      </span>
      ${dif != null ? `<span class="pill ${dif <= 0 ? 'pill-folha' : 'pill-ambar'}">${dif <= 0 ? '−' : '+'}${fmt.peso(Math.abs(dif))}</span>` : ''}
      ${s.feita ? '' : '<span class="pill pill-lavanda">marcada</span>'}
      <span style="color:var(--tinta-fraca)">${IC.seta}</span>
    </button>`;
}

let edSessaoId = null;

function editarSessao(id) {
  const sessoes = DB.get('sessoes') || [];
  const s = id ? sessoes.find(x => x.id === id) : null;
  edSessaoId = id || null;

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div><h2>${s ? 'Sessão' : 'Nova sessão'}</h2>
        <div class="dica">${s ? 'Registre os pesos quando sair da clínica.' : 'Marque a data que a clínica passou.'}</div></div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <form id="ses-form">
      <div class="sheet-corpo">
        <div class="campo-dupla">
          <div class="campo">
            <label for="se-data">Data</label>
            <input id="se-data" type="date" required value="${esc(s?.data || hoje())}">
          </div>
          <div class="campo">
            <label for="se-hora">Hora</label>
            <input id="se-hora" type="time" value="${esc(s?.hora || '09:00')}">
          </div>
        </div>
        <div class="campo">
          <label for="se-clinica">Clínica</label>
          <input id="se-clinica" type="text" value="${esc(s?.clinica || '')}" placeholder="Nome da clínica">
        </div>
        <div class="campo-dupla">
          <div class="campo">
            <label for="se-pe">Peso na entrada</label>
            <input id="se-pe" type="number" inputmode="decimal" step="0.1" placeholder="kg" value="${s?.pesoEntrada ?? ''}">
          </div>
          <div class="campo">
            <label for="se-ps">Peso na saída</label>
            <input id="se-ps" type="number" inputmode="decimal" step="0.1" placeholder="kg" value="${s?.pesoSaida ?? ''}">
          </div>
        </div>
        <div class="campo">
          <label for="se-obs">Observações</label>
          <textarea id="se-obs" placeholder="Como foi, o que sentiu, o que a clínica orientou...">${esc(s?.obs || '')}</textarea>
        </div>
        <div class="campo" style="margin-bottom:0">
          <label>Situação</label>
          <div class="toggles">
            <button type="button" class="toggle ${s?.feita ? 'on' : ''}" id="se-feita" data-on="${!!s?.feita}"
              onclick="alternarFeita(this)">${s?.feita ? 'Sessão feita' : 'Ainda vou'}</button>
          </div>
        </div>
      </div>
      <div class="sheet-pe">
        <button class="btn btn-cheio" type="submit">Salvar</button>
        ${s ? `<button type="button" class="link-fraco" onclick="removerSessao('${esc(s.id)}')">Remover sessão</button>` : ''}
      </div>
    </form>`, () => RENDER.agenda());

  document.getElementById('ses-form').onsubmit = e => { e.preventDefault(); salvarSessao(); };
}

function alternarFeita(btn) {
  const on = btn.dataset.on !== 'true';
  btn.dataset.on = on;
  btn.classList.toggle('on', on);
  btn.textContent = on ? 'Sessão feita' : 'Ainda vou';
}

function salvarSessao() {
  const num = id => {
    const v = document.getElementById(id).value;
    return v === '' ? null : Number(v);
  };
  const reg = {
    id: edSessaoId || uid(),
    data: document.getElementById('se-data').value,
    hora: document.getElementById('se-hora').value,
    clinica: document.getElementById('se-clinica').value.trim(),
    pesoEntrada: num('se-pe'),
    pesoSaida: num('se-ps'),
    obs: document.getElementById('se-obs').value.trim(),
    feita: document.getElementById('se-feita').dataset.on === 'true',
  };
  if (!reg.data) return toast('Escolha a data');

  const sessoes = DB.get('sessoes') || [];
  const i = sessoes.findIndex(x => x.id === reg.id);
  if (i >= 0) sessoes[i] = reg; else sessoes.push(reg);
  DB.set('sessoes', sessoes);

  sincronizarPesosDaSessao(reg);
  fecharSheet();
  toast('Sessão salva');
  checarConquistas();
}

/** Os pesos da sessão viram registros no gráfico — sem digitar de novo. */
function sincronizarPesosDaSessao(s) {
  let pesos = (DB.get('pesos') || []).filter(p => p.sessaoId !== s.id);
  if (s.pesoEntrada != null) pesos.push({ id: uid(), data: s.data, peso: s.pesoEntrada, origem: 'sessao-entrada', sessaoId: s.id });
  if (s.pesoSaida  != null) pesos.push({ id: uid(), data: s.data, peso: s.pesoSaida,  origem: 'sessao-saida',  sessaoId: s.id });
  DB.set('pesos', pesos);
}

function removerSessao(id) {
  confirmar('Remover sessão', 'A sessão e os pesos registrados nela saem do histórico.', 'Remover', () => {
    DB.set('sessoes', (DB.get('sessoes') || []).filter(s => s.id !== id));
    DB.set('pesos', (DB.get('pesos') || []).filter(p => p.sessaoId !== id));
    fecharSheet();
  });
}

// ── Pesagem em casa ──────────────────────────────────────────────
function pesagensCasaHTML() {
  const ps = pesosOrdenados().filter(p => p.origem === 'casa').reverse().slice(0, 10);
  if (!ps.length) return `<div class="vazio" style="padding:22px"><span class="flor">⚖️</span>Nenhuma pesagem em casa ainda.</div>`;
  return ps.map(p => `
    <div class="lista-item">
      <span class="li-txt"><span class="li-nome">${esc(fmt.peso(p.peso))}</span></span>
      <span class="li-fim">${esc(fmt.data(p.data))}</span>
      <button class="btn btn-suave btn-sm" onclick="removerPeso('${esc(p.id)}')" aria-label="Remover">${IC.lixo}</button>
    </div>`).join('');
}

function registrarPeso() {
  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div><h2>Pesagem</h2><div class="dica">De manhã, em jejum, dá a leitura mais estável.</div></div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <form id="peso-form">
      <div class="sheet-corpo">
        <div class="campo-dupla">
          <div class="campo">
            <label for="pe-valor">Peso</label>
            <input id="pe-valor" type="number" inputmode="decimal" step="0.1" required placeholder="kg" autofocus>
          </div>
          <div class="campo">
            <label for="pe-data">Dia</label>
            <input id="pe-data" type="date" value="${hoje()}">
          </div>
        </div>
      </div>
      <div class="sheet-pe"><button class="btn btn-cheio" type="submit">Salvar peso</button></div>
    </form>`, () => RENDER.agenda());

  document.getElementById('peso-form').onsubmit = e => {
    e.preventDefault();
    const v = Number(document.getElementById('pe-valor').value);
    if (!v) return;
    DB.push('pesos', { id: uid(), data: document.getElementById('pe-data').value || hoje(), peso: v, origem: 'casa', sessaoId: null });
    fecharSheet();
    toast('Peso registrado');
    checarConquistas();
  };
}

function removerPeso(id) {
  DB.set('pesos', (DB.get('pesos') || []).filter(p => p.id !== id));
  RENDER.agenda();
}
