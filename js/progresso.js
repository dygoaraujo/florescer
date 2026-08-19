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
  const falta = (p.pesoMeta != null && atual != null) ? atual - p.pesoMeta : null;
  const ritmo = ritmoPeso();

  const notaMedia = dias14.length
    ? Math.round(dias14.reduce((s, d) => s + notaDe(d), 0) / dias14.length) : 0;

  document.getElementById('tela-progresso').innerHTML = `
    <header class="cabeca">
      <div class="cabeca-txt">
        <h1>Progresso</h1>
        <div class="data">o caminho até aqui</div>
      </div>
    </header>

    <!-- A sequência abre a tela: é o que ela olha todo dia. -->
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

    <!-- Relatório novo é notícia: sobe pro topo só enquanto ela não abriu. -->
    <div id="aviso-relatorio"></div>

    <div class="sec"><h2>Esta semana</h2><span class="sub">vs. os 7 dias anteriores</span></div>
    ${comparacaoSemanalHTML()}

    <div class="sec"><h2>Peso</h2></div>
    <div class="peso-hero">
      <div class="peso-hero-topo">
        <div>
          <div class="rotulo">Peso agora</div>
          <div class="peso-hero-v num">${esc(fmt.peso(atual))}</div>
        </div>
        ${perdido != null ? `
          <div class="peso-hero-dif ${perdido > 0 ? 'bom' : ''}">
            <div class="num">${perdido > 0 ? '−' : perdido < 0 ? '+' : ''}${esc(fmt.peso(Math.abs(perdido)))}</div>
            <div class="k">${perdido >= 0 ? 'desde o início' : 'acima do início'}</div>
          </div>` : ''}
      </div>
      ${falta != null && falta > 0
        ? `<div class="peso-hero-meta">Faltam <strong>${esc(fmt.peso(falta))}</strong> para os ${esc(fmt.peso(p.pesoMeta))} que você quer.</div>`
        : falta != null
          ? `<div class="peso-hero-meta ouro">Você chegou na meta de ${esc(fmt.peso(p.pesoMeta))} ✨</div>`
          : `<div class="peso-hero-meta">Informe o peso desejado em Ajustes para acompanhar o quanto falta.</div>`}
      ${ritmo != null ? `<p class="peso-hero-ritmo">${Math.abs(ritmo) < 0.05
          ? 'Peso estável nas últimas 4 semanas.'
          : `${ritmo > 0 ? 'Perdendo' : 'Ganhando'}, em média, ${esc(fmt.peso(Math.abs(ritmo)))} por semana nas últimas 4 semanas.`}</p>` : ''}
      ${graficoPeso(pesos)}
      ${resumoSessoesHTML()}
      <button class="btn btn-vazio btn-sm peso-hero-btn" onclick="ir('agenda')">Registrar uma pesagem</button>
    </div>

    <!-- Esta é A tela de métricas: tudo fica à vista, sem obrigar a escolher
         qual gráfico ver. -->
    <div class="sec"><h2>Água</h2><span class="sub">últimos 14 dias</span></div>
    <div class="cartao">${graficoAgua(dias14)}</div>

    <div class="sec"><h2>Aderência</h2><span class="sub">últimos ${12 * 7} dias</span></div>
    <div class="cartao">${heatmapAderencia()}</div>

    <div class="sec"><h2>Treinos</h2><span class="sub">${resumoTreinos()}</span></div>
    <div class="cartao">${heatmapTreinos()}</div>

    <div class="sec"><h2>Sono</h2></div>
    <div class="cartao">${listaSono(dias14)}</div>

    <div class="sec"><h2>Conquistas</h2>
      <span class="sub">${(DB.get('conquistas') || []).length} de ${MEDALHAS.length}</span></div>
    <div class="cartao">${medalhasHTML()}</div>

    <div class="sec"><h2>Como foi sua semana</h2></div>
    <div id="cartao-relatorio"></div>
  `;

  if (typeof renderCartaoRelatorio === 'function') renderCartaoRelatorio();
  if (typeof renderAvisoRelatorio === 'function') renderAvisoRelatorio();
};

