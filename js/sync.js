/* ══ FLORESCER — Sincronização local-first (GitHub Gist) ═════════
   Portado da arquitetura já testada do Design Studio / Command Center.
   Garante:
   - dados no aparelho (offline-first), espelhados num Gist privado
   - merge POR MÓDULO via timestamp: um aparelho desatualizado nunca
     sobrescreve a edição mais nova de outro
   - aborta o envio se não conseguir ler a nuvem (nunca grava às cegas)
   - aparelho vazio nunca apaga a nuvem (o desastre da eviction do iOS)
   - storage persistente + histórico de versões do próprio Gist
   ════════════════════════════════════════════════════════════════ */

const GIST_CFG   = 'gist_config';
const GIST_FILE  = 'florescer-data.json';
const SYNC_KEYS  = CHAVES_DADOS;          // fonte única da verdade (core.js)

const META_KEY   = 'lo_sync_meta';        // chave crua: não sincroniza, não dá loop
const BACKUP_KEY = 'lo_ultimo_backup';

let _syncPronto     = false;   // false durante o boot, pra carga não virar "edição"
let _aplicandoNuvem = false;   // escritas nuvem→local não carimbam edição
let _timerPush      = null;
let _ultimoPull     = 0;

const cfgGist  = () => DB.get(GIST_CFG) || {};
const salvarCfg = c => { _aplicandoNuvem = true; DB.set(GIST_CFG, c); _aplicandoNuvem = false; };

// ── Carimbo de edição por módulo ─────────────────────────────────
function lerMeta()  { try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; } }
function gravarMeta(m) { try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch {} }

/** Chamado pelo DB.set do core a cada gravação. */
function marcarEdicao(chave) {
  if (!_syncPronto || _aplicandoNuvem) return;
  if (!SYNC_KEYS.includes(chave)) return;
  const m = lerMeta();
  m[chave] = Date.now();
  gravarMeta(m);
  agendarPush();
}

/** Grava sem carimbar — usado quando o dado veio da nuvem. */
function gravarDaNuvem(chave, valor) {
  _aplicandoNuvem = true;
  DB.set(chave, valor);
  _aplicandoNuvem = false;
}

// ── Guarda anti-zeramento ────────────────────────────────────────
// Este aparelho tem dado real? Impede que um celular recém-limpo pelo iOS
// substitua a nuvem boa por nada.
function temDadosLocais() {
  return SYNC_KEYS.some(k => {
    const v = DB.get(k);
    if (Array.isArray(v)) return v.length > 0;
    if (v && typeof v === 'object') return Object.keys(v).length > 0;
    return false;
  });
}

// Nuvem gravada por versão antiga não tem _meta: trata tudo com o carimbo do blob.
function metaDaNuvem(nuvem) {
  if (nuvem._meta && typeof nuvem._meta === 'object') return nuvem._meta;
  const t = nuvem._updated_at || 1;
  const m = {};
  SYNC_KEYS.forEach(k => { if (nuvem[k] !== undefined && nuvem[k] !== null) m[k] = t; });
  return m;
}

/** Merge por chave: para cada módulo, vence quem editou por último. */
function mesclar(local, metaLocal, nuvem) {
  const metaNuvem = metaDaNuvem(nuvem);
  const saida = {}, meta = {};
  SYNC_KEYS.forEach(k => {
    const ml = metaLocal[k] || 0;
    const mn = metaNuvem[k] || 0;
    if (mn > ml) { saida[k] = nuvem[k] !== undefined ? nuvem[k] : null; meta[k] = mn; }
    else         { saida[k] = local[k];                                 meta[k] = ml; }
  });
  return { saida, meta };
}

