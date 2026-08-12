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

    <div class="sec"><h2>Pesagens</h2><span class="sub">todas entram na curva</span></div>
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

/** Peso atual = a última pesagem registrada, de onde quer que ela venha.
 *  A curva mostra TODAS — casa, chegada e saída da clínica — e cada ponto
 *  diz de onde veio, para o degrau da manta térmica ficar visível em vez de
 *  escondido. */
function pesoAtual() {
  const ps = pesosOrdenados();
  return ps.length ? ps[ps.length - 1].peso : (perfil().pesoInicial ?? null);
}

const ORIGEM_PESO = {
  'casa':            { rotulo: 'em casa',              cor: '#D2648B' },
  'sessao-entrada':  { rotulo: 'chegada na clínica',   cor: '#8A6FC7' },
  'sessao-saida':    { rotulo: 'saída da clínica',     cor: '#4F8FB4' },
};

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
  const d = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1);
  return `${fmt.maiuscula(d.toLocaleDateString('pt-BR', { month: 'long' }))} de ${d.getFullYear()}`;
}

function mudarMes(delta) {
  const d = new Date(Number(mesAgenda.slice(0, 4)), Number(mesAgenda.slice(5, 7)) - 1 + delta, 1);
  mesAgenda = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  RENDER.agenda();
}

// Grade do mês no padrão brasileiro: domingo a sábado. TODO dia é tocável —
// tocar num dia vazio já abre o cadastro da sessão com a data preenchida, que
// é como se procura marcar uma consulta.
function calendarioHTML(mes, sessoes) {
  const ano = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) - 1;
  const desloca = new Date(ano, m, 1).getDay();        // 0 = domingo
  const diasNoMes = new Date(ano, m + 1, 0).getDate();
  const hj = hoje();

  const celulas = [];
  for (let k = 0; k < desloca; k++) celulas.push('<div></div>');
  for (let d = 1; d <= diasNoMes; d++) {
    const data = `${mes}-${String(d).padStart(2, '0')}`;
    const s = sessoes.find(x => x.data === data);
    const cls = ['cal-d', data === hj ? 'hoje' : '', s ? 'sessao' : '', s && s.feita ? 'feita' : ''].filter(Boolean).join(' ');
    celulas.push(s
      ? `<button class="${cls}" aria-label="Sessão de ${d}"
           onclick="abrirSessao('${esc(s.id)}')"><span>${d}</span><span class="ponto"></span></button>`
      : `<button class="${cls}" aria-label="Marcar sessão em ${d}"
           onclick="editarSessao(null,'${data}')"><span>${d}</span></button>`);
  }

  return `
    <div class="cal-grade">
      ${['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(l => `<div class="cal-dow">${l}</div>`).join('')}
      ${celulas.join('')}
    </div>
    <p class="cal-dica">Toque num dia para marcar a sessão.</p>`;
}

// ══ SESSÕES ════════════════════════════════════════════════════
// Dia de sessão: ela chega e se pesa, faz os procedimentos (Mounjaro, manta),
// e se pesa de novo antes de ir embora. São duas pesagens no mesmo dia — por
// isso o registro é em 3 etapas, cada uma salva na hora. Ela abre o app quando
// chega, e de novo quando termina.

/** Em que ponto da sessão ela está. */
function etapaSessao(s) {
  if (s.pesoEntrada == null) return 'chegada';
  if (s.pesoSaida == null)   return 'durante';
  return 'concluida';
}

function resumoSessao(s) {
  const etapa = etapaSessao(s);
  if (etapa === 'chegada')  return [s.hora, s.clinica].filter(Boolean).join(' · ') || 'ainda vai acontecer';
  if (etapa === 'durante')  return `Chegou com ${fmt.peso(s.pesoEntrada)} — falta o peso de saída`;
  const dif = s.pesoSaida - s.pesoEntrada;
  const proc = (s.procedimentos || []).length ? ` · ${(s.procedimentos || []).length} procedimentos` : '';
  return `${fmt.peso(s.pesoEntrada)} → ${fmt.peso(s.pesoSaida)}${proc}`;
}

