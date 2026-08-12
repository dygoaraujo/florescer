/* ══ FLORESCER — Relatório da semana ═════════════════════════════
   Cobre de segunda a sábado e fica pronto no sábado à noite, depois da
   última refeição do plano. Uma vez pronto, congela — a semana passada
   não muda mais. Sempre com a comparação com a semana anterior.
   ════════════════════════════════════════════════════════════════ */

/** Horário de corte: a última refeição do plano no sábado (ou 20:00). */
function horaCorteRelatorio() {
  const d = dietaAtiva();
  if (!d || !d.refeicoes.length) return '20:00';
  return d.refeicoes.reduce((max, r) => (minutosDe(r.hora) > minutosDe(max) ? r.hora : max), '00:00');
}

/** A semana que começa em `ini` (segunda) já pode ser fechada? */
function relatorioLiberado(ini) {
  const sabado = somaDias(ini, 5);
  const hj = hoje();
  if (hj > sabado) return true;
  if (hj < sabado) return false;
  return minutosDe(horaLocal()) >= minutosDe(horaCorteRelatorio());
}

function diasDaSemana(ini) {
  return Array.from({ length: 6 }, (_, k) => somaDias(ini, k));   // seg → sáb
}

/** Peso mais recente até (e incluindo) uma data. */
function pesoAte(data) {
  const ps = pesosOrdenados().filter(p => p.data <= data);
  return ps.length ? ps[ps.length - 1].peso : null;
}

// O registro guarda a hora REAL e a hora do plano. Mais de 1h30 de diferença
// deixou de ser "quase na hora" — é o espaçamento entre refeições saindo do lugar.
const TOLERANCIA_HORARIO = 90;

function foraDoHorario(l) {
  if (l.status !== 'feita' || !l.horaPlanejada) return false;
  return Math.abs(minutosDe(l.hora) - minutosDe(l.horaPlanejada)) > TOLERANCIA_HORARIO;
}

/** Média de horários noturnos (23:40 e 00:20 dão 00:00, não meio-dia). */
function mediaDeHorario(horas) {
  if (!horas.length) return null;
  const mins = horas.map(h => {
    const m = minutosDe(h);
    return m < 12 * 60 ? m + 24 * 60 : m;      // madrugada conta como "depois"
  });
  const media = Math.round(mins.reduce((s, m) => s + m, 0) / mins.length) % (24 * 60);
  return `${String(Math.floor(media / 60)).padStart(2, '0')}:${String(media % 60).padStart(2, '0')}`;
}

/** Os grupos que mais ficaram de fora das refeições confirmadas na semana. */
function maisFaltou(logs) {
  const conta = {};
  logs.filter(l => l.status === 'feita').forEach(l => {
    (l.faltou || []).forEach(g => { conta[g] = (conta[g] || 0) + 1; });
  });
  return Object.entries(conta)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([nome, vezes]) => ({ nome, vezes }));
}

function dadosSemana(ini) {
  const dias = diasDaSemana(ini);
  const dieta = dietaAtiva();
  const metaAgua = perfil().metaAgua || 3000;

  const logR = (DB.get('logRefeicoes') || []).filter(l => dias.includes(l.data));
  const logM = (DB.get('logMedicamentos') || []).filter(l => dias.includes(l.data));
  const logE = (DB.get('logExercicios') || []).filter(l => dias.includes(l.data));

  const refsEsperadas = (dieta ? dieta.refeicoes.length : 0) * dias.length;
  const medsEsperados = dias.reduce((s, d) => s + medsDoDia(d).length, 0);
  const aguaTotal = dias.reduce((s, d) => s + aguaDoDia(d), 0);

  const pesoIni = pesoAte(somaDias(ini, -1)) ?? pesoAte(dias[0]);
  const pesoFim = pesoAte(dias[dias.length - 1]);

  return {
    ini, fim: dias[dias.length - 1],
    nota: Math.round(dias.reduce((s, d) => s + notaDe(d), 0) / dias.length),
    refeicoesFeitas: logR.filter(l => l.status === 'feita').length,
    refeicoesPuladas: logR.filter(l => l.status === 'pulada').length,
    refeicoesIncompletas: logR.filter(l => l.status === 'feita' && l.completa === false).length,
    refeicoesForaDoHorario: logR.filter(foraDoHorario).length,
    faltasComuns: maisFaltou(logR),
    horaSonoMedia: mediaDeHorario((DB.get('logSono') || []).filter(l => dias.includes(l.data)).map(l => l.hora)),
    refeicoesEsperadas: refsEsperadas,
    vitaminas: logM.length,
    vitaminasEsperadas: medsEsperados,
    aguaTotal,
    diasMetaAgua: dias.filter(d => aguaDoDia(d) >= metaAgua).length,
    diasNaSemana: dias.length,
    treinos: logE.length,
    tiposTreino: [...new Set(logE.map(l => l.tipo))],
    pesoIni, pesoFim,
    pesoPerdido: (pesoIni != null && pesoFim != null) ? pesoIni - pesoFim : null,
  };
}

