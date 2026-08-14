/* ══ FLORESCER — Ajustes ═════════════════════════════════════════
   Configuração: plano alimentar, medicamentos, metas, sync, backup.
   Só UMA dieta ativa. Trocar de plano cria uma NOVA versão e arquiva a
   antiga — nunca apaga, porque cada log guarda o dietaId da época.
   ════════════════════════════════════════════════════════════════ */

RENDER.ajustes = function () {
  const p = perfil();
  const dieta = dietaAtiva();
  const dietas = DB.get('dietas') || [];
  const arquivadas = dietas.filter(d => !d.ativa);
  const meds = DB.get('medicamentos') || [];
  const tipos = DB.get('exercicios') || [];

  document.getElementById('tela-ajustes').innerHTML = `
    <header class="cabeca">
      <div class="cabeca-txt">
        <h1>Ajustes</h1>
        <div class="data">o plano por trás do dia</div>
      </div>
    </header>

    <div class="sec"><h2>Plano alimentar</h2>
      <span class="sub">${dieta ? esc(dieta.nome) : 'nenhum'}</span></div>
    <div class="cartao">
      ${dieta ? dieta.refeicoes.map(r => `
        <button class="lista-item" onclick="editarRefeicao('${esc(r.id)}')">
          <span class="li-txt">
            <span class="li-nome">${esc(r.nome)}${r.pausada ? ' <span class="pill">pausada</span>' : ''}</span>
            <span class="li-sub">${esc(r.grupos.map(g => g.nome).join(' · ')) || 'sem grupos'}</span>
          </span>
          <span style="color:var(--tinta-fraca)">${IC.seta}</span>
        </button>`).join('') : '<div class="vazio">Nenhum plano cadastrado.</div>'}
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-vazio btn-sm" onclick="novaRefeicao()">${IC.mais} Refeição</button>
        <button class="btn btn-vazio btn-sm" onclick="novaVersaoDieta()">Nova versão do plano</button>
        <button class="btn btn-vazio btn-sm" onclick="recarregarPlanoDaClinica()">Recarregar plano da clínica</button>
      </div>
    </div>
    ${arquivadas.length ? `
      <div class="cartao">
        <div class="rotulo" style="margin-bottom:10px">Versões anteriores</div>
        ${arquivadas.map(d => `
          <div class="lista-item">
            <span class="li-txt">
              <span class="li-nome">${esc(d.nome)}</span>
              <span class="li-sub">criado em ${esc(fmt.data(d.criadaEm))}</span>
            </span>
            <button class="btn btn-suave btn-sm" onclick="ativarDieta('${esc(d.id)}')">Reativar</button>
          </div>`).join('')}
      </div>` : ''}

    <div class="sec"><h2>Medicamentos e vitaminas</h2></div>
    <div class="cartao">
      ${meds.length ? meds.map(m => `
        <button class="lista-item" onclick="editarMedicamento('${esc(m.id)}')">
          <span class="med-ic ${m.forma === 'gotas' ? 'gotas' : ''}">${m.forma === 'gotas' ? IC.gota : IC.capsula}</span>
          <span class="li-txt">
            <span class="li-nome">${esc(m.nome)}${m.ativo ? '' : ' <span class="pill">pausado</span>'}</span>
            <span class="li-sub">${esc([m.dose, freqTexto(m)].filter(Boolean).join(' · '))}</span>
          </span>
          <span style="color:var(--tinta-fraca)">${IC.seta}</span>
        </button>`).join('') : '<div class="vazio">Nada cadastrado ainda.</div>'}
      <button class="btn btn-vazio btn-sm" style="margin-top:14px" onclick="editarMedicamento()">${IC.mais} Medicamento</button>
    </div>

    <div class="sec"><h2>Metas do dia</h2></div>
    <div class="cartao">
      <div class="campo-dupla">
        <div class="campo">
          <label for="aj-agua">Água — meta (ml)</label>
          <input id="aj-agua" type="number" inputmode="numeric" step="100" min="500" max="8000"
                 value="${p.metaAgua}" onchange="salvarPerfil('metaAgua', Number(this.value))">
        </div>
        <div class="campo">
          <label for="aj-agua2">Água — ideal (ml)</label>
          <input id="aj-agua2" type="number" inputmode="numeric" step="100" min="500" max="8000"
                 value="${p.metaAguaIdeal ?? ''}" placeholder="opcional"
                 onchange="salvarPerfil('metaAguaIdeal', this.value === '' ? null : Number(this.value))">
        </div>
      </div>
      <div class="campo">
        <label>Dias de exercício</label>
        <div class="toggles toggles-semana">
          ${DIAS_LETRA.map((l, k) => `
            <button class="toggle ${(p.diasExercicio || []).includes(k) ? 'on' : ''}"
              onclick="alternarDiaExercicio(${k})" aria-label="${DIAS_CURTOS[k]}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="campo">
        <label for="aj-mex">Meta de treinos na semana</label>
        <input id="aj-mex" type="number" inputmode="numeric" min="0" max="7" value="${p.metaSemanalExercicio}"
               onchange="salvarPerfil('metaSemanalExercicio', Number(this.value))">
      </div>
      <div class="campo">
        <label>Tipos de treino</label>
        <div class="chips">
          ${tipos.map(t => `<button class="chip" onclick="removerTipoExercicio('${esc(t)}')">${esc(t)} ✕</button>`).join('')}
          <button class="chip" onclick="novoTipoExercicio()" style="color:var(--tinta-dim)">${IC.mais}</button>
        </div>
      </div>
      <div class="campo" style="margin-bottom:0">
        <label>Registrar o sono</label>
        <div class="toggles">
          <button class="toggle ${p.registrarSono ? 'on' : ''}" onclick="salvarPerfil('registrarSono', ${!p.registrarSono})">
            ${p.registrarSono ? 'Sim' : 'Não'}</button>
        </div>
      </div>
    </div>

    <div class="sec"><h2>Lembretes</h2></div>
    <div class="cartao">
      <p style="font-size:13px;color:var(--tinta-dim);line-height:1.6;margin-bottom:14px">
        O iPhone não deixa um app como este tocar alarme na hora marcada. O jeito
        que funciona de verdade é cadastrar os horários no app <strong style="color:var(--tinta)">Relógio</strong>.
        O botão abaixo copia a lista pronta.</p>
      <button class="btn btn-vazio btn-sm" onclick="copiarHorarios()">Copiar horários do dia</button>
      <div id="lista-horarios"></div>
    </div>

    <div class="sec"><h2>Perfil</h2></div>
    <div class="cartao">
      <div class="campo">
        <label for="aj-nome">Nome</label>
        <input id="aj-nome" type="text" value="${esc(p.nome || '')}" onchange="salvarPerfil('nome', this.value)">
      </div>
      <div class="campo-dupla">
        <div class="campo">
          <label for="aj-pi">Peso inicial</label>
          <input id="aj-pi" type="number" inputmode="decimal" step="0.1" placeholder="kg"
                 value="${p.pesoInicial ?? ''}" onchange="salvarPerfil('pesoInicial', this.value === '' ? null : Number(this.value))">
        </div>
        <div class="campo">
          <label for="aj-pm">Peso desejado</label>
          <input id="aj-pm" type="number" inputmode="decimal" step="0.1" placeholder="kg"
                 value="${p.pesoMeta ?? ''}" onchange="salvarPerfil('pesoMeta', this.value === '' ? null : Number(this.value))">
        </div>
      </div>
      <div class="campo" style="margin-bottom:0">
        <label for="aj-ini">Início do tratamento</label>
        <input id="aj-ini" type="date" value="${esc(p.inicioTratamento || hoje())}"
               onchange="salvarPerfil('inicioTratamento', this.value)">
      </div>
    </div>

    <div class="sec"><h2>Seus dados</h2></div>
    <div id="sync-ui"></div>
    <div class="cartao">
      <div class="rotulo" style="margin-bottom:4px">Backup no aparelho</div>
      <p style="font-size:13px;color:var(--tinta-dim);line-height:1.55;margin-bottom:14px">
        Baixa um arquivo com tudo. Guarde de vez em quando — é a rede de segurança se o celular limpar o app.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-vazio btn-sm" onclick="baixarBackup()">Baixar backup</button>
        <button class="btn btn-vazio btn-sm" onclick="document.getElementById('arq-import').click()">Restaurar backup</button>
        <input type="file" id="arq-import" accept="application/json" style="display:none" onchange="restaurarBackup(this)">
      </div>
      <button class="link-fraco" style="margin-top:6px" onclick="apagarTudo()">Apagar todos os dados</button>
    </div>

    <p style="text-align:center;font-size:11.5px;color:var(--tinta-fraca);margin-top:26px">
      Florescer · feito com carinho</p>
  `;

  if (typeof renderSyncUI === 'function') renderSyncUI();
};

function freqTexto(m) {
  if (m.frequencia === 'diaria') return 'todo dia';
  if (!m.dias || !m.dias.length) return 'sem dia definido';
  return (m.dias.length === 7 ? 'todo dia' : m.dias.map(d => DIAS_CURTOS[d]).join(', '));
}

function salvarPerfil(campo, valor) {
  const p = perfil();
  p[campo] = valor;
  DB.set('perfil', p);
  toast('Salvo');
  if (campo === 'metaAgua' || campo === 'diasExercicio' || campo === 'horaExercicio') RENDER.ajustes();
}

function alternarDiaExercicio(d) {
  const p = perfil();
  const dias = p.diasExercicio || [];
  const i = dias.indexOf(d);
  if (i >= 0) dias.splice(i, 1); else dias.push(d);
  dias.sort();
  p.diasExercicio = dias;
  DB.set('perfil', p);
  RENDER.ajustes();
}

function novoTipoExercicio() {
  abrirSheet(campoUnicoHTML('Novo tipo de treino', 'Ex.: Natação', ''), null);
  document.getElementById('cu-form').onsubmit = e => {
    e.preventDefault();
    const v = document.getElementById('cu-input').value.trim();
    if (!v) return;
    const t = DB.get('exercicios') || [];
    if (!t.includes(v)) { t.push(v); DB.set('exercicios', t); }
    fecharSheet(); RENDER.ajustes();
  };
}

function removerTipoExercicio(t) {
  confirmar('Tirar tipo de treino', `"${t}" sai da lista. Os treinos já registrados continuam.`, 'Tirar', () => {
    DB.set('exercicios', (DB.get('exercicios') || []).filter(x => x !== t));
    RENDER.ajustes();
  });
}

/** Sheet genérico de um campo só. */
function campoUnicoHTML(titulo, placeholder, valor) {
  return `
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div><h2>${esc(titulo)}</h2></div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <form id="cu-form">
      <div class="sheet-corpo">
        <div class="campo">
          <input id="cu-input" type="text" placeholder="${esc(placeholder)}" value="${esc(valor)}" autocomplete="off">
        </div>
      </div>
      <div class="sheet-pe"><button class="btn btn-cheio" type="submit">Salvar</button></div>
    </form>`;
}

// ══ EDITOR DE REFEIÇÃO ═════════════════════════════════════════
// Edições valem na hora (sem botão salvar) — menos passos, menos erro.

let edRefId = null;

function novaRefeicao() {
  const d = dietaAtiva();
  if (!d) return;
  const r = { id: uid(), nome: 'Nova refeição', hora: '12:00', grupos: [] };
  d.refeicoes.push(r);
  salvarDietaAtiva(d);
  editarRefeicao(r.id);
}

function editarRefeicao(refId) {
  edRefId = refId;
  abrirSheet('<div class="sheet-alca"></div><div id="ed-ref"></div>', () => RENDER.ajustes());
  renderEditorRefeicao();
}

function refEditando() {
  const d = dietaAtiva();
  return d ? d.refeicoes.find(r => r.id === edRefId) : null;
}

function salvarDietaAtiva(dieta) {
  const dietas = (DB.get('dietas') || []).map(d => (d.id === dieta.id ? dieta : d));
  DB.set('dietas', dietas);
}

/** DB.get devolve uma cópia nova a cada chamada — então a refeição PRECISA vir
 *  da mesma cópia da dieta que vai ser salva. Este helper garante isso. */
function mexerNaRefeicao(fn, opts = {}) {
  const dieta = dietaAtiva();
  if (!dieta) return;
  const r = dieta.refeicoes.find(x => x.id === edRefId);
  if (!r) return;
  if (fn(r, dieta) === false) return;
  salvarDietaAtiva(dieta);
  if (!opts.semRender) renderEditorRefeicao();
}

function renderEditorRefeicao() {
  const r = refEditando();
  const cx = document.getElementById('ed-ref');
  if (!r || !cx) return;

  cx.innerHTML = `
    <div class="sheet-cabeca">
      <div style="flex:1;min-width:0">
        <h2>Refeição</h2>
        <div class="dica">As mudanças já ficam salvas.</div>
      </div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <div class="sheet-corpo">
      <div class="campo-dupla">
        <div class="campo">
          <label for="er-nome">Nome</label>
          <input id="er-nome" type="text" value="${esc(r.nome)}" onchange="campoRefeicao('nome', this.value)">
        </div>
        <div class="campo">
          <label for="er-hora">Ordem no dia</label>
          <input id="er-hora" type="time" value="${esc(r.hora)}" onchange="campoRefeicao('hora', this.value)">
        </div>
      </div>
      <p style="font-size:12px;color:var(--tinta-fraca);line-height:1.5;margin:-6px 0 14px">
        Só define a posição dela no dia — ela nunca vê esse horário. O que aparece pra ela
        é a hora real que confirmar a refeição.</p>

      <div class="campo">
        <button class="btn btn-vazio btn-sm" onclick="alternarPausaRefeicao()">
          ${r.pausada ? 'Reativar esta refeição' : 'Pausar esta refeição'}
        </button>
        ${r.pausada ? '<p style="font-size:12px;color:var(--tinta-fraca);margin-top:6px">Fica fora do dia a dia dela, mas continua aqui pra reativar quando quiser.</p>' : ''}
      </div>

      ${r.grupos.map((g, gi) => `
        <div class="cartao" style="background:var(--bruma);box-shadow:none;padding:16px;margin-top:12px">
          <div class="campo-dupla">
            <div class="campo">
              <label>Grupo</label>
              <input type="text" value="${esc(g.nome)}" onchange="campoGrupo(${gi},'nome',this.value)">
            </div>
            <div class="campo">
              <label>Quantidade</label>
              <input type="number" inputmode="numeric" min="1" max="9" value="${g.qtd}"
                     onchange="campoGrupo(${gi},'qtd',Math.max(1,Number(this.value)||1))">
            </div>
          </div>
          <div class="campo" style="margin-bottom:10px">
            <label>Opções que ela pode escolher</label>
            <div class="chips" style="margin-bottom:9px">
              ${g.opcoes.map((o, oi) => `<button class="chip" onclick="removerOpcao(${gi},${oi})">${esc(o.nome)} ✕</button>`).join('')}
              ${g.opcoes.length ? '' : '<span style="font-size:13px;color:var(--tinta-fraca)">nenhuma ainda</span>'}
            </div>
            <form onsubmit="return novaOpcao(event, ${gi})">
              <input type="text" placeholder="Escreva e aperte enter" autocomplete="off"
                     style="min-height:44px;font-size:14.5px">
            </form>
          </div>
          <button class="link-fraco" style="padding:6px" onclick="removerGrupo(${gi})">Remover grupo</button>
        </div>`).join('')}

      <button class="btn btn-vazio btn-sm" style="width:100%;margin-top:14px" onclick="novoGrupo()">${IC.mais} Grupo alimentar</button>
      <button class="link-fraco" onclick="removerRefeicao()">Remover esta refeição do plano</button>
    </div>
    <div class="sheet-pe"><button class="btn btn-cheio" onclick="fecharSheet()">Concluído</button></div>`;
}

function campoRefeicao(campo, valor) {
  mexerNaRefeicao(r => { r[campo] = valor; }, { semRender: true });
}

function alternarPausaRefeicao() {
  mexerNaRefeicao(r => { r.pausada = !r.pausada; });
}

function campoGrupo(gi, campo, valor) {
  mexerNaRefeicao(r => {
    if (!r.grupos[gi]) return false;
    r.grupos[gi][campo] = valor;
    if (campo === 'qtd') r.grupos[gi].selecao = valor > 1 ? 'multipla' : 'unica';
  });
}

function novoGrupo() {
  mexerNaRefeicao(r => {
    r.grupos.push({ id: uid(), nome: 'Novo grupo', qtd: 1, selecao: 'unica', opcoes: [] });
  });
}

function removerGrupo(gi) {
  const r0 = refEditando();
  if (!r0 || !r0.grupos[gi]) return;
  confirmar('Remover grupo', `"${r0.grupos[gi].nome}" sai desta refeição. O histórico já registrado continua intacto.`, 'Remover',
    () => mexerNaRefeicao(r => { r.grupos.splice(gi, 1); }), { duplo: true, perigo: true });
}

/** Enter no campo inline adiciona a opção e mantém o foco pra digitar a próxima. */
function novaOpcao(e, gi) {
  e.preventDefault();
  const v = e.target.querySelector('input').value.trim();
  if (!v) return false;
  mexerNaRefeicao(r => {
    if (!r.grupos[gi]) return false;
    r.grupos[gi].opcoes.push({ id: uid(), nome: v });
  });
  const campo = document.querySelectorAll('#ed-ref form input')[gi];
  if (campo) campo.focus();
  return false;
}

// Tirar UM alimento da lista é reversível e acontece o tempo todo enquanto se
// monta o plano — confirmação simples. O que apaga estrutura (grupo, refeição,
// medicamento, plano inteiro) é que pede dois toques.
function removerOpcao(gi, oi) {
  const r0 = refEditando();
  const o = r0 && r0.grupos[gi] && r0.grupos[gi].opcoes[oi];
  if (!o) return;
  confirmar('Tirar do plano', `"${o.nome}" sai das opções deste grupo.`, 'Tirar',
    () => mexerNaRefeicao(r => { if (r.grupos[gi]) r.grupos[gi].opcoes.splice(oi, 1); }));
}

function removerRefeicao() {
  const r0 = refEditando();
  if (!r0) return;
  confirmar('Remover refeição', `"${r0.nome}" sai do plano. Os dias já registrados continuam no histórico.`, 'Remover', () => {
    const dieta = dietaAtiva();
    dieta.refeicoes = dieta.refeicoes.filter(x => x.id !== edRefId);
    salvarDietaAtiva(dieta);
    fecharSheet();
  }, { duplo: true, perigo: true });
}

// ── Versionamento do plano ───────────────────────────────────────
function novaVersaoDieta() {
  const atual = dietaAtiva();
  if (!atual) return;
  confirmar(
    'Nova versão do plano',
    'Cria uma cópia editável e arquiva a atual. Nada é apagado — o histórico continua ligado ao plano de cada época.',
    'Criar versão',
    () => {
      const dietas = DB.get('dietas') || [];
      dietas.forEach(d => { d.ativa = false; });
      const nova = JSON.parse(JSON.stringify(atual));
      nova.id = uid();
      nova.nome = `Plano ${dietas.length + 1}`;
      nova.criadaEm = hoje();
      nova.ativa = true;
      dietas.push(nova);
      DB.set('dietas', dietas);
      toast('Nova versão criada');
      RENDER.ajustes();
    }, { duplo: true });
}

/** Volta ao plano original da clínica como uma versão nova. Serve pra desfazer
 *  uma edição que deu errado sem perder nada do que já foi registrado. */
function recarregarPlanoDaClinica() {
  confirmar('Recarregar plano da clínica',
    'Entra uma cópia limpa do Planejamento avançado #1 como plano ativo. O plano de agora fica arquivado e o histórico continua intacto.',
    'Recarregar', () => {
      const dietas = DB.get('dietas') || [];
      dietas.forEach(d => { d.ativa = false; });
      dietas.push({ ...JSON.parse(JSON.stringify(SEED.dietas[0])),
                    id: uid(), nome: `Dieta ${dietas.length + 1}`, criadaEm: hoje(), ativa: true });
      DB.set('dietas', dietas);
      toast('Plano da clínica recarregado');
      RENDER.ajustes();
    }, { duplo: true });
}

function ativarDieta(id) {
  const alvo = (DB.get('dietas') || []).find(d => d.id === id);
  if (!alvo) return;
  confirmar('Reativar este plano',
    `"${alvo.nome}" volta a valer no dia a dia, no lugar do plano de agora.`, 'Reativar', () => {
      const dietas = DB.get('dietas') || [];
      dietas.forEach(d => { d.ativa = d.id === id; });
      DB.set('dietas', dietas);
      toast('Plano reativado');
      RENDER.ajustes();
    }, { duplo: true });
}

// ══ MEDICAMENTOS ═══════════════════════════════════════════════

let edMedId = null;
let edMedDias = [];

function editarMedicamento(id) {
  const meds = DB.get('medicamentos') || [];
  const m = id ? meds.find(x => x.id === id) : null;
  edMedId = id || null;
  edMedDias = m ? [...(m.dias || [])] : [];

  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div><h2>${m ? 'Editar' : 'Novo'} medicamento</h2></div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <form id="med-form">
      <div class="sheet-corpo">
        <div class="campo">
          <label for="md-nome">Nome</label>
          <input id="md-nome" type="text" required value="${esc(m?.nome || '')}" placeholder="Ex.: Vitamina D">
        </div>
        <div class="campo">
          <label>Formato</label>
          <div class="toggles" id="md-forma">
            ${[['gotas', IC.gota, 'Gotas'], ['capsula', IC.capsula, 'Cápsula']].map(([v, ic, l]) => `
              <button type="button" class="toggle toggle-forma ${(m?.forma || 'capsula') === v ? 'on' : ''}"
                data-forma="${v}" onclick="escolherForma('${v}')">${ic}<span>${l}</span></button>`).join('')}
          </div>
        </div>
        <div class="campo-dupla">
          <div class="campo">
            <label for="md-dose">Dose</label>
            <input id="md-dose" type="text" value="${esc(m?.dose || '')}" placeholder="1 cápsula">
          </div>
          <div class="campo">
            <label for="md-hora">Posição no dia</label>
            <input id="md-hora" type="time" required value="${esc(m?.hora || '08:00')}">
          </div>
        </div>
        <p style="font-size:12px;color:var(--tinta-fraca);line-height:1.5;margin:-4px 0 14px">
          Define só a ordem no Fio do Dia e a lista de alarmes — ela não vê esse
          horário. O que fica registrado é a hora em que ela marcar "Tomei".</p>
        <div class="campo">
          <label for="md-freq">Frequência</label>
          <select id="md-freq" onchange="document.getElementById('md-dias').style.display = this.value === 'diaria' ? 'none' : 'block'">
            <option value="diaria"  ${m?.frequencia === 'diaria'  || !m ? 'selected' : ''}>Todo dia</option>
            <option value="semanal" ${m?.frequencia === 'semanal' ? 'selected' : ''}>Uma vez por semana</option>
            <option value="dias"    ${m?.frequencia === 'dias'    ? 'selected' : ''}>Em dias específicos</option>
          </select>
        </div>
        <div class="campo" id="md-dias" style="display:${m && m.frequencia !== 'diaria' ? 'block' : 'none'}">
          <label>Em quais dias</label>
          <div class="toggles" id="md-dias-t">
            ${DIAS_LETRA.map((l, k) => `<button type="button" class="toggle ${edMedDias.includes(k) ? 'on' : ''}"
              onclick="alternarDiaMed(${k}, this)" aria-label="${DIAS_CURTOS[k]}">${l}</button>`).join('')}
          </div>
        </div>
        <div class="campo">
          <label for="md-obs">Observações</label>
          <textarea id="md-obs" placeholder="Como tomar, cuidados...">${esc(m?.obs || '')}</textarea>
        </div>
        ${m ? `<div class="campo" style="margin-bottom:0">
          <label>Situação</label>
          <div class="toggles">
            <button type="button" class="toggle ${m.ativo ? 'on' : ''}" onclick="alternarAtivoMed(this)" id="md-ativo"
              data-on="${m.ativo}">${m.ativo ? 'Em uso' : 'Pausado'}</button>
          </div></div>` : ''}
      </div>
      <div class="sheet-pe">
        <button class="btn btn-cheio" type="submit">Salvar</button>
        ${m ? `<button type="button" class="link-fraco" onclick="removerMedicamento('${esc(m.id)}')">Remover medicamento</button>` : ''}
      </div>
    </form>`, () => RENDER.ajustes());

  document.getElementById('med-form').onsubmit = e => { e.preventDefault(); salvarMedicamento(); };
}

