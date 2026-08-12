/* ══ FLORESCER — Progresso ═══════════════════════════════════════
   Peso, água, aderência, treinos, sequência e conquistas.
   Gráficos em SVG puro (viewBox 1000×300, height:auto) — sem biblioteca.
   ════════════════════════════════════════════════════════════════ */

// Um dia entra na sequência quando a nota fecha em 70% ou mais.
const NOTA_SEQUENCIA = 70;

RENDER.progresso = function () {
  const seq = sequencia();
  const dias14 = ultimosDias(14);
  const p = perfil();

  const pesos = pesosOrdenados();
  const inicial = p.pesoInicial ?? (pesos[0]?.peso ?? null);
  const atual = pesoAtual();
  const perdido = (inicial != null && atual != null) ? inicial - atual : null;

  const treinos = DB.get('logExercicios') || [];
  const notaMedia = dias14.length
    ? Math.round(dias14.reduce((s, d) => s + notaDe(d), 0) / dias14.length) : 0;

  document.getElementById('tela-progresso').innerHTML = `
    <header class="cabeca">
      <div class="cabeca-txt">
        <h1>Progresso</h1>
        <div class="data">o caminho até aqui</div>
      </div>
    </header>

    <div class="sequencia">
      <span class="chama" aria-hidden="true">${seq.atual > 0 ? '🔥' : '🌱'}</span>
      <div style="flex:1">
        <div class="v num">${seq.atual} ${seq.atual === 1 ? 'dia' : 'dias'}</div>
        <div class="k">de sequência · recorde de ${seq.recorde}</div>
      </div>
      <div style="text-align:right">
        <div class="v num" style="font-size:22px">${notaMedia}%</div>
        <div class="k">média de 14 dias</div>
      </div>
    </div>

    <div class="kpis" style="margin-top:14px">
      <div class="kpi">
        <div class="v num" style="color:${perdido != null && perdido > 0 ? 'var(--folha)' : 'inherit'}">
          ${perdido == null ? '—' : (perdido > 0 ? '−' : '') + fmt.peso(Math.abs(perdido))}</div>
        <div class="k">${perdido != null && perdido < 0 ? 'ganho desde o início' : 'perdido desde o início'}</div>
      </div>
      <div class="kpi">
        <div class="v num">${treinos.length}</div>
        <div class="k">treinos registrados</div>
      </div>
    </div>

    <div class="sec"><h2>Peso</h2><span class="sub">${pesos.length} pesagens</span></div>
    <div class="cartao">${graficoPeso(pesos)}</div>

    <div class="sec"><h2>Água</h2><span class="sub">últimos 14 dias</span></div>
    <div class="cartao">${graficoAgua(dias14)}</div>

    <div class="sec"><h2>Aderência</h2><span class="sub">nota de cada dia</span></div>
    <div class="cartao">${graficoAderencia(dias14)}</div>

    <div class="sec"><h2>Treinos</h2><span class="sub">últimas 12 semanas</span></div>
    <div class="cartao">${heatmapTreinos()}</div>

    <div class="sec"><h2>Conquistas</h2></div>
    <div class="cartao">${medalhasHTML()}</div>

    <div class="sec"><h2>Relatório da semana</h2></div>
    <div id="cartao-relatorio"></div>
  `;

  if (typeof renderCartaoRelatorio === 'function') renderCartaoRelatorio();
};

// ── Utilidades ───────────────────────────────────────────────────
function ultimosDias(n) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) out.push(somaDias(hoje(), -k));
  return out;
}

/** Sequência de dias com nota ≥ 70, contada de trás pra frente a partir de ontem
 *  (o dia de hoje só entra quando já bateu a marca — nunca quebra a sequência à toa). */
function sequencia() {
  const registrados = new Set();
  ['logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios']
    .forEach(k => (DB.get(k) || []).forEach(l => registrados.add(l.data)));
  if (!registrados.size) return { atual: 0, recorde: 0 };

  const primeiro = [...registrados].sort()[0];
  const bom = d => notaDe(d) >= NOTA_SEQUENCIA;

  let atual = 0;
  let d = hoje();
  if (!bom(d)) d = somaDias(d, -1);          // hoje ainda está em andamento
  while (d >= primeiro && bom(d)) { atual++; d = somaDias(d, -1); }

  let recorde = 0, corrida = 0;
  for (let x = primeiro; x <= hoje(); x = somaDias(x, 1)) {
    if (bom(x)) { corrida++; recorde = Math.max(recorde, corrida); } else corrida = 0;
  }

  return { atual, recorde: Math.max(recorde, atual) };
}