/** Percentuais por área — usados nos pontos fortes e a melhorar. */
function areasSemana(d) {
  return [
    { chave: 'refeicoes', rotulo: 'as refeições do plano', pct: d.refeicoesEsperadas ? d.refeicoesFeitas / d.refeicoesEsperadas : null },
    { chave: 'agua',      rotulo: 'a água',                pct: d.diasNaSemana ? d.diasMetaAgua / d.diasNaSemana : null },
    { chave: 'vitaminas', rotulo: 'as vitaminas',          pct: d.vitaminasEsperadas ? d.vitaminas / d.vitaminasEsperadas : null },
    { chave: 'treinos',   rotulo: 'os treinos',            pct: (perfil().metaSemanalExercicio || 0) ? Math.min(1, d.treinos / perfil().metaSemanalExercicio) : null },
  ].filter(a => a.pct !== null);
}

function pontosSemana(d) {
  const areas = areasSemana(d).sort((a, b) => b.pct - a.pct);
  const fortes = areas.filter(a => a.pct >= .8).slice(0, 2);
  const fracos = areas.filter(a => a.pct < .7).slice(-2).reverse();
  return {
    fortes: fortes.length ? fortes.map(a => `Você manteve ${a.rotulo} em ${Math.round(a.pct * 100)}%.`)
                          : ['Você registrou a semana inteira — é assim que dá pra enxergar o que ajustar.'],
    fracos: fracos.length ? fracos.map(a => `${a.rotulo[0].toUpperCase() + a.rotulo.slice(1)} ficou em ${Math.round(a.pct * 100)}%.`)
                          : ['Nada ficou pra trás nesta semana.'],
  };
}

/** Congela a semana num registro, se ainda não existir e já estiver liberada. */
function fecharRelatorio(ini) {
  const rels = DB.get('relatorios') || [];
  if (rels.some(r => r.ini === ini)) return rels.find(r => r.ini === ini);
  if (!relatorioLiberado(ini)) return null;
  const reg = { id: uid(), ...dadosSemana(ini), fechadoEm: hoje() };
  rels.push(reg);
  DB.set('relatorios', rels);
  return reg;
}

/** Fecha tudo que já passou — chamado ao abrir a tela de Progresso. */
function fecharRelatoriosPendentes() {
  const datas = new Set();
  ['logRefeicoes', 'logAgua', 'logMedicamentos', 'logExercicios']
    .forEach(k => (DB.get(k) || []).forEach(l => datas.add(l.data)));
  if (!datas.size) return;
  const primeira = inicioSemana([...datas].sort()[0]);
  for (let s = primeira; s <= inicioSemana(hoje()); s = somaDias(s, 7)) fecharRelatorio(s);
}

// ── Cartão na tela de Progresso ──────────────────────────────────
function renderCartaoRelatorio() {
  fecharRelatoriosPendentes();

  const cx = document.getElementById('cartao-relatorio');
  if (!cx) return;

  const rels = (DB.get('relatorios') || []).slice().sort((a, b) => b.ini.localeCompare(a.ini));
  const semanaAtual = inicioSemana(hoje());
  const jaTem = rels.some(r => r.ini === semanaAtual);

  cx.innerHTML = `
    ${!jaTem ? `
      <div class="cartao" style="background:linear-gradient(165deg,var(--lavanda-veu),var(--nuvem) 70%)">
        <div class="rotulo" style="color:var(--lavanda-forte);margin-bottom:6px">Esta semana</div>
        <p style="font-size:14px;color:var(--tinta-dim);line-height:1.6">
          O resumo de segunda a sábado fica pronto no <strong style="color:var(--tinta)">sábado às ${esc(horaCorteRelatorio())}</strong>,
          depois da última refeição.</p>
        <div style="display:flex;gap:18px;margin-top:14px">
          ${previaSemana(dadosSemana(semanaAtual))}
        </div>
      </div>` : ''}

    ${rels.length ? rels.map(r => `
      <button class="lista-item cartao" style="margin-top:12px" onclick="abrirRelatorio('${esc(r.ini)}')">
        <span class="li-txt">
          <span class="li-nome">${esc(fmt.curta(r.ini))} a ${esc(fmt.curta(r.fim))}</span>
          <span class="li-sub">nota ${r.nota}% · ${r.treinos} ${r.treinos === 1 ? 'treino' : 'treinos'}${r.pesoPerdido ? ` · ${r.pesoPerdido > 0 ? '−' : '+'}${fmt.peso(Math.abs(r.pesoPerdido))}` : ''}</span>
        </span>
        <span style="color:var(--tinta-fraca)">${IC.seta}</span>
      </button>`).join('')
      : (jaTem ? '' : `<p style="text-align:center;font-size:12.5px;color:var(--tinta-fraca);margin-top:14px">
           Seu primeiro relatório aparece aqui no sábado.</p>`)}
  `;
}

