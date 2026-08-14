/* ══ FLORESCER — Diário ══════════════════════════════════════════
   Onde ela olha pra trás: o que comeu e o que treinou. Duas coisas
   diferentes, então o topo corta por ASSUNTO (alimentação x treino) e
   só depois por PERÍODO — treino no meio da lista de comida não achava
   quem procurava nem quem não procurava.

   Só consulta: registrar é sempre pela tela Hoje.
   ════════════════════════════════════════════════════════════════ */

let assuntoDiario = 'alimentacao';   // alimentacao | treino
let periodoComida = 'hoje';          // hoje | semana | mes | plano
let periodoTreino = 'semana';        // semana | mes | tudo

const PERIODOS_COMIDA = [['hoje', 'Hoje'], ['semana', 'Semana'], ['mes', 'Mês'], ['plano', 'Meu plano']];
const PERIODOS_TREINO = [['semana', 'Semana'], ['mes', 'Mês'], ['tudo', 'Tudo']];

RENDER.alimentacao = function () {
  const treino = assuntoDiario === 'treino';
  const periodos = treino ? PERIODOS_TREINO : PERIODOS_COMIDA;
  const atual = treino ? periodoTreino : periodoComida;

  document.getElementById('tela-alimentacao').innerHTML = `
    <header class="cabeca">
      <div class="cabeca-txt">
        <h1>Diário</h1>
        <div class="data">${esc(subtituloDiario())}</div>
      </div>
    </header>

    <div class="segmentado" role="tablist">
      <button class="seg ${treino ? '' : 'on'}" role="tab" aria-selected="${!treino}"
        onclick="verDiario('alimentacao')">Alimentação</button>
      <button class="seg ${treino ? 'on' : ''}" role="tab" aria-selected="${treino}"
        onclick="verDiario('treino')">Treino</button>
    </div>

    <div class="chips" style="margin-bottom:18px">
      ${periodos.map(([v, l]) =>
        `<button class="chip ${atual === v ? 'on' : ''}" onclick="verPeriodo('${v}')">${l}</button>`).join('')}
    </div>

    <div id="comida-corpo"></div>
  `;

  document.getElementById('comida-corpo').innerHTML = treino ? corpoTreinoHTML() : corpoComidaHTML();
};

function subtituloDiario() {
  if (assuntoDiario === 'treino') return 'o que você treinou';
  const d = dietaAtiva();
  return d ? d.nome : 'sem plano cadastrado';
}

function verDiario(a) { assuntoDiario = a; RENDER.alimentacao(); }
function verPeriodo(v) {
  if (assuntoDiario === 'treino') periodoTreino = v; else periodoComida = v;
  RENDER.alimentacao();
}

function corpoComidaHTML() {
  if (periodoComida === 'hoje')  return comidaHojeHTML();
  if (periodoComida === 'plano') return comidaPlanoHTML();
  return comidaHistoricoHTML(periodoComida);
}

function corpoTreinoHTML() { return treinoHistoricoHTML(periodoTreino); }

/** Recorte de período, igual pros dois assuntos: semana = a semana corrente
 *  (seg→sáb, a mesma do relatório), mês = o mês do calendário. */
function dentroDoPeriodo(data, periodo) {
  if (periodo === 'semana') return data >= inicioSemana(hoje());
  if (periodo === 'mes')    return data.startsWith(hoje().slice(0, 7));
  return true;
}

const ROTULO_PERIODO = { semana: 'nesta semana', mes: 'neste mês', tudo: 'desde o início' };

/** O registro guarda nome e medida de cada item, então o histórico continua
 *  legível mesmo depois de a nutricionista trocar o plano inteiro. */
function itensEscolhidos(log) {
  const dieta = (DB.get('dietas') || []).find(d => d.id === log.dietaId);
  const ref = dieta && dieta.refeicoes.find(r => r.id === log.refeicaoId);
  const itens = [];

  (log.escolhas || []).forEach(e => {
    const g = ref && ref.grupos.find(x => x.id === e.grupoId);
    const lista = e.itens || (e.opcaoIds || []).map(id => ({ opcaoId: id }));   // formato antigo
    lista.forEach(it => {
      const o = g && g.opcoes.find(x => x.id === it.opcaoId);
      itens.push({
        nome: it.nome || (o ? o.nome : '—'),
        medida: it.medida || (o ? o.medida : null),
      });
    });
  });
  return itens;
}