// ── Rede ─────────────────────────────────────────────────────────
function cabecalhos(token) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** Lê o conteúdo COMPLETO do arquivo (a API trunca acima de ~1MB). */
async function lerArquivoGist(arq, token) {
  if (!arq) return null;
  if (!arq.truncated && arq.content) return arq.content;
  if (!arq.raw_url) return arq.content || null;
  try {
    const r = await fetch(arq.raw_url, { headers: { 'Authorization': `Bearer ${token}` } });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

async function buscarNuvem(cfg) {
  const res = await fetch(`https://api.github.com/gists/${cfg.gistId}`, { headers: cabecalhos(cfg.token) });
  if (!res.ok) return null;
  const gist = await res.json();
  const bruto = await lerArquivoGist(gist.files[GIST_FILE], cfg.token);
  if (!bruto) return null;
  try { return JSON.parse(bruto); } catch { return null; }
}

// ── Enviar ───────────────────────────────────────────────────────
async function enviarNuvem(opts = {}) {
  const cfg = cfgGist();
  if (!cfg.token) return;

  if (!temDadosLocais() && cfg.gistId) {
    if (opts.auto) return statusSync('Envio pulado — aparelho vazio');
    if (!opts.forcar) {
      return confirmar('Aparelho sem dados',
        'Este celular parece vazio. Enviar agora apaga o backup da nuvem.',
        'Enviar mesmo assim', () => enviarNuvem({ forcar: true }), { perigo: true });
    }
  }

  statusSync('Enviando…');

  const local = {};
  SYNC_KEYS.forEach(k => { local[k] = DB.get(k); });
  const metaLocal = lerMeta();

  let saida, meta;
  if (cfg.gistId) {
    let nuvem = null;
    try { nuvem = await buscarNuvem(cfg); } catch { nuvem = null; }
    if (!nuvem) {                      // não leu a nuvem → não grava às cegas
      statusSync('Sem conexão — nada foi enviado');
      if (!opts.auto) toast('Não consegui falar com a nuvem. Seus dados seguem salvos aqui.');
      return;
    }
    ({ saida, meta } = mesclar(local, metaLocal, nuvem));
  } else {
    saida = local; meta = metaLocal;
  }

  const carimbo = Date.now();
  const corpo = {
    description: 'Florescer — dados do tratamento',
    public: false,
    files: { [GIST_FILE]: { content: JSON.stringify({ _updated_at: carimbo, _meta: meta, ...saida }, null, 2) } },
  };

  try {
    const res = cfg.gistId
      ? await fetch(`https://api.github.com/gists/${cfg.gistId}`, { method: 'PATCH', headers: cabecalhos(cfg.token), body: JSON.stringify(corpo) })
      : await fetch('https://api.github.com/gists', { method: 'POST', headers: cabecalhos(cfg.token), body: JSON.stringify(corpo) });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      statusSync('Erro: ' + (err.message || res.status));
      if (!opts.auto) toast('Falhou: ' + (err.message || res.status));
      return;
    }

    const dados = await res.json();

    // Reconcilia: se o merge trouxe algo mais novo da nuvem, aplica aqui também.
    let veioDaNuvem = false;
    SYNC_KEYS.forEach(k => {
      if (saida[k] !== undefined && JSON.stringify(DB.get(k)) !== JSON.stringify(saida[k])) {
        gravarDaNuvem(k, saida[k]);
        veioDaNuvem = true;
      }
    });
    gravarMeta(meta);

    const novo = { ...cfgGist(), pronto: true };
    if (!novo.gistId) novo.gistId = dados.id;
    salvarCfg(novo);

    statusSync(`Salvo às ${horaLocal()}`);
    if (!opts.auto) toast('Dados salvos na nuvem');
    if (typeof renderSyncUI === 'function') renderSyncUI();
    if (veioDaNuvem) location.reload();
  } catch {
    statusSync('Erro de rede');
    if (!opts.auto) toast('Erro de conexão');
  }
}

// ── Puxar (manual) ───────────────────────────────────────────────
async function puxarNuvem() {
  const cfg = cfgGist();
  if (!cfg.token || !cfg.gistId) return toast('Configure o token e o Gist primeiro');

  statusSync('Carregando…');
  try {
    const nuvem = await buscarNuvem(cfg);
    if (!nuvem) { statusSync('Não achei dados na nuvem'); return toast('Nada encontrado na nuvem'); }

    const metaNuvem = metaDaNuvem(nuvem);
    const meta = lerMeta();
    SYNC_KEYS.forEach(k => {
      if (nuvem[k] !== undefined && nuvem[k] !== null) {
        gravarDaNuvem(k, nuvem[k]);
        meta[k] = Math.max(meta[k] || 0, metaNuvem[k] || 0);
      }
    });
    gravarMeta(meta);
    salvarCfg({ ...cfgGist(), pronto: true });

    statusSync(`Carregado às ${horaLocal()}`);
    toast('Dados carregados — recarregando…');
    setTimeout(() => location.reload(), 800);
  } catch {
    statusSync('Erro de rede');
    toast('Erro ao carregar');
  }
}

// ── Puxar silencioso (abrir o app / voltar pro app) ──────────────
// Ler é sempre seguro, então não exige `pronto`. É isso que traz os dados de
// volta quando o iOS despejou o localStorage mas o token sobreviveu.
async function puxarSilencioso() {
  const cfg = cfgGist();
  if (!cfg.token || !cfg.gistId) return;
  if (_timerPush) return;                        // não atropela edição ainda não enviada
  if (sheetAberto()) return;                     // nem recarrega no meio de um registro
  if (Date.now() - _ultimoPull < 8000) return;
  _ultimoPull = Date.now();

  try {
    const nuvem = await buscarNuvem(cfg);
    if (!nuvem) return;

    const metaNuvem = metaDaNuvem(nuvem);
    const metaLocal = lerMeta();
    const meta = { ...metaLocal };
    let mudou = false;

    SYNC_KEYS.forEach(k => {
      const mn = metaNuvem[k] || 0;
      if (mn > (metaLocal[k] || 0) && nuvem[k] !== undefined && nuvem[k] !== null) {
        if (JSON.stringify(DB.get(k)) !== JSON.stringify(nuvem[k])) { gravarDaNuvem(k, nuvem[k]); mudou = true; }
        meta[k] = mn;
      }
    });
    gravarMeta(meta);
    if (!cfg.pronto) salvarCfg({ ...cfgGist(), pronto: true });

    if (mudou) location.reload();
    else statusSync(`Em dia · ${horaLocal()}`);
  } catch { /* offline — segue a vida */ }
}

// ── Envio automático com atraso ──────────────────────────────────
function agendarPush() {
  const cfg = cfgGist();
  if (!cfg.token || !cfg.pronto) return;
  clearTimeout(_timerPush);
  _timerPush = setTimeout(() => { _timerPush = null; enviarNuvem({ auto: true }); }, 3000);
}
function despejarPush() {
  if (!_timerPush) return;
  clearTimeout(_timerPush);
  _timerPush = null;
  enviarNuvem({ auto: true });
}

// ── Estado visível ───────────────────────────────────────────────
function statusSync(msg) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = msg;
}