function previaSemana(d) {
  const itens = [
    [`${d.refeicoesFeitas}`, 'refeições'],
    [`${(d.aguaTotal / 1000).toFixed(1)} L`, 'de água'],
    [`${d.treinos}`, d.treinos === 1 ? 'treino' : 'treinos'],
  ];
  return itens.map(([v, k]) => `
    <div>
      <div class="num" style="font-family:var(--display);font-variation-settings:'SOFT' 100,'opsz' 40;font-size:21px;font-weight:500">${esc(v)}</div>
      <div style="font-size:11.5px;color:var(--tinta-dim);margin-top:2px">${esc(k)}</div>
    </div>`).join('');
}

/** O relatório mora no fim da tela, mas quando sai um novo ele é notícia:
 *  vira um aviso no topo até ela abrir. Depois some e não incomoda mais. */
function renderAvisoRelatorio() {
  const cx = document.getElementById('aviso-relatorio');
  if (!cx) return;
  cx.innerHTML = '';

  const novo = (DB.get('relatorios') || [])
    .filter(r => !r.lido)
    .sort((a, b) => b.ini.localeCompare(a.ini))[0];
  if (!novo) return;

  cx.innerHTML = `
    <button class="aviso-rel" onclick="abrirRelatorio('${esc(novo.ini)}')">
      <span class="aviso-rel-ic" aria-hidden="true">✨</span>
      <span class="aviso-rel-txt">
        <strong>Seu resumo da semana está pronto</strong>
        <span>${esc(fmt.curta(novo.ini))} a ${esc(fmt.curta(novo.fim))} · nota ${novo.nota}%</span>
      </span>
      <span class="aviso-rel-seta">${IC.seta}</span>
    </button>`;
}

function marcarRelatorioLido(ini) {
  const rels = DB.get('relatorios') || [];
  const r = rels.find(x => x.ini === ini);
  if (!r || r.lido) return;
  r.lido = true;
  DB.set('relatorios', rels);
}