function alternarDiaMed(d, btn) {
  const i = edMedDias.indexOf(d);
  if (i >= 0) edMedDias.splice(i, 1); else edMedDias.push(d);
  edMedDias.sort();
  btn.classList.toggle('on');
}

function alternarAtivoMed(btn) {
  const on = btn.dataset.on !== 'true';
  btn.dataset.on = on;
  btn.classList.toggle('on', on);
  btn.textContent = on ? 'Em uso' : 'Pausado';
}

function escolherForma(v) {
  document.querySelectorAll('#md-forma .toggle-forma')
    .forEach(b => b.classList.toggle('on', b.dataset.forma === v));
}

function salvarMedicamento() {
  const freq = document.getElementById('md-freq').value;
  const ativoBtn = document.getElementById('md-ativo');
  const formaOn = document.querySelector('#md-forma .toggle-forma.on');
  const reg = {
    id: edMedId || uid(),
    forma: formaOn ? formaOn.dataset.forma : 'capsula',
    nome: document.getElementById('md-nome').value.trim(),
    dose: document.getElementById('md-dose').value.trim(),
    hora: document.getElementById('md-hora').value,
    frequencia: freq,
    dias: freq === 'diaria' ? [] : edMedDias,
    obs: document.getElementById('md-obs').value.trim(),
    ativo: ativoBtn ? ativoBtn.dataset.on === 'true' : true,
  };
  if (!reg.nome) return toast('Dê um nome ao medicamento');
  if (freq !== 'diaria' && !reg.dias.length) return toast('Escolha pelo menos um dia');

  const meds = DB.get('medicamentos') || [];
  const i = meds.findIndex(x => x.id === reg.id);
  if (i >= 0) meds[i] = reg; else meds.push(reg);
  DB.set('medicamentos', meds);
  fecharSheet();
  toast('Salvo');
}