/** "Patinho 150 g, arroz 50 g e alface" — usado onde cabe só uma linha. */
function escolhasTexto(log) {
  return fmt.lista(itensEscolhidos(log).map(it => {
    const m = medidaTexto(it.medida);
    return m && it.medida && it.medida.valor != null ? `${it.nome} ${m}` : it.nome;
  }));
}

const itemTexto = it => {
  const m = medidaTexto(it.medida);
  return m && it.medida && it.medida.valor != null ? `${it.nome} ${m}` : it.nome;
};

/** Uma linha por grupo, em vez de uma frase corrida com dez alimentos. */
function escolhasPorGrupo(log) {
  const dieta = (DB.get('dietas') || []).find(d => d.id === log.dietaId);
  const ref = dieta && dieta.refeicoes.find(r => r.id === log.refeicaoId);

  return (log.escolhas || []).map(e => {
    const g = ref && ref.grupos.find(x => x.id === e.grupoId);
    const lista = e.itens || (e.opcaoIds || []).map(id => ({ opcaoId: id }));
    const itens = lista.map(it => {
      const o = g && g.opcoes.find(x => x.id === it.opcaoId);
      return itemTexto({ nome: it.nome || (o ? o.nome : '—'), medida: it.medida || (o ? o.medida : null) });
    });
    return { grupo: e.grupoNome || (g ? g.nome : ''), itens };
  }).filter(l => l.itens.length);
}

function linhasEscolhaHTML(log) {
  const linhas = escolhasPorGrupo(log);
  if (!linhas.length) return '';
  return `<div class="escolhas">
    ${linhas.map(l => `
      <div class="escolha-linha">
        <span class="escolha-grupo">${esc(l.grupo)}</span>
        <span class="escolha-itens">${esc(l.itens.join(' · '))}</span>
      </div>`).join('')}
  </div>`;
}

function nomeRefeicao(log) {
  if (log.refeicaoNome) return log.refeicaoNome;
  const dieta = (DB.get('dietas') || []).find(d => d.id === log.dietaId);
  const ref = dieta && dieta.refeicoes.find(r => r.id === log.refeicaoId);
  return ref ? ref.nome : 'Refeição';
}

// ── Hoje ─────────────────────────────────────────────────────────
function comidaHojeHTML() {
  const dieta = dietaAtiva();
  if (!dieta) return `<div class="vazio"><span class="flor">🌱</span>Cadastre o plano alimentar em Ajustes.</div>`;

  const logs = (DB.get('logRefeicoes') || []).filter(l => l.data === hoje());
  const extras = logs.filter(l => l.extra);

  return `<div class="cartao">
    ${refeicoesAtivas(dieta).map(r => {
      const l = logs.find(x => x.refeicaoId === r.id);
      const feita = l && l.status === 'feita';
      const marca = !l ? `<span class="pill">a fazer</span>`
        : l.status === 'pulada' ? `<span class="pill">pulada</span>`
        : l.completa === false ? `<span class="pill pill-ambar">incompleta</span>`
        : `<span class="pill pill-folha">${esc(l.hora)}</span>`;

      return `<div class="refeicao-dia ${feita ? 'feita' : ''}">
        <div class="refeicao-topo">
          <span class="refeicao-nome">${esc(r.nome)}</span>
          ${marca}
        </div>
        ${feita
          ? linhasEscolhaHTML(l) + (l.completa === false && (l.faltou || []).length
              ? `<div class="escolha-falta">faltou ${esc(fmt.lista(l.faltou))}</div>` : '')
          : `<div class="refeicao-pede">${esc(l ? 'Não foi feita.' : resumoRefeicao(r))}</div>`}
      </div>`;
    }).join('')}
    ${extras.map(l => `<div class="refeicao-dia feita">
        <div class="refeicao-topo">
          <span class="refeicao-nome">${esc(l.refeicaoNome)}</span>
          <span class="pill pill-folha">${esc(l.hora)}</span>
        </div>
        ${linhasEscolhaHTML(l)}
      </div>`).join('')}
  </div>
  <p style="text-align:center;font-size:12.5px;color:var(--tinta-fraca);margin-top:16px">
    Para registrar, use a tela Hoje.</p>`;
}

