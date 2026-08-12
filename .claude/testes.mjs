/* Harness headless: carrega os módulos num sandbox `vm` com DOM/localStorage
   falsos e testa a lógica que não é visual — nota do dia, sequência, relatório
   semanal, versionamento de dieta e o merge do sync.
   Uso: node .claude/testes.mjs                                             */

import { readFileSync } from 'fs';
import vm from 'vm';

let ok = 0, falhou = 0;
const eq = (nome, a, b) => {
  const bateu = JSON.stringify(a) === JSON.stringify(b);
  if (bateu) { ok++; console.log('  ✓', nome); }
  else { falhou++; console.log('  ✗', nome, '\n      esperado:', JSON.stringify(b), '\n      obtido:  ', JSON.stringify(a)); }
};

function novoSandbox() {
  const store = new Map();
  const localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    get length() { return store.size; },
    key: i => [...store.keys()][i],
  };
  Object.defineProperty(localStorage, 'keys', { value: () => [...store.keys()] });

  const noop = () => {};
  const elemento = () => ({
    innerHTML: '', textContent: '', style: { setProperty: noop, removeProperty: noop },
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: () => null, addEventListener: noop,
    querySelector: () => null, querySelectorAll: () => [],
    appendChild: noop, removeChild: noop, remove: noop, click: noop,
    children: [], firstChild: null, files: [],
    offsetTop: 0, offsetHeight: 0, dataset: {},
  });

  const sandbox = {
    console, JSON, Math, Date, Number, String, Object, Array, Intl, Set, Map,
    parseInt, parseFloat, isNaN, setTimeout: noop, clearTimeout: noop, fetch: () => Promise.reject(new Error('offline')),
    localStorage,
    navigator: { storage: { persist: () => Promise.resolve(true) } },
    location: { hash: '', reload: noop },
    history: { pushState: noop },
    document: {
      addEventListener: noop, getElementById: () => elemento(),
      querySelector: () => null, querySelectorAll: () => [],
      createElement: () => elemento(), body: elemento(),
      fonts: { ready: { then: noop }, check: () => true },
    },
    window: { addEventListener: noop, innerWidth: 375 },
    requestAnimationFrame: noop,
  };
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;

  const ctx = vm.createContext(sandbox);
  ['core', 'hoje', 'alimentacao', 'progresso', 'relatorio', 'agenda', 'ajustes', 'sync']
    .forEach(m => vm.runInContext(readFileSync(`js/${m}.js`, 'utf8'), ctx, { filename: m + '.js' }));
  vm.runInContext('iniciarDB()', ctx);
  return ctx;
}

const run = (ctx, code) => vm.runInContext(code, ctx);

console.log('\n── Nota do dia ─────────────────────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    const p = perfil(); p.diasExercicio = [1,2,3,4,5]; p.metaAgua = 3000; DB.set('perfil', p);
    DB.set('medicamentos', [{id:'m1',nome:'D',dose:'',hora:'08:00',frequencia:'diaria',dias:[],obs:'',ativo:true}]);
    var HOJE = hoje();
  `);
  eq('dia vazio = 0', run(ctx, 'notaDoDia(HOJE).nota'), 0);

  run(ctx, `DB.set('logAgua', [{id:'a',data:HOJE,hora:'09:00',ml:3000}]);`);
  const soAgua = run(ctx, 'notaDoDia(HOJE)');
  // dia de treino: base = 40+25+20+15 = 100 → água sozinha vale 25
  const ehTreino = run(ctx, 'ehDiaDeTreino(HOJE)');
  eq('água cheia sozinha', soAgua.nota, ehTreino ? 25 : Math.round(25 / 85 * 100));

  run(ctx, `
    const d = dietaAtiva();
    DB.set('logRefeicoes', d.refeicoes.map(r => ({id:'r'+r.id,data:HOJE,dietaId:d.id,refeicaoId:r.id,hora:r.hora,escolhas:[],status:'feita'})));
    DB.set('logMedicamentos', [{id:'lm',data:HOJE,medId:'m1',hora:'08:00'}]);
  `);
  const semTreino = run(ctx, 'notaDoDia(HOJE)');
  eq('tudo menos o treino', semTreino.nota, ehTreino ? 85 : 100);

  // Num dia de descanso o exercício sai da conta e os 15 pontos se redistribuem
  run(ctx, `const p2 = perfil(); p2.diasExercicio = []; DB.set('perfil', p2);`);
  eq('dia de descanso não penaliza', run(ctx, 'notaDoDia(HOJE).nota'), 100);
  eq('parte do exercício vira null', run(ctx, 'notaDoDia(HOJE).partes.exercicio'), null);

  // Refeição pulada conta como não feita
  run(ctx, `
    const l = DB.get('logRefeicoes'); l[0].status = 'pulada'; DB.set('logRefeicoes', l);
  `);
  const comPulada = run(ctx, 'notaDoDia(HOJE).nota');
  eq('pular uma refeição derruba a nota', comPulada < 100, true);
}

console.log('\n── Sequência ───────────────────────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    const p = perfil(); p.diasExercicio = []; p.metaAgua = 1000; DB.set('perfil', p);
    DB.set('medicamentos', []);
    const d = dietaAtiva();
    const refs = [], agua = [];
    // 5 dias perfeitos terminando ONTEM, e hoje ainda zerado
    for (let k = 5; k >= 1; k--) {
      const dia = somaDias(hoje(), -k);
      d.refeicoes.forEach(r => refs.push({id:'r'+dia+r.id,data:dia,dietaId:d.id,refeicaoId:r.id,hora:r.hora,escolhas:[],status:'feita'}));
      agua.push({id:'a'+dia,data:dia,hora:'09:00',ml:1000});
    }
    DB.set('logRefeicoes', refs); DB.set('logAgua', agua);
  `);
  eq('hoje zerado não quebra a sequência', run(ctx, 'sequencia().atual'), 5);
  eq('recorde acompanha', run(ctx, 'sequencia().recorde'), 5);

  // um buraco no meio corta a sequência atual
  run(ctx, `
    const buraco = somaDias(hoje(), -3);
    DB.set('logRefeicoes', DB.get('logRefeicoes').filter(l => l.data !== buraco));
    DB.set('logAgua', DB.get('logAgua').filter(l => l.data !== buraco));
  `);
  eq('buraco corta a sequência atual', run(ctx, 'sequencia().atual'), 2);
  eq('mas o recorde fica', run(ctx, 'sequencia().recorde'), 2);
}