/** "14 atividades em 9 dias · 6h20" — um dia pode ter mais de uma atividade,
 *  então contar só o número de registros mentiria sobre a constância. */
function resumoTreinos() {
  const logs = DB.get('logExercicios') || [];
  if (!logs.length) return 'últimas 12 semanas';
  const dias = new Set(logs.map(l => l.data)).size;
  const min = logs.reduce((s, l) => s + (l.duracao || 0), 0);
  const atividades = logs.length === dias
    ? `${dias} ${dias === 1 ? 'treino' : 'treinos'}`
    : `${logs.length} atividades em ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  return min ? `${atividades} · ${fmt.duracao(min)}` : atividades;
}

/** Sono: a clínica pediu regularidade, por isso o horário de deitar continua
 *  sendo o que abre a lista. A duração (sonoEfetivoMin, core.js) só existe
 *  quando o dia seguinte também tem "Acordar" registrado — quando dá, entra
 *  como reforço ao lado do horário, sem tomar o lugar dele. */
function listaSono(dias) {
  const logs = DB.get('logSono') || [];
  const doPeriodo = dias
    .map(d => ({ data: d, log: logs.find(l => l.data === d), min: sonoEfetivoMin(d) }))
    .filter(x => x.log);
  if (!doPeriodo.length) {
    return svgVazio('Toque em "Dormir" no fim do dia e o horário fica registrado aqui.');
  }

  const media = mediaDeHorario(doPeriodo.map(x => x.log.hora));
  const duracoes = doPeriodo.map(x => x.min).filter(m => m != null);
  const mediaMin = duracoes.length ? Math.round(duracoes.reduce((s, m) => s + m, 0) / duracoes.length) : null;

  return `
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:${mediaMin != null ? 4 : 14}px">
      <span class="rotulo">Deitou, em média</span>
      <span class="num" style="margin-left:auto;font-family:var(--display);
        font-variation-settings:'SOFT' 100,'opsz' 48;font-size:23px;font-weight:500;color:var(--ceu-forte)">${esc(media)}</span>
    </div>
    ${mediaMin != null ? `
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:14px">
      <span class="rotulo">Dormiu, em média</span>
      <span class="num" style="margin-left:auto;font-weight:600;color:var(--ceu-forte)">${esc(fmt.duracao(mediaMin))}</span>
    </div>` : ''}
    ${doPeriodo.slice().reverse().map(x => `
      <div class="lista-item" style="min-height:44px;padding:9px 0">
        <span class="li-txt"><span class="li-nome" style="font-size:14px">${esc(fmt.maiuscula(fmt.longa(x.data)))}</span></span>
        <span class="li-fim" style="font-weight:600;color:var(--ceu-forte)">${esc(x.log.hora)}${x.min != null ? ` <span style="color:var(--tinta-dim);font-weight:500">· ${esc(fmt.duracao(x.min))}</span>` : ''}</span>
      </div>`).join('')}`;
}

// ── Esta semana vs. a anterior ──────────────────────────────────
// Não espera o relatório de sábado: uma janela sempre viva de 7 dias contra
// os 7 anteriores, pra ela sentir se está melhorando no MEIO da semana, não
// só quando o relatório fecha. Rolante (não segunda-a-sábado como o
// relatório) de propósito — assim funciona igual em qualquer dia da semana.
function statsPeriodo(dias) {
  const notaMedia = Math.round(dias.reduce((s, d) => s + notaDe(d), 0) / dias.length);
  const meta = perfil().metaAgua || 3000;
  const aguaDias = dias.filter(d => aguaDoDia(d) >= meta).length;
  const treinoDias = new Set((DB.get('logExercicios') || [])
    .filter(l => dias.includes(l.data)).map(l => l.data)).size;
  const refFracoes = dias.map(d => partesDe(d).refeicoes).filter(v => v != null);
  const refPct = refFracoes.length
    ? Math.round(refFracoes.reduce((s, v) => s + v, 0) / refFracoes.length * 100) : null;
  return { notaMedia, aguaDias, treinoDias, refPct };
}

/** Pastilha de diferença: sobe = folha (bom em qualquer uma dessas 4
 *  métricas, ao contrário do peso). Desce fica neutro, sem cor de alarme —
 *  o app não usa vermelho pra não virar cobrança. */
function pillDelta(delta) {
  if (delta == null) return '';
  if (delta === 0) return `<span class="pill">igual</span>`;
  return `<span class="pill ${delta > 0 ? 'pill-folha' : ''}">${delta > 0 ? '↑' : '↓'} ${Math.abs(delta)}</span>`;
}

function comparacaoSemanalHTML() {
  const atual = statsPeriodo(ultimosDias(7));
  const anterior = statsPeriodo(ultimosDias(14).slice(0, 7));
  const refDelta = (atual.refPct != null && anterior.refPct != null) ? atual.refPct - anterior.refPct : null;

  return `
    <div class="kpis">
      <div class="kpi">
        <div class="v num">${atual.notaMedia}%</div>
        <div class="k">nota média</div>
        ${pillDelta(atual.notaMedia - anterior.notaMedia)}
      </div>
      <div class="kpi">
        <div class="v num">${atual.aguaDias}<small>/7</small></div>
        <div class="k">água na meta</div>
        ${pillDelta(atual.aguaDias - anterior.aguaDias)}
      </div>
      <div class="kpi">
        <div class="v num">${atual.treinoDias}<small>/7</small></div>
        <div class="k">dias de treino</div>
        ${pillDelta(atual.treinoDias - anterior.treinoDias)}
      </div>
      <div class="kpi">
        <div class="v num">${atual.refPct != null ? atual.refPct + '%' : '—'}</div>
        <div class="k">refeições</div>
        ${pillDelta(refDelta)}
      </div>
    </div>`;
}

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
// A curva passa por TODAS as pesagens, na ordem em que aconteceram. Cada ponto
// é colorido pela origem: em casa, chegada na clínica, saída da clínica. Assim
// o degrau que a manta térmica cria fica visível e explicado, em vez de sumir.
function graficoPeso(pesos) {
  if (!pesos.length) {
    return svgVazio('Registre uma pesagem na Agenda e a curva começa aqui.');
  }
  if (pesos.length === 1) {
    return svgVazio(`Primeira pesagem: ${fmt.peso(pesos[0].peso)}. Com a próxima, a curva aparece.`);
  }

  const H = 230;                       // mais alto que os outros: cabe rótulo em cada ponto
  const mX = 26, mT = 30, mB = 30;
  const vals = pesos.map(p => p.peso);
  const meta = perfil().pesoMeta;
  const min = Math.min(...vals, meta ?? Infinity) - .5;
  const max = Math.max(...vals, meta ?? -Infinity) + .5;
  const span = Math.max(.1, max - min);
  const cor = p => (ORIGEM_PESO[p.origem] || ORIGEM_PESO.casa).cor;

  // ── Eixo X pelo TEMPO real, não pela ordem ──────────────────────
  // As duas pesagens de uma sessão são do mesmo dia: ficam grudadas. Uma
  // semana até a sessão seguinte abre um vão. É assim que o gráfico conta
  // que aquele degrau aconteceu numa tarde, não ao longo de dias.
  const DENTRO_DO_DIA = 13;            // afastamento entre pontos do mesmo dia
  const t0 = deData(pesos[0].data).getTime();
  const t1 = deData(pesos[pesos.length - 1].data).getTime();
  const util = GW - mX * 2 - DENTRO_DO_DIA;

  const porData = {};
  pesos.forEach(p => { (porData[p.data] = porData[p.data] || []).push(p); });

  const px = pesos.map(p => {
    const base = t1 === t0
      ? mX + util / 2
      : mX + DENTRO_DO_DIA / 2 + ((deData(p.data).getTime() - t0) / (t1 - t0)) * util;
    const irmaos = porData[p.data];
    const i = irmaos.indexOf(p);
    return base + (i - (irmaos.length - 1) / 2) * DENTRO_DO_DIA;
  });
  const py = pesos.map(p => mT + (1 - (p.peso - min) / span) * (H - mT - mB));

  const linha = pesos.map((p, i) => `${i ? 'L' : 'M'}${px[i].toFixed(1)},${py[i].toFixed(1)}`).join(' ');
  const area = `${linha} L${px[px.length - 1].toFixed(1)},${H - mB} L${px[0].toFixed(1)},${H - mB} Z`;

  // ── Rótulos: um por ponto, sem colidir ──────────────────────────
  // Saída da sessão vai por baixo, o resto por cima — o par da sessão se
  // separa sozinho. Se ainda assim dois vizinhos se encostam, o segundo sobe
  // (ou desce) mais um degrau.
  const rotulos = [];
  pesos.forEach((p, i) => {
    const abaixo = p.origem === 'sessao-saida';
    let dy = abaixo ? 15 : -10;
    for (const r of rotulos) {
      if (Math.abs(r.x - px[i]) < 32 && Math.abs((r.y) - (py[i] + dy)) < 11) {
        dy += abaixo ? 12 : -12;
      }
    }
    rotulos.push({
      x: px[i], y: py[i] + dy, cor: cor(p),
      txt: p.peso.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    });
  });

  const usadas = [...new Set(pesos.map(p => p.origem || 'casa'))].filter(o => ORIGEM_PESO[o]);

  return `
    <svg class="grafico" viewBox="0 0 ${GW} ${H}" role="img" aria-label="Evolução do peso">
      <defs>
        <linearGradient id="gp" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stop-color="#D2648B" stop-opacity=".18"/>
          <stop offset="100%" stop-color="#D2648B" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${meta != null ? `
        <line x1="${mX - 8}" y1="${(mT + (1 - (meta - min) / span) * (H - mT - mB)).toFixed(1)}"
              x2="${GW - mX + 8}" y2="${(mT + (1 - (meta - min) / span) * (H - mT - mB)).toFixed(1)}"
              stroke="#8A6FC7" stroke-width="1.4" stroke-dasharray="5 5" opacity=".55"/>
        <text x="${GW - mX + 8}" y="${(mT + (1 - (meta - min) / span) * (H - mT - mB) - 6).toFixed(1)}"
              text-anchor="end" font-size="10.5" fill="#8A6FC7" ${FONTE_SVG}>meta ${esc(String(meta))} kg</text>` : ''}
      <path d="${area}" fill="url(#gp)"/>
      <path d="${linha}" fill="none" stroke="#D2648B" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/>
      ${pesos.map((p, i) => `<circle cx="${px[i].toFixed(1)}" cy="${py[i].toFixed(1)}"
          r="${i === pesos.length - 1 ? 5 : 3.8}" fill="#fff" stroke="${cor(p)}" stroke-width="2.4">
          <title>${esc(fmt.data(p.data))} · ${esc(fmt.peso(p.peso))} · ${esc((ORIGEM_PESO[p.origem] || ORIGEM_PESO.casa).rotulo)}</title>
        </circle>`).join('')}
      ${rotulos.map(r => `<text x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" text-anchor="middle"
          font-size="10.5" font-weight="700" fill="${r.cor}" ${FONTE_SVG}>${esc(r.txt)}</text>`).join('')}
      <text x="${mX - 8}" y="${H - 8}" font-size="10.5" fill="#B9B0C0" ${FONTE_SVG}>${esc(fmt.curta(pesos[0].data))}</text>
      ${t1 !== t0 ? `<text x="${GW - mX + 8}" y="${H - 8}" text-anchor="end" font-size="10.5"
          fill="#B9B0C0" ${FONTE_SVG}>${esc(fmt.curta(pesos[pesos.length - 1].data))}</text>` : ''}
    </svg>
    ${usadas.length > 1 ? `
      <div class="legenda-peso">
        ${usadas.map(o => `<span><i style="border-color:${ORIGEM_PESO[o].cor}"></i>${esc(ORIGEM_PESO[o].rotulo)}</span>`).join('')}
      </div>` : ''}`;
}

/** Explica o degrau que aparece na curva nos dias de sessão: boa parte do que
 *  sai na manta térmica é água, e volta nos dias seguintes. */
function resumoSessoesHTML() {
  const feitas = (DB.get('sessoes') || [])
    .filter(s => s.pesoEntrada != null && s.pesoSaida != null);
  if (!feitas.length) return '';

  const media = feitas.reduce((s, x) => s + (x.pesoEntrada - x.pesoSaida), 0) / feitas.length;
  return `
    <div class="nota-grafico">
      <span>${feitas.length} ${feitas.length === 1 ? 'sessão' : 'sessões'} na clínica ·
        média de ${esc(fmt.peso(Math.abs(media)))} ${media >= 0 ? 'a menos' : 'a mais'} na saída</span>
      <span class="nota-grafico-obs">Para comparar semana com semana, use os pesos de chegada:
        boa parte do que sai na manta é água.</span>
    </div>`;
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
/** Era um gráfico de linha de 14 dias; virou um heatmap de 12 semanas
 *  (mesmo componente visual do heatmap de treino, só que colorido pela nota
 *  em vez de feito/não-feito). A linha de 14 dias já se repetia com a "média
 *  de 14 dias" que abre a tela — um heatmap de ~3 meses mostra PADRÃO
 *  (ela sempre cai no fim de semana? sempre firme na segunda?) que uma linha
 *  curta não mostra. */
function heatmapAderencia() {
  const semanas = 12;
  const fim = somaDias(hoje(), 6 - ((deData(hoje()).getDay() + 6) % 7));   // domingo desta semana
  const inicio = somaDias(fim, -(semanas * 7 - 1));

  const cols = [];
  for (let s = 0; s < semanas; s++) {
    const dias = [];
    for (let d = 0; d < 7; d++) {
      const data = somaDias(inicio, s * 7 + d);
      const futuro = data > hoje();
      const n = futuro ? 0 : notaDe(data);
      dias.push(`<span class="heat-d ${futuro ? 'fora' : 'nota'}"
        ${futuro ? '' : `style="opacity:${(.12 + (n / 100) * .88).toFixed(2)}"`}
        title="${esc(data)} · ${n}%"></span>`);
    }
    cols.push(`<div class="heat-col">${dias.join('')}</div>`);
  }

  return `
    <div class="heat">${cols.join('')}</div>
    <div style="display:flex;align-items:center;gap:5px;margin-top:12px;font-size:12px;color:var(--tinta-dim)">
      <span>menos</span>
      <span class="heat-d legenda nota" style="opacity:.15"></span>
      <span class="heat-d legenda nota" style="opacity:.4"></span>
      <span class="heat-d legenda nota" style="opacity:.65"></span>
      <span class="heat-d legenda nota" style="opacity:1"></span>
      <span>mais</span>
      <span style="margin-left:auto">${NOTA_SEQUENCIA}%+ mantém a sequência</span>
    </div>`;
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

/** "Perdendo, em média, 0,8 kg por semana" — o total desde o início já mostra
 *  o resultado acumulado; isto mostra o RITMO recente, que anima mesmo quando
 *  o número acumulado já é grande e para de surpreender. Só pesagens
 *  comparáveis entram na conta (sem saída de sessão — é água, não gordura,
 *  mesma razão de resumoSessoesHTML). Exige pelo menos 10 dias de intervalo
 *  entre a primeira e a última da janela, senão duas pesagens em dias
 *  seguidos virariam um ritmo de mentira. */
function ritmoPeso() {
  const JANELA_DIAS = 28;
  const desde = somaDias(hoje(), -JANELA_DIAS);
  const comparaveis = pesosOrdenados().filter(p => p.origem !== 'sessao-saida' && p.data >= desde);
  if (comparaveis.length < 2) return null;

  const primeira = comparaveis[0], ultima = comparaveis[comparaveis.length - 1];
  const dias = (deData(ultima.data) - deData(primeira.data)) / 86400000;
  if (dias < 10) return null;

  return (primeira.peso - ultima.peso) / (dias / 7);   // kg por semana; negativo = ganhando
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