function renderSyncUI() {
  const el = document.getElementById('sync-ui');
  if (!el) return;
  const cfg = cfgGist();
  const ultimo = Number(localStorage.getItem(BACKUP_KEY) || 0);
  const dias = ultimo ? Math.floor((Date.now() - ultimo) / 86400000) : null;

  el.innerHTML = `
    <div class="cartao">
      <div class="rotulo" style="margin-bottom:4px">Cópia na nuvem</div>
      ${cfg.token ? `
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
          <span class="pill ${cfg.pronto ? 'pill-folha' : 'pill-ambar'}">
            ${cfg.pronto ? 'sincronizando' : 'puxe uma vez para ativar'}</span>
          <span id="sync-status" class="li-fim" style="margin-left:auto"></span>
        </div>
        ${cfg.gistId ? `
          <div style="background:var(--bruma);border-radius:12px;padding:11px 13px;margin-bottom:12px">
            <div style="font-size:11px;color:var(--tinta-fraca);margin-bottom:3px">ID do Gist — use o mesmo em todos os aparelhos</div>
            <code style="font-size:12px;word-break:break-all;user-select:all">${esc(cfg.gistId)}</code>
          </div>` : `
          <p style="font-size:13px;color:var(--tinta-dim);line-height:1.55;margin-bottom:12px">
            Ainda não existe um Gist. Toque em Enviar para criar o primeiro.</p>`}
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-vazio btn-sm" onclick="puxarNuvem()">Puxar da nuvem</button>
          <button class="btn btn-vazio btn-sm" onclick="enviarNuvem()">Enviar agora</button>
          <button class="btn btn-suave btn-sm" onclick="abrirTokenSheet()">Token</button>
        </div>`
      : `
        <p style="font-size:13.5px;color:var(--tinta-dim);line-height:1.6;margin-bottom:14px">
          Guarda uma cópia dos dados num Gist privado. É o que salva o histórico se o
          celular limpar o app — e deixa você ver os mesmos dados no computador.</p>
        <button class="btn btn-vazio btn-sm" onclick="abrirTokenSheet()">Configurar</button>`}
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--linha);font-size:12.5px;color:var(--tinta-dim)">
        ${dias === null ? 'Nenhum backup em arquivo ainda.'
          : `Último backup em arquivo: ${dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : 'há ' + dias + ' dias'}.`}
      </div>
    </div>`;

  if (cfg.token) statusSync(cfg.pronto ? 'Conectado' : 'Aguardando o primeiro Puxar');
}