console.log('\n── Score congelado ─────────────────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    const p = perfil(); p.diasExercicio = []; p.metaAgua = 1000; DB.set('perfil', p);
    DB.set('medicamentos', []);
    var ONTEM = somaDias(hoje(), -1);
    const d = dietaAtiva();
    DB.set('logRefeicoes', d.refeicoes.map(r => ({id:'r'+r.id,data:ONTEM,dietaId:d.id,refeicaoId:r.id,hora:r.hora,escolhas:[],status:'feita'})));
    DB.set('logAgua', [{id:'a',data:ONTEM,hora:'09:00',ml:1000}]);
    congelarPendentes();
  `);
  eq('ontem congelou em 100', run(ctx, 'notaDe(ONTEM)'), 100);
  run(ctx, `DB.set('logRefeicoes', []); DB.set('logAgua', []);`);
  eq('apagar o log não muda o dia já fechado', run(ctx, 'notaDe(ONTEM)'), 100);
  eq('um dia só é congelado uma vez', run(ctx, 'congelarPendentes(); DB.get("scores").length'), 1);
}

console.log('\n── Versionamento da dieta ──────────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    var d1 = dietaAtiva();
    var refCafe = d1.refeicoes[0];
    var g = refCafe.grupos[0];
    DB.set('logRefeicoes', [{id:'x',data:somaDias(hoje(),-1),dietaId:d1.id,refeicaoId:refCafe.id,hora:'07:30',
      escolhas:[{grupoId:g.id,opcaoIds:[g.opcoes[0].id]}],status:'feita'}]);
    var textoAntes = escolhasTexto(DB.get('logRefeicoes')[0]);
    novaVersaoDieta(); fecharConfirma(true);
  `);
  eq('a nova versão fica ativa', run(ctx, 'dietaAtiva().id !== d1.id'), true);
  eq('só uma ativa por vez', run(ctx, 'DB.get("dietas").filter(d => d.ativa).length'), 1);
  eq('a antiga continua guardada', run(ctx, 'DB.get("dietas").length'), 2);

  run(ctx, `
    // muda a dieta NOVA: apaga a opção que ela tinha escolhido antes
    var dn = dietaAtiva(); dn.refeicoes[0].grupos[0].opcoes = [];
    DB.set('dietas', DB.get('dietas').map(x => x.id === dn.id ? dn : x));
  `);
  eq('o histórico antigo continua legível', run(ctx, 'escolhasTexto(DB.get("logRefeicoes")[0]) === textoAntes'), true);
  eq('e não veio vazio', run(ctx, 'escolhasTexto(DB.get("logRefeicoes")[0]).length > 0'), true);
}

