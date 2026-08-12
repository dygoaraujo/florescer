/* ══ FLORESCER — Alimentação ═════════════════════════════════════
   Só consulta: o que ela comeu hoje, o histórico e o plano ativo.
   Registrar é sempre pela tela Hoje — por isso nada aqui salva nada.
   ════════════════════════════════════════════════════════════════ */

let vistaComida = 'hoje';   // hoje | historico | plano

RENDER.alimentacao = function () {
  const dieta = dietaAtiva();

  document.getElementById('tela-alimentacao').innerHTML = `
    <header class="cabeca">
      <div class="cabeca-txt">
        <h1>Alimentação</h1>
        <div class="data">${esc(dieta ? dieta.nome : 'sem plano cadastrado')}</div>
      </div>
    </header>

    <div class="chips" style="margin-bottom:18px">
      ${[['hoje', 'Hoje'], ['historico', 'Histórico'], ['plano', 'Meu plano']].map(([v, l]) =>
        `<button class="chip ${vistaComida === v ? 'on' : ''}" onclick="verComida('${v}')">${l}</button>`).join('')}
    </div>

    <div id="comida-corpo"></div>
  `;

  const cx = document.getElementById('comida-corpo');
  cx.innerHTML = vistaComida === 'hoje'      ? comidaHojeHTML()
               : vistaComida === 'historico' ? comidaHistoricoHTML()
               :                               comidaPlanoHTML();
};

function verComida(v) { vistaComida = v; RENDER.alimentacao(); }

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

  return `<div class="cartao">
    ${dieta.refeicoes.map(r => {
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
  </div>
  <p style="text-align:center;font-size:12.5px;color:var(--tinta-fraca);margin-top:16px">
    Para registrar, use a tela Hoje.</p>`;
}

// ── Histórico ────────────────────────────────────────────────────
function comidaHistoricoHTML() {
  const logs = DB.get('logRefeicoes') || [];
  const dias = [...new Set(logs.map(l => l.data))].sort().reverse().slice(0, 60);
  if (!dias.length) return `<div class="vazio"><span class="flor">🍽</span>Ainda não há refeições registradas.</div>`;

  const dieta = dietaAtiva();
  const totalRefs = dieta ? dieta.refeicoes.length : 0;

  return dias.map(d => {
    const doDia = logs.filter(l => l.data === d);
    const feitas = doDia.filter(l => l.status === 'feita');
    return `
      <div class="cartao" style="padding:16px 18px">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:10px">
          <span style="font-weight:600;font-size:14.5px">${esc(fmt.maiuscula(fmt.longa(d)))}</span>
          <span class="li-fim" style="margin-left:auto">${feitas.length}${totalRefs ? '/' + totalRefs : ''} · ${notaDe(d)}%</span>
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

  return `
    ${dieta.obs ? `<p style="font-size:13.5px;color:var(--tinta-dim);line-height:1.6;margin-bottom:16px">${esc(dieta.obs)}</p>` : ''}
    ${dieta.refeicoes.map(r => `
      <div class="cartao">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:12px">
          <h3 style="font-family:var(--display);font-variation-settings:'SOFT' 100,'WONK' 1,'opsz' 30;font-weight:500;font-size:17px">${esc(r.nome)}</h3>
          <span class="li-fim" style="margin-left:auto">${esc(r.hora)}</span>
        </div>
        ${r.grupos.map(g => `
          <div style="margin-bottom:13px">
            <div class="grupo-topo" style="margin-bottom:7px">
              <span class="rotulo" style="color:var(--tinta-dim)">${esc(g.nome)}</span>
              <span class="grupo-cont num">escolher ${g.qtd}</span>
            </div>
            <div style="font-size:14px;color:var(--tinta-dim);line-height:1.6">${esc(g.opcoes.map(o => o.nome).join(' · ')) || '—'}</div>
          </div>`).join('') || '<div style="color:var(--tinta-fraca);font-size:13.5px">sem grupos</div>'}
      </div>`).join('')}
    <p style="text-align:center;font-size:12.5px;color:var(--tinta-fraca);margin-top:16px">
      Para mudar o plano, vá em Ajustes.</p>`;
}