// ── Relatório completo ───────────────────────────────────────────
function abrirRelatorio(ini) {
  marcarRelatorioLido(ini);
  if (typeof renderAvisoRelatorio === 'function') renderAvisoRelatorio();
  const rels = DB.get('relatorios') || [];
  const r = rels.find(x => x.ini === ini) || dadosSemana(ini);
  const ant = rels.find(x => x.ini === somaDias(ini, -7)) || null;
  const pts = pontosSemana(r);

  const linha = (rotulo, valor, atual, anterior, inverter) => {
    let seta = '';
    if (anterior != null && atual != null && anterior !== atual) {
      const melhor = inverter ? atual < anterior : atual > anterior;
      const delta = Math.abs(atual - anterior).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      seta = `<span class="pill ${melhor ? 'pill-folha' : 'pill-ambar'}" style="margin-left:auto">
        ${melhor ? '↑' : '↓'} ${esc(delta)}</span>`;
    } else if (anterior != null) {
      seta = `<span class="li-fim" style="margin-left:auto">igual</span>`;
    }
    return `<div class="lista-item" style="min-height:48px">
      <span class="li-txt"><span class="li-nome">${esc(rotulo)}</span></span>
      <span class="li-fim" style="font-weight:600;color:var(--tinta)">${valor}</span>
      ${seta}
    </div>`;
  };

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div>
        <h2>Como foi sua semana</h2>
        <div class="dica">${esc(fmt.data(r.ini))} a ${esc(fmt.data(r.fim))}</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo">
      <div style="text-align:center;padding:8px 0 22px">
        <div class="num" style="font-family:var(--display);font-variation-settings:'SOFT' 100,'WONK' 1,'opsz' 72;
             font-size:56px;font-weight:500;line-height:1;color:${r.nota >= 80 ? 'var(--ouro-forte)' : 'var(--rosa-forte)'}">${r.nota}<span style="font-size:24px">%</span></div>
        <div class="rotulo" style="margin-top:8px">nota média da semana</div>
        ${ant ? `<div style="margin-top:10px"><span class="pill ${r.nota >= ant.nota ? 'pill-folha' : 'pill-ambar'}">
          ${r.nota >= ant.nota ? '↑' : '↓'} ${Math.abs(r.nota - ant.nota)} pontos vs. semana passada</span></div>` : ''}
      </div>

      ${linha('Peso', r.pesoPerdido == null ? '—' : (r.pesoPerdido > 0 ? '−' : '+') + fmt.peso(Math.abs(r.pesoPerdido)),
              r.pesoPerdido, ant?.pesoPerdido, false)}
      ${linha('Refeições do plano', `${r.refeicoesFeitas}${r.refeicoesEsperadas ? ' de ' + r.refeicoesEsperadas : ''}`,
              r.refeicoesFeitas, ant?.refeicoesFeitas, false)}
      ${r.refeicoesPuladas ? linha('Refeições puladas', String(r.refeicoesPuladas), r.refeicoesPuladas, ant?.refeicoesPuladas, true) : ''}
      ${r.refeicoesIncompletas ? linha('Refeições incompletas', String(r.refeicoesIncompletas), r.refeicoesIncompletas, ant?.refeicoesIncompletas, true) : ''}
      ${r.refeicoesForaDoHorario ? linha('Fora do horário', `${r.refeicoesForaDoHorario} refeições`,
              r.refeicoesForaDoHorario, ant?.refeicoesForaDoHorario, true) : ''}
      ${r.horaSonoMedia ? linha('Foi dormir, em média', r.horaSonoMedia, null, null, false) : ''}
      ${(r.faltasComuns || []).length ? `<p style="font-size:13px;color:var(--tinta-dim);padding:10px 0 0;line-height:1.6">
        O que mais faltou no prato: ${esc(fmt.lista(r.faltasComuns.map(f => `${f.nome} (${f.vezes}×)`)))}.</p>` : ''}
      ${linha('Água', fmt.litros(r.aguaTotal), r.aguaTotal / 1000, ant ? ant.aguaTotal / 1000 : null, false)}
      ${linha('Dias que bateu a meta de água', `${r.diasMetaAgua} de ${r.diasNaSemana}`, r.diasMetaAgua, ant?.diasMetaAgua, false)}
      ${linha('Treinos', `${r.treinos}${perfil().metaSemanalExercicio ? ' de ' + perfil().metaSemanalExercicio : ''}`,
              r.treinos, ant?.treinos, false)}
      ${linha('Vitaminas', `${r.vitaminas}${r.vitaminasEsperadas ? ' de ' + r.vitaminasEsperadas : ''}`,
              r.vitaminas, ant?.vitaminas, false)}
      ${r.tiposTreino.length ? `<p style="font-size:13px;color:var(--tinta-dim);padding:12px 0 0">
        Você fez ${esc(fmt.lista(r.tiposTreino.map(t => t.toLowerCase())))}.</p>` : ''}

      <div class="sec" style="margin-top:24px"><h2 style="font-size:16px">O que foi bem</h2></div>
      ${pts.fortes.map(t => `<div style="display:flex;gap:9px;font-size:14px;line-height:1.6;color:var(--tinta-dim);padding:5px 0">
        <span style="color:var(--folha)">✓</span><span>${esc(t)}</span></div>`).join('')}

      <div class="sec" style="margin-top:18px"><h2 style="font-size:16px">Onde dá pra melhorar</h2></div>
      ${pts.fracos.map(t => `<div style="display:flex;gap:9px;font-size:14px;line-height:1.6;color:var(--tinta-dim);padding:5px 0">
        <span style="color:var(--ambar)">→</span><span>${esc(t)}</span></div>`).join('')}
    </div>
    <div class="sheet-pe"><button class="btn btn-cheio" onclick="fecharSheet()">Fechar</button></div>
  `);
}