console.log('\n── Relatório semanal ───────────────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    const p = perfil(); p.diasExercicio = [1,3,5]; p.metaSemanalExercicio = 3; p.metaAgua = 2000;
    p.pesoInicial = 80; DB.set('perfil', p);
    DB.set('medicamentos', []);
    var SEM = inicioSemana(somaDias(hoje(), -14));      // uma semana bem no passado
    var dias = diasDaSemana(SEM);
    const d = dietaAtiva();
    const refs = [], agua = [], ex = [];
    dias.forEach((dia, i) => {
      d.refeicoes.forEach(r => refs.push({id:'r'+dia+r.id,data:dia,dietaId:d.id,refeicaoId:r.id,hora:r.hora,escolhas:[],status:'feita'}));
      agua.push({id:'a'+dia,data:dia,hora:'09:00',ml: i < 4 ? 2000 : 900});
      if (i % 2 === 0) ex.push({id:'e'+dia,data:dia,tipo:'Academia',obs:''});
    });
    DB.set('logRefeicoes', refs); DB.set('logAgua', agua); DB.set('logExercicios', ex);
    DB.set('pesos', [{id:'p1',data:somaDias(SEM,-1),peso:80,origem:'casa',sessaoId:null},
                     {id:'p2',data:dias[5],peso:79.2,origem:'casa',sessaoId:null}]);
    var dd = dadosSemana(SEM);
  `);
  eq('semana = seg a sáb (6 dias)', run(ctx, 'dd.diasNaSemana'), 6);
  eq('refeições todas feitas', run(ctx, 'dd.refeicoesFeitas === dd.refeicoesEsperadas'), true);
  eq('4 dias bateram a água', run(ctx, 'dd.diasMetaAgua'), 4);
  eq('3 treinos', run(ctx, 'dd.treinos'), 3);
  eq('peso perdido no período', run(ctx, 'Math.round(dd.pesoPerdido * 10) / 10'), 0.8);

  eq('semana passada já pode fechar', run(ctx, 'relatorioLiberado(SEM)'), true);
  eq('a semana atual ainda não fechou antes de sábado',
     run(ctx, 'relatorioLiberado(inicioSemana(hoje())) === (hoje() > somaDias(inicioSemana(hoje()),5))'), true);

  run(ctx, `fecharRelatoriosPendentes();`);
  eq('relatório guardado', run(ctx, 'DB.get("relatorios").some(r => r.ini === SEM)'), true);
  run(ctx, `DB.set('logExercicios', []); fecharRelatoriosPendentes();`);
  eq('relatório fechado não muda mais', run(ctx, 'DB.get("relatorios").find(r => r.ini === SEM).treinos'), 3);
  eq('não duplica ao rodar de novo', run(ctx, 'DB.get("relatorios").filter(r => r.ini === SEM).length'), 1);
}

console.log('\n── Merge do sync ───────────────────────────');
{
  const ctx = novoSandbox();
  const r = run(ctx, `
    // local editou 'pesos' agora; a nuvem editou 'sessoes' depois
    const local = { pesos: [{id:'local'}], sessoes: [{id:'velha'}] };
    const metaLocal = { pesos: 2000, sessoes: 1000 };
    const nuvem = { _updated_at: 3000, _meta: { pesos: 1500, sessoes: 2500 },
                    pesos: [{id:'nuvem'}], sessoes: [{id:'nova'}] };
    const m = mesclar(local, metaLocal, nuvem);
    JSON.stringify({ pesos: m.saida.pesos, sessoes: m.saida.sessoes, meta: [m.meta.pesos, m.meta.sessoes] });
  `);
  const m = JSON.parse(r);
  eq('módulo editado aqui depois vence', m.pesos, [{ id: 'local' }]);
  eq('módulo editado na nuvem depois vence', m.sessoes, [{ id: 'nova' }]);
  eq('os carimbos acompanham', m.meta, [2000, 2500]);

  eq('nuvem antiga sem _meta ainda mescla', JSON.parse(run(ctx, `
    JSON.stringify(mesclar({pesos:[{id:'l'}]}, {}, {_updated_at: 9, pesos:[{id:'c'}]}).saida.pesos);
  `)), [{ id: 'c' }]);

  eq('aparelho com dados é reconhecido', run(ctx, 'temDadosLocais()'), true);
  eq('aparelho zerado é reconhecido', run(ctx, `
    CHAVES_DADOS.forEach(k => localStorage.removeItem('lo_' + k)); temDadosLocais();
  `), false);

  eq('SYNC_KEYS cobre todas as chaves de dados',
     run(ctx, 'CHAVES_DADOS.every(k => SYNC_KEYS.includes(k)) && SYNC_KEYS.length === CHAVES_DADOS.length'), true);
}

console.log('\n── Medicamentos por frequência ─────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    DB.set('medicamentos', [
      {id:'a',nome:'Diária',dose:'',hora:'08:00',frequencia:'diaria',dias:[],obs:'',ativo:true},
      {id:'b',nome:'Semanal',dose:'',hora:'20:00',frequencia:'semanal',dias:[deData(hoje()).getDay()],obs:'',ativo:true},
      {id:'c',nome:'Outro dia',dose:'',hora:'20:00',frequencia:'dias',dias:[(deData(hoje()).getDay()+1)%7],obs:'',ativo:true},
      {id:'d',nome:'Pausada',dose:'',hora:'08:00',frequencia:'diaria',dias:[],obs:'',ativo:false},
    ]);
  `);
  eq('só os que valem hoje', run(ctx, 'medsDoDia(hoje()).map(m => m.id)'), ['a', 'b']);
  eq('amanhã entra o de outro dia', run(ctx, 'medsDoDia(somaDias(hoje(),1)).map(m => m.id).includes("c")'), true);
}

console.log(`\n${falhou ? '✗' : '✓'} ${ok} passaram, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