function removerMedicamento(id) {
  confirmar('Remover medicamento', 'Ele sai do dia a dia. O histórico do que já foi tomado continua.', 'Remover', () => {
    DB.set('medicamentos', (DB.get('medicamentos') || []).filter(m => m.id !== id));
    fecharSheet();
  }, { duplo: true, perigo: true });
}

// ══ HORÁRIOS PARA OS ALARMES ═══════════════════════════════════
// PWA no iPhone não dispara lembrete em horário marcado (precisaria de servidor
// de push, e nem assim é confiável). Em vez de fingir que dá, o app entrega a
// lista pronta pra ela cadastrar de uma vez no Relógio.
function horariosDoDia() {
  // As refeições não têm mais horário marcado — não têm alarme. Só entra aqui
  // o que é mesmo um compromisso de horário: remédio, exercício, dormir.
  const linhas = [];
  (DB.get('medicamentos') || []).filter(m => m.ativo)
    .forEach(m => linhas.push({ hora: m.hora, o: `${m.nome}${m.dose ? ' — ' + m.dose : ''}` }));
  const p = perfil();
  if ((p.diasExercicio || []).length) linhas.push({ hora: p.horaExercicio || '18:00', o: 'Exercício' });
  if (p.registrarSono) linhas.push({ hora: p.horaSono || '23:00', o: 'Dormir' });
  return linhas.sort((a, b) => minutosDe(a.hora) - minutosDe(b.hora));
}