function sessaoItemHTML(s) {
  const etapa = etapaSessao(s);
  const dif = etapa === 'concluida' ? s.pesoSaida - s.pesoEntrada : null;

  return `
    <button class="lista-item" onclick="abrirSessao('${esc(s.id)}')">
      <span class="li-txt">
        <span class="li-nome">${esc(fmt.maiuscula(fmt.longa(s.data)))}</span>
        <span class="li-sub">${esc(resumoSessao(s))}</span>
      </span>
      ${dif != null ? `<span class="pill ${dif <= 0 ? 'pill-folha' : 'pill-ambar'}">${dif <= 0 ? '−' : '+'}${fmt.peso(Math.abs(dif))}</span>` : ''}
      ${etapa === 'durante' ? '<span class="pill pill-ambar">em andamento</span>' : ''}
      ${etapa === 'chegada' ? '<span class="pill pill-lavanda">marcada</span>' : ''}
      <span style="color:var(--tinta-fraca)">${IC.seta}</span>
    </button>`;
}

let sessaoAberta = null;

function abrirSessao(id) {
  const s = (DB.get('sessoes') || []).find(x => x.id === id);
  if (!s) return;
  sessaoAberta = id;
  abrirSheet('<div class="sheet-alca"></div><div id="ses-corpo"></div>', () => RENDER.agenda());
  renderSessao();
}

const sessaoAtual = () => (DB.get('sessoes') || []).find(x => x.id === sessaoAberta);

function salvarSessaoAtual(mudar) {
  const sessoes = DB.get('sessoes') || [];
  const i = sessoes.findIndex(x => x.id === sessaoAberta);
  if (i < 0) return;
  mudar(sessoes[i]);
  sessoes[i].feita = etapaSessao(sessoes[i]) === 'concluida';
  DB.set('sessoes', sessoes);
  sincronizarPesosDaSessao(sessoes[i]);
}

/** Sugere o último peso conhecido — ela só ajusta uns décimos. */
function pesoSugerido() {
  const p = pesoAtual();
  return p != null ? p : (perfil().pesoInicial ?? 70);
}

function renderSessao() {
  const s = sessaoAtual();
  const cx = document.getElementById('ses-corpo');
  if (!s || !cx) return;
  const etapa = etapaSessao(s);
  const procs = DB.get('procedimentos') || [];
  const feitos = s.procedimentos || [];

  const passoPeso = (alvo, valor) => `
    <div class="peso-campo">
      <button class="peso-btn" onclick="ajustarPeso('${alvo}',-0.1)" aria-label="Diminuir">−</button>
      <input id="${alvo}" class="peso-input num" type="number" inputmode="decimal" step="0.1" value="${valor}">
      <span class="peso-un">kg</span>
      <button class="peso-btn" onclick="ajustarPeso('${alvo}',0.1)" aria-label="Aumentar">+</button>
    </div>`;

  cx.innerHTML = `
    <div class="sheet-cabeca">
      <div style="flex:1;min-width:0">
        <h2>Sessão na clínica</h2>
        <div class="dica">${esc(fmt.maiuscula(fmt.longa(s.data)))}${s.clinica ? ' · ' + esc(s.clinica) : ''}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>

    <div class="sheet-corpo">
      <div class="trilha">
        ${['Chegada', 'Procedimentos', 'Saída'].map((t, i) => {
          const passo = etapa === 'chegada' ? 0 : etapa === 'durante' ? 1 : 3;
          return `<div class="trilha-passo ${i < passo ? 'ok' : ''} ${i === passo ? 'agora' : ''}">
            <span class="trilha-bola">${i < passo ? '✓' : i + 1}</span><span>${t}</span></div>`;
        }).join('')}
      </div>

      ${etapa === 'chegada' ? `
        <div class="etapa-cx">
          <div class="rotulo" style="margin-bottom:8px">Peso ao chegar</div>
          <p class="etapa-dica">Antes de qualquer procedimento — é este peso que conta na sua evolução.</p>
          ${passoPeso('ses-entrada', pesoSugerido().toFixed(1))}
          <button class="btn btn-cheio" style="width:100%;margin-top:16px" onclick="registrarChegada()">Cheguei</button>
        </div>`
      : `
        <div class="linha-peso">
          <span>Chegou às ${esc(s.horaChegada || s.hora || '—')}</span>
          <strong class="num">${esc(fmt.peso(s.pesoEntrada))}</strong>
        </div>`}

      ${etapa !== 'chegada' ? `
        <div class="etapa-cx">
          <div class="rotulo" style="margin-bottom:9px">O que você fez hoje</div>
          <div class="chips">
            ${procs.map(p => `<button class="chip ${feitos.includes(p) ? 'on' : ''}"
                onclick="alternarProcedimento('${esc(p)}')">${esc(p)}</button>`).join('')}
          </div>
        </div>` : ''}

      ${etapa === 'durante' ? `
        <div class="etapa-cx">
          <div class="rotulo" style="margin-bottom:8px">Peso ao sair</div>
          <p class="etapa-dica">Depois da manta. A diferença é principalmente água — o app guarda separado.</p>
          ${passoPeso('ses-saida', (s.pesoEntrada).toFixed(1))}
          <button class="btn btn-cheio" style="width:100%;margin-top:16px" onclick="registrarSaida()">Terminei, vou embora</button>
        </div>` : ''}

      ${etapa === 'concluida' ? `
        <div class="linha-peso">
          <span>Saiu às ${esc(s.horaSaida || '—')}</span>
          <strong class="num">${esc(fmt.peso(s.pesoSaida))}</strong>
        </div>
        <div class="sessao-fecho">
          <div class="num">${s.pesoSaida <= s.pesoEntrada ? '−' : '+'}${esc(fmt.peso(Math.abs(s.pesoSaida - s.pesoEntrada)))}</div>
          <p>saiu da sessão</p>
        </div>` : ''}

      <div class="campo" style="margin-top:18px">
        <label for="ses-obs2">Observações</label>
        <textarea id="ses-obs2" placeholder="Como você se sentiu, o que a clínica orientou..."
          onchange="salvarSessaoAtual(x => x.obs = this.value)">${esc(s.obs || '')}</textarea>
      </div>

      <button class="link-fraco" onclick="editarSessao('${esc(s.id)}')">Editar data, hora e clínica</button>
    </div>`;
}