// ── Histórico ────────────────────────────────────────────────────
function comidaHistoricoHTML(periodo = 'mes') {
  const logs = (DB.get('logRefeicoes') || []).filter(l => dentroDoPeriodo(l.data, periodo));
  const dias = [...new Set(logs.map(l => l.data))].sort().reverse().slice(0, 60);
  if (!dias.length) {
    return `<div class="vazio"><span class="flor">🍽</span>Nenhuma refeição registrada ${esc(ROTULO_PERIODO[periodo] || '')}.</div>`;
  }

  const dieta = dietaAtiva();
  const totalRefs = refeicoesAtivas(dieta).length;

  return dias.map(d => {
    const doDia = logs.filter(l => l.data === d);
    // A conta do dia é sobre o plano; refeição extra é bônus e não infla o placar.
    const feitas = doDia.filter(l => l.status === 'feita' && !l.extra);
    const extras = doDia.filter(l => l.extra).length;
    return `
      <div class="cartao" style="padding:16px 18px">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px">
          <span style="font-weight:600;font-size:14.5px">${esc(fmt.maiuscula(fmt.longa(d)))}</span>
          <span class="li-fim" style="margin-left:auto">${feitas.length}${totalRefs ? '/' + totalRefs : ''}${
            extras ? ` +${extras}` : ''} · ${notaDe(d)}%</span>
        </div>
        ${doDia.sort((a, b) => a.hora.localeCompare(b.hora)).map(l => `
          <div class="refeicao-dia ${l.status === 'feita' ? 'feita' : ''}">
            <div class="refeicao-topo">
              <span class="refeicao-nome">${esc(nomeRefeicao(l))}</span>
              <span class="li-fim num">${esc(l.hora)}</span>
            </div>
            ${l.status === 'pulada'
              ? `<div class="refeicao-pede">Não foi feita.</div>`
              : linhasEscolhaHTML(l) + (l.completa === false && (l.faltou || []).length
                  ? `<div class="escolha-falta">faltou ${esc(fmt.lista(l.faltou))}</div>` : '')}
          </div>`).join('')}
      </div>`;
  }).join('');
}

// ── Plano ativo ──────────────────────────────────────────────────
function comidaPlanoHTML() {
  const dieta = dietaAtiva();
  if (!dieta) return `<div class="vazio"><span class="flor">🌱</span>Nenhum plano ativo.</div>`;
  const pausadas = dieta.refeicoes.filter(r => r.pausada);

  const cardRefeicao = r => `
      <div class="cartao">
        <h3 style="font-family:var(--display);font-variation-settings:'SOFT' 100,'WONK' 1,'opsz' 30;font-weight:500;font-size:17px;margin-bottom:12px">${esc(r.nome)}</h3>
        ${r.grupos.map(g => `
          <div style="margin-bottom:13px">
            <div class="grupo-topo" style="margin-bottom:7px">
              <span class="rotulo" style="color:var(--tinta-dim)">${esc(g.nome)}</span>
              <span class="grupo-cont num">${(g.min != null ? g.min : g.qtd) > 1
                ? `pelo menos ${g.min != null ? g.min : g.qtd}` : 'escolher 1 ou mais'}</span>
            </div>
            <div style="font-size:14px;color:var(--tinta-dim);line-height:1.6">${esc(g.opcoes.map(o => o.nome).join(' · ')) || '—'}</div>
          </div>`).join('') || '<div style="color:var(--tinta-fraca);font-size:13.5px">sem grupos</div>'}
      </div>`;

  return `
    ${dieta.obs ? `<p style="font-size:13.5px;color:var(--tinta-dim);line-height:1.6;margin-bottom:16px">${esc(dieta.obs)}</p>` : ''}
    ${refeicoesAtivas(dieta).map(cardRefeicao).join('')}
    ${pausadas.length ? `
      <div class="sec"><h2 style="font-size:15px">Em pausa</h2><span class="sub">liberadas pela nutricionista</span></div>
      ${pausadas.map(r => `<div style="opacity:.55">${cardRefeicao(r)}</div>`).join('')}` : ''}
    <p style="text-align:center;font-size:12.5px;color:var(--tinta-fraca);margin-top:16px">
      Para mudar o plano, vá em Ajustes.</p>`;
}