const svgVazio = msg => `<div class="vazio" style="padding:26px"><span class="flor">📈</span>${esc(msg)}</div>`;

// O viewBox fica perto do tamanho real em que o gráfico é exibido (~300px de
// largura no celular), então 1 unidade ≈ 1 pixel: traços e textos saem com a
// espessura que foram escritos, sem virar fio de cabelo.
const GW = 340, GH = 190;
const FONTE_SVG = 'font-family="Figtree, sans-serif"';

// ── Gráfico de peso ──────────────────────────────────────────────
function graficoPeso(pesos) {
  if (pesos.length < 2) return svgVazio('Registre pelo menos duas pesagens para ver a curva.');

  const mX = 16, mT = 20, mB = 26;
  const vals = pesos.map(p => p.peso);
  const meta = perfil().pesoMeta;
  const min = Math.min(...vals, meta ?? Infinity) - .5;
  const max = Math.max(...vals, meta ?? -Infinity) + .5;
  const span = Math.max(.1, max - min);

  const x = i => mX + (i / (pesos.length - 1)) * (GW - mX * 2);
  const y = v => mT + (1 - (v - min) / span) * (GH - mT - mB);

  const linha = pesos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.peso).toFixed(1)}`).join(' ');
  const area = `${linha} L${x(pesos.length - 1).toFixed(1)},${GH - mB} L${x(0).toFixed(1)},${GH - mB} Z`;

  return `
    <svg class="grafico" viewBox="0 0 ${GW} ${GH}" role="img" aria-label="Evolução do peso">
      <defs>
        <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#D2648B" stop-opacity=".22"/>
          <stop offset="100%" stop-color="#D2648B" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${meta != null ? `
        <line x1="${mX}" y1="${y(meta).toFixed(1)}" x2="${GW - mX}" y2="${y(meta).toFixed(1)}"
              stroke="#8A6FC7" stroke-width="1.4" stroke-dasharray="5 5" opacity=".55"/>
        <text x="${GW - mX}" y="${(y(meta) - 6).toFixed(1)}" text-anchor="end"
              font-size="11" fill="#8A6FC7" ${FONTE_SVG}>meta ${esc(String(meta))} kg</text>` : ''}
      <path d="${area}" fill="url(#gp)"/>
      <path d="${linha}" fill="none" stroke="#D2648B" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${pesos.map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p.peso).toFixed(1)}" r="${i === pesos.length - 1 ? 5 : 3}"
          fill="#fff" stroke="#D2648B" stroke-width="2.2"/>`).join('')}
      <text x="${x(pesos.length - 1).toFixed(1)}" y="${(y(vals[vals.length - 1]) - 11).toFixed(1)}" text-anchor="end"
            font-size="12" font-weight="600" fill="#D2648B" ${FONTE_SVG}>${esc(fmt.peso(vals[vals.length - 1]))}</text>
      <text x="${mX}" y="${GH - 6}" font-size="11" fill="#B9B0C0" ${FONTE_SVG}>${esc(fmt.curta(pesos[0].data))}</text>
      <text x="${GW - mX}" y="${GH - 6}" text-anchor="end" font-size="11" fill="#B9B0C0" ${FONTE_SVG}>${esc(fmt.curta(pesos[pesos.length - 1].data))}</text>
    </svg>`;
}

