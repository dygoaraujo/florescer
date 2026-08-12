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
        <div class="data">${esc(dieta ? dieta.nome.toLowerCase() : 'sem plano cadastrado')}</div>
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

/** Nomes dos alimentos escolhidos num log, mesmo se a dieta mudou depois. */
function escolhasTexto(log) {
  const dieta = (DB.get('dietas') || []).find(d => d.id === log.dietaId);
  const ref = dieta && dieta.refeicoes.find(r => r.id === log.refeicaoId);
  if (!ref) return '';
  const nomes = [];
  (log.escolhas || []).forEach(e => {
    const g = ref.grupos.find(x => x.id === e.grupoId);
    if (!g) return;
    e.opcaoIds.forEach(oid => {
      const o = g.opcoes.find(x => x.id === oid);
      if (o) nomes.push(o.nome);
    });
  });
  return fmt.lista(nomes);
}

function nomeRefeicao(log) {
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
      const pediu = r.grupos.map(g => `${g.qtd} ${g.nome.toLowerCase()}`).join(' · ');
      let sub, marca;
      if (!l)                       { sub = pediu;               marca = `<span class="pill">a fazer</span>`; }
      else if (l.status === 'pulada') { sub = 'não foi feita';    marca = `<span class="pill">pulada</span>`; }
      else                          { sub = escolhasTexto(l) || pediu; marca = `<span class="pill pill-folha">${esc(l.hora)}</span>`; }
      return `<div class="lista-item">
        <span class="li-txt">
          <span class="li-nome">${esc(r.nome)}</span>
          <span class="li-sub">${esc(sub)}</span>
        </span>
        ${marca}
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
          <div style="display:flex;gap:9px;padding:6px 0;font-size:13.5px;line-height:1.5">
            <span class="num" style="color:var(--tinta-fraca);flex-shrink:0;width:36px">${esc(l.hora)}</span>
            <span style="flex:1;min-width:0">
              <strong style="font-weight:600">${esc(nomeRefeicao(l))}</strong>
              ${l.status === 'pulada'
                ? ' <span style="color:var(--tinta-fraca)">— pulada</span>'
                : `<br><span style="color:var(--tinta-dim)">${esc(escolhasTexto(l))}</span>`}
            </span>
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