function abrirTokenSheet() {
  const cfg = cfgGist();
  abrirSheet(`
    <div class="sheet-alca"></div>
    <div class="sheet-cabeca">
      <div><h2>Cópia na nuvem</h2>
        <div class="dica">Token do GitHub com permissão de gist.</div></div>
      <button class="sheet-x" onclick="fecharSheet()" aria-label="Fechar">✕</button>
    </div>
    <form id="tk-form">
      <div class="sheet-corpo">
        <div class="campo">
          <label for="tk-token">Token</label>
          <input id="tk-token" type="password" value="${esc(cfg.token || '')}" placeholder="ghp_..." autocomplete="off">
        </div>
        <div class="campo">
          <label for="tk-gist">ID do Gist</label>
          <input id="tk-gist" type="text" value="${esc(cfg.gistId || '')}" placeholder="deixe vazio para criar um novo" autocomplete="off">
        </div>
        <p style="font-size:12.5px;color:var(--tinta-dim);line-height:1.6">
          Num aparelho novo: salve o token e o ID, depois toque em <strong>Puxar da nuvem</strong> antes de qualquer outra coisa.
          O envio automático só liga depois disso — assim um celular vazio nunca apaga o backup.</p>
      </div>
      <div class="sheet-pe">
        <button class="btn btn-cheio" type="submit">Salvar</button>
        ${cfg.token ? `<button type="button" class="link-fraco" onclick="desconectarNuvem()">Desconectar este aparelho</button>` : ''}
      </div>
    </form>`, () => { if (typeof renderSyncUI === 'function') renderSyncUI(); });

  document.getElementById('tk-form').onsubmit = e => {
    e.preventDefault();
    const token = document.getElementById('tk-token').value.trim();
    const gistId = document.getElementById('tk-gist').value.trim();
    if (!token) return toast('Cole o token');
    const antes = cfgGist();
    salvarCfg({ token, gistId: gistId || antes.gistId || null, pronto: antes.pronto || false });
    fecharSheet();
    toast('Salvo. Agora toque em Puxar da nuvem.');
  };
}

function desconectarNuvem() {
  confirmar('Desconectar', 'O token sai deste aparelho. Os dados locais e a cópia na nuvem continuam intactos.', 'Desconectar', () => {
    salvarCfg({});
    fecharSheet();
    toast('Desconectado');
  });
}

// ── Ciclo de vida ────────────────────────────────────────────────
// Roda depois do handler do core (core.js carrega antes), então iniciarDB() já
// terminou e as gravações de carga não viram "edição de agora".
document.addEventListener('DOMContentLoaded', () => { _syncPronto = true; });

window.addEventListener('load', () => { puxarSilencioso(); });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') puxarSilencioso();
  else despejarPush();
});
window.addEventListener('focus', puxarSilencioso);
window.addEventListener('pagehide', despejarPush);

window.addEventListener('online', () => {
  const cfg = cfgGist();
  if (!cfg.token || !cfg.pronto) return;
  statusSync('Reconectado — sincronizando…');
  enviarNuvem({ auto: true });
  setTimeout(puxarSilencioso, 5000);
});
window.addEventListener('offline', () => statusSync('Sem conexão — tudo guardado no aparelho'));