// ── Gráfico de água ──────────────────────────────────────────────
function graficoAgua(dias) {
  const meta = perfil().metaAgua || 3000;
  const vals = dias.map(aguaDoDia);
  if (!vals.some(v => v > 0)) return svgVazio('Beba um copo pela tela Hoje e o gráfico começa.');

  const mX = 4, mT = 16, mB = 22;
  const teto = Math.max(meta, ...vals) * 1.08;
  const lg = (GW - mX * 2) / dias.length;
  const bw = Math.min(18, lg * .62);
  const alturaUtil = GH - mT - mB;
  const yMeta = mT + (1 - meta / teto) * alturaUtil;

  return `
    <svg class="grafico" viewBox="0 0 ${GW} ${GH}" role="img" aria-label="Água por dia">
      <line x1="${mX}" y1="${yMeta.toFixed(1)}" x2="${GW - mX}" y2="${yMeta.toFixed(1)}"
            stroke="#4F8FB4" stroke-width="1.4" stroke-dasharray="5 5" opacity=".5"/>
      ${dias.map((d, i) => {
        const h = (vals[i] / teto) * alturaUtil;
        const cx = mX + lg * i + lg / 2;
        return `<rect x="${(cx - bw / 2).toFixed(1)}" y="${(GH - mB - h).toFixed(1)}" width="${bw.toFixed(1)}"
                  height="${Math.max(2.5, h).toFixed(1)}" rx="${(bw / 2.4).toFixed(1)}"
                  fill="${vals[i] >= meta ? '#4F8FB4' : '#C6DFEC'}"/>`;
      }).join('')}
      ${dias.map((d, i) => (i % 3 === 0 || i === dias.length - 1)
        ? `<text x="${(mX + lg * i + lg / 2).toFixed(1)}" y="${GH - 6}" text-anchor="middle" font-size="11"
             fill="#B9B0C0" ${FONTE_SVG}>${deData(d).getDate()}</text>` : '').join('')}
    </svg>
    <div style="display:flex;gap:14px;margin-top:12px;font-size:12px;color:var(--tinta-dim)">
      <span><span style="display:inline-block;width:9px;height:9px;border-radius:3px;background:var(--ceu-forte);margin-right:5px"></span>bateu a meta</span>
      <span style="margin-left:auto">${vals.filter(v => v >= meta).length} de ${dias.length} dias</span>
    </div>`;
}