function ajustarPeso(alvo, delta) {
  const el = document.getElementById(alvo);
  if (!el) return;
  el.value = (Math.max(0, (Number(el.value) || 0) + delta)).toFixed(1);
}

function registrarChegada() {
  const v = Number(document.getElementById('ses-entrada').value);
  if (!v) return toast('Informe o peso de chegada');
  salvarSessaoAtual(s => { s.pesoEntrada = v; s.horaChegada = horaLocal(); });
  renderSessao();
  toast('Chegada registrada');
}

function alternarProcedimento(nome) {
  salvarSessaoAtual(s => {
    s.procedimentos = s.procedimentos || [];
    const i = s.procedimentos.indexOf(nome);
    if (i >= 0) s.procedimentos.splice(i, 1); else s.procedimentos.push(nome);
  });
  renderSessao();
}

function registrarSaida() {
  const v = Number(document.getElementById('ses-saida').value);
  if (!v) return toast('Informe o peso de saída');
  salvarSessaoAtual(s => { s.pesoSaida = v; s.horaSaida = horaLocal(); });
  renderSessao();
  toast('Sessão concluída ✨');
  chuvaDePetalas();
  checarConquistas();
}

let edSessaoId = null;

function editarSessao(id, dataSugerida) {
  const sessoes = DB.get('sessoes') || [];
  const s = id ? sessoes.find(x => x.id === id) : null;
  edSessaoId = id || null;
  const data = s ? s.data : (dataSugerida || hoje());

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div><h2>${s ? 'Sessão' : 'Marcar sessão'}</h2>
        <div class="dica">${s ? 'Registre os pesos quando sair da clínica.'
                              : esc(fmt.maiuscula(fmt.longa(data)))}</div></div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <form id="ses-form">
      <div class="sheet-corpo">
        <div class="campo-dupla">
          <div class="campo">
            <label for="se-data">Data</label>
            <input id="se-data" type="date" required value="${esc(data)}">
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

// ── Todas as pesagens ────────────────────────────────────────────
// Lista tudo o que entra na curva, dizendo de onde veio. As da clínica são
// só leitura: pertencem à sessão, e é lá que se corrige.
function pesagensCasaHTML() {
  const ps = pesosOrdenados().slice().reverse().slice(0, 20);
  if (!ps.length) return `<div class="vazio" style="padding:22px"><span class="flor">⚖️</span>Nenhuma pesagem registrada ainda.</div>`;

  return ps.map(p => {
    const org = ORIGEM_PESO[p.origem] || ORIGEM_PESO.casa;
    const daClinica = p.origem !== 'casa';
    return `
      <div class="lista-item">
        <span class="pesagem-ponto" style="border-color:${org.cor}"></span>
        <span class="li-txt">
          <span class="li-nome">${esc(fmt.peso(p.peso))}</span>
          <span class="li-sub">${esc(org.rotulo)}</span>
        </span>
        <span class="li-fim">${esc(fmt.curta(p.data))}</span>
        ${daClinica
          ? ''
          : `<button class="btn btn-suave btn-sm" onclick="removerPeso('${esc(p.id)}')" aria-label="Remover">${IC.lixo}</button>`}
      </div>`;
  }).join('');
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