function copiarHorarios() {
  const texto = horariosDoDia().map(l => `${l.hora}  ${l.o}`).join('\n');
  const mostrar = () => {
    document.getElementById('lista-horarios').innerHTML = `
      <pre class="horarios">${esc(texto)}</pre>`;
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(texto).then(
      () => { toast('Horários copiados'); mostrar(); },
      () => { toast('Copie da lista abaixo'); mostrar(); });
  } else {
    toast('Copie da lista abaixo');
    mostrar();
  }
}

// ══ BACKUP ═════════════════════════════════════════════════════

function baixarBackup() {
  const dados = { _app: 'florescer', _versao: 1, _em: new Date().toISOString() };
  CHAVES_DADOS.forEach(k => { dados[k] = DB.get(k); });
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `florescer-backup-${hoje()}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  try { localStorage.setItem('lo_ultimo_backup', String(Date.now())); } catch {}
  toast('Backup baixado');
  if (typeof renderSyncUI === 'function') renderSyncUI();
}

function restaurarBackup(input) {
  const arq = input.files && input.files[0];
  if (!arq) return;
  const leitor = new FileReader();
  leitor.onload = () => {
    let dados;
    try { dados = JSON.parse(leitor.result); } catch { return toast('Arquivo inválido'); }
    if (dados._app !== 'florescer') return toast('Este backup não é do Florescer');
    confirmar('Restaurar backup', `Substitui os dados atuais pelos do arquivo de ${fmt.data((dados._em || '').slice(0, 10))}.`, 'Restaurar', () => {
      CHAVES_DADOS.forEach(k => { if (dados[k] !== undefined && dados[k] !== null) DB.set(k, dados[k]); });
      toast('Backup restaurado');
      location.reload();
    }, { duplo: true, perigo: true });
  };
  leitor.readAsText(arq);
  input.value = '';
}

function apagarTudo() {
  confirmar('Apagar todos os dados', 'Some tudo deste aparelho: plano, registros, pesos e sessões. Não dá para desfazer.', 'Apagar tudo', () => {
    Object.keys(localStorage).filter(k => k.startsWith('lo_')).forEach(k => localStorage.removeItem(k));
    location.reload();
  }, { duplo: true, perigo: true });
}