// ── Gráfico de aderência ─────────────────────────────────────────
function graficoAderencia(dias) {
  const notas = dias.map(notaDe);
  if (!notas.some(n => n > 0)) return svgVazio('A nota de cada dia aparece aqui conforme você usa o app.');

  const mX = 10, mT = 22, mB = 20;
  const x = i => mX + (i / (dias.length - 1)) * (GW - mX * 2);
  const y = v => mT + (1 - v / 100) * (GH - mT - mB);
  const linha = notas.map((n, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(n).toFixed(1)}`).join(' ');

  return `
    <svg class="grafico" viewBox="0 0 ${GW} ${GH}" role="img" aria-label="Aderência diária">
      <defs>
        <linearGradient id="ga" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#8A6FC7" stop-opacity=".2"/>
          <stop offset="100%" stop-color="#8A6FC7" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <line x1="${mX}" y1="${y(NOTA_SEQUENCIA).toFixed(1)}" x2="${GW - mX}" y2="${y(NOTA_SEQUENCIA).toFixed(1)}"
            stroke="#DED4F2" stroke-width="1.4" stroke-dasharray="5 5"/>
      <text x="${GW - mX}" y="${(y(NOTA_SEQUENCIA) - 5).toFixed(1)}" text-anchor="end" font-size="10"
            fill="#B9B0C0" ${FONTE_SVG}>${NOTA_SEQUENCIA}% — o que mantém a sequência</text>
      <path d="${linha} L${x(dias.length - 1).toFixed(1)},${GH - mB} L${x(0).toFixed(1)},${GH - mB} Z" fill="url(#ga)"/>
      <path d="${linha}" fill="none" stroke="#8A6FC7" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
      ${notas.map((n, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(n).toFixed(1)}" r="${i === notas.length - 1 ? 5 : 2.8}"
          fill="#fff" stroke="#8A6FC7" stroke-width="2.2"/>`).join('')}
    </svg>`;
}

// ── Heatmap de treinos ───────────────────────────────────────────
function heatmapTreinos() {
  const treinos = new Set((DB.get('logExercicios') || []).map(l => l.data));
  const diasTreino = perfil().diasExercicio || [];
  const semanas = 12;

  const fim = somaDias(hoje(), 6 - ((deData(hoje()).getDay() + 6) % 7));   // domingo desta semana
  const inicio = somaDias(fim, -(semanas * 7 - 1));

  const cols = [];
  for (let s = 0; s < semanas; s++) {
    const dias = [];
    for (let d = 0; d < 7; d++) {
      const data = somaDias(inicio, s * 7 + d);
      const futuro = data > hoje();
      const cls = futuro ? 'fora'
        : treinos.has(data) ? 'on'
        : diasTreino.includes(deData(data).getDay()) ? 'meio' : '';
      dias.push(`<span class="heat-d ${cls}" title="${data}"></span>`);
    }
    cols.push(`<div class="heat-col">${dias.join('')}</div>`);
  }

  const naSemana = (DB.get('logExercicios') || []).filter(l => l.data >= inicioSemana(hoje())).length;
  const meta = perfil().metaSemanalExercicio || 0;

  return `
    <div class="heat">${cols.join('')}</div>
    <div style="display:flex;gap:14px;margin-top:12px;font-size:12px;color:var(--tinta-dim)">
      <span><span class="heat-d legenda on" style="display:inline-block;vertical-align:-1px;margin-right:5px"></span>treinou</span>
      <span><span class="heat-d legenda meio" style="display:inline-block;vertical-align:-1px;margin-right:5px"></span>era dia</span>
      <span style="margin-left:auto">${naSemana}${meta ? ' de ' + meta : ''} nesta semana</span>
    </div>`;
}

// ══ CONQUISTAS ═════════════════════════════════════════════════

const MEDALHAS = [
  { id: 'inicio',    ic: '🌱', nome: 'Primeiro dia',      teste: () => (DB.get('logRefeicoes') || []).length > 0 },
  { id: 'dia100',    ic: '🌸', nome: 'Um dia 100%',       teste: () => diasComNota(100).length > 0 },
  { id: 'semana1',   ic: '📅', nome: '7 dias seguidos',   teste: () => sequencia().recorde >= 7 },
  { id: 'kg1',       ic: '⚖️', nome: 'Primeiro quilo',    teste: () => kgPerdidos() >= 1 },
  { id: 'agua7',     ic: '💧', nome: '7 dias de água',    teste: () => diasDeAgua() >= 7 },
  { id: 'treino10',  ic: '💪', nome: '10 treinos',        teste: () => (DB.get('logExercicios') || []).length >= 10 },
  { id: 'sessao1',   ic: '✨', nome: 'Primeira sessão',   teste: () => (DB.get('sessoes') || []).some(s => s.feita) },
  { id: 'dias30',    ic: '👑', nome: '30 dias seguidos',  teste: () => sequencia().recorde >= 30 },
  { id: 'sessoesAll',ic: '🏁', nome: 'Todas as sessões',  teste: () => {
      const s = DB.get('sessoes') || [];
      return s.length > 0 && s.every(x => x.feita);
    } },
];

function diasComNota(min) {
  const datas = new Set();
  ['logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios']
    .forEach(k => (DB.get(k) || []).forEach(l => datas.add(l.data)));
  return [...datas].filter(d => notaDe(d) >= min);
}

function kgPerdidos() {
  const p = perfil();
  const ps = pesosOrdenados();
  const inicial = p.pesoInicial ?? (ps[0]?.peso ?? null);
  const atual = pesoAtual();
  return (inicial != null && atual != null) ? inicial - atual : 0;
}

function diasDeAgua() {
  const meta = perfil().metaAgua || 3000;
  const datas = new Set((DB.get('logAgua') || []).map(l => l.data));
  return [...datas].filter(d => aguaDoDia(d) >= meta).length;
}

/** Avalia todas as medalhas e comemora as novas. Chamado após cada registro. */
function checarConquistas() {
  const ganhas = DB.get('conquistas') || [];
  const tem = new Set(ganhas.map(c => c.id));
  let novas = 0;

  MEDALHAS.forEach(m => {
    if (tem.has(m.id)) return;
    let ok = false;
    try { ok = m.teste(); } catch { ok = false; }
    if (!ok) return;
    ganhas.push({ id: m.id, em: hoje() });
    novas++;
    setTimeout(() => toast(`${m.ic} ${m.nome}`), novas * 350);
  });

  if (novas) DB.set('conquistas', ganhas);
}

function medalhasHTML() {
  const tem = new Set((DB.get('conquistas') || []).map(c => c.id));
  return `<div class="medalhas">
    ${MEDALHAS.map(m => `
      <div class="medalha ${tem.has(m.id) ? 'on' : ''}">
        <div class="ic" aria-hidden="true">${m.ic}</div>
        <div class="n">${esc(m.nome)}</div>
      </div>`).join('')}
  </div>`;
}