// ── Treino ───────────────────────────────────────────────────────
function treinoHistoricoHTML(periodo = 'semana') {
  const todos = (DB.get('logExercicios') || []).slice().sort((a, b) =>
    b.data.localeCompare(a.data) || (b.hora || '').localeCompare(a.hora || ''));
  const logs = todos.filter(l => dentroDoPeriodo(l.data, periodo));

  if (!logs.length) {
    return `<div class="vazio"><span class="flor">💪</span>Nenhuma atividade registrada ${esc(ROTULO_PERIODO[periodo])}.
      <br><span style="font-size:12.5px">Registre pela tela Hoje, no item Exercício.</span></div>`;
  }

  const dias = new Set(logs.map(l => l.data));
  const minutos = logs.reduce((s, l) => s + (l.duracao || 0), 0);
  const km = logs.reduce((s, l) => s + (l.distancia || 0), 0);
  const meta = perfil().metaSemanalExercicio || 0;

  const num = (v, k) => `<div class="treino-num"><div class="v">${esc(String(v))}</div><div class="k">${esc(k)}</div></div>`;

  return `
    <div class="cartao">
      <div class="treino-nums">
        ${num(logs.length, logs.length === 1 ? 'atividade' : 'atividades')}
        ${num(dias.size, dias.size === 1 ? 'dia treinado' : 'dias treinados')}
        ${minutos ? num(fmt.duracao(minutos), 'no total') : ''}
        ${km ? num(fmt.km(km), 'percorridos') : ''}
      </div>
      ${periodo === 'semana' && meta ? `<div class="peso-hero-meta" style="margin-top:14px">
        Meta da semana: <strong>${dias.size} de ${meta}</strong> ${meta === 1 ? 'dia' : 'dias'}.</div>` : ''}
    </div>

    ${rankingTreinoHTML(logs)}

    ${periodo === 'tudo' && typeof heatmapTreinos === 'function'
      ? `<div class="sec"><h2>Constância</h2><span class="sub">últimas 12 semanas</span></div>
         <div class="cartao">${heatmapTreinos()}</div>` : ''}

    <div class="sec"><h2>Cada atividade</h2></div>
    ${[...new Set(logs.map(l => l.data))].map(d => `
      <div class="cartao" style="padding:16px 18px">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px">
          <span style="font-weight:600;font-size:14.5px">${esc(fmt.maiuscula(fmt.longa(d)))}</span>
          <span class="li-fim" style="margin-left:auto">${esc(fmt.duracao(
            logs.filter(l => l.data === d).reduce((s, l) => s + (l.duracao || 0), 0)))}</span>
        </div>
        ${logs.filter(l => l.data === d).map(l => `
          <div class="refeicao-dia feita">
            <div class="refeicao-topo">
              <span class="refeicao-nome">${esc(l.tipo)}</span>
              <span class="li-fim num">${esc(l.hora || '')}</span>
            </div>
            <div class="refeicao-pede">${esc([fmt.duracao(l.duracao), fmt.km(l.distancia)].filter(Boolean).join(' · ')) || '—'}</div>
          </div>`).join('')}
      </div>`).join('')}`;
}

/** O que ela mais fez no período. Barra proporcional ao tipo campeão — é a
 *  pergunta que ela faz olhando pra trás ("tenho caminhado ou só academia?"). */
function rankingTreinoHTML(logs) {
  const porTipo = {};
  logs.forEach(l => {
    const t = porTipo[l.tipo] || (porTipo[l.tipo] = { vezes: 0, minutos: 0, km: 0 });
    t.vezes++;
    t.minutos += l.duracao || 0;
    t.km += l.distancia || 0;
  });
  const lista = Object.entries(porTipo).sort((a, b) => b[1].vezes - a[1].vezes || b[1].minutos - a[1].minutos);
  if (lista.length < 2) return '';

  const topo = lista[0][1].vezes;
  return `
    <div class="sec"><h2>O que você mais fez</h2></div>
    <div class="cartao">
      ${lista.map(([tipo, t]) => `
        <div class="rank-linha">
          <div class="rank-topo">
            <span class="rank-nome">${esc(tipo)}</span>
            <span class="rank-cont">${t.vezes}×${t.minutos ? ' · ' + esc(fmt.duracao(t.minutos)) : ''}${
              t.km ? ' · ' + esc(fmt.km(t.km)) : ''}</span>
          </div>
          <div class="rank-barra"><i style="width:${(t.vezes / topo * 100).toFixed(1)}%"></i></div>
        </div>`).join('')}
    </div>`;
}
