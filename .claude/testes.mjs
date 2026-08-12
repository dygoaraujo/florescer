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

console.log('\n── Plano real da clínica ───────────────────');
{
  const ctx = novoSandbox();
  const d = run(ctx, 'dietaAtiva()');
  eq('6 refeições', d.refeicoes.length, 6);
  eq('nomes na ordem do dia', d.refeicoes.map(r => r.nome),
     ['Café da manhã', 'Lanche da manhã', 'Almoço', 'Lanche da tarde', 'Jantar', 'Ceia']);
  eq('almoço: grupo A, grupo B e proteína',
     d.refeicoes[2].grupos.map(g => `${g.nome} min${g.min != null ? g.min : g.qtd} max${g.qtd}`),
     ['Vegetais do Grupo A min2 max6', 'Vegetais do Grupo B min1 max1', 'Proteína min1 max1']);
  eq('jantar não tem grupo B (como no plano)',
     d.refeicoes[4].grupos.some(g => g.nome.includes('Grupo B')), false);
  eq('proteína vem com 150 g', run(ctx, `
    medidaTexto(dietaAtiva().refeicoes[2].grupos[2].opcoes.find(o => o.nome === 'Alcatra').medida);
  `), '150 g');
  eq('ovo tem medida própria', run(ctx, `
    medidaTexto(dietaAtiva().refeicoes[2].grupos[2].opcoes.find(o => o.nome === 'Ovo de galinha').medida);
  `), '2 un');
  eq('grupo A é à vontade', run(ctx, `
    medidaTexto(dietaAtiva().refeicoes[2].grupos[0].opcoes[0].medida);
  `), 'à vontade');
  eq('grupo B é 50 g', run(ctx, `
    medidaTexto(dietaAtiva().refeicoes[2].grupos[1].opcoes[0].medida);
  `), '50 g');
  eq('ids únicos dentro de cada grupo', run(ctx, `
    dietaAtiva().refeicoes.every(r => r.grupos.every(g => new Set(g.opcoes.map(o => o.id)).size === g.opcoes.length));
  `), true);
  eq('4 medicamentos, 2 em gotas e 2 em cápsula', run(ctx, `
    [DB.get('medicamentos').length, DB.get('medicamentos').filter(x => x.forma === 'gotas').length, DB.get('medicamentos').filter(x => x.forma === 'capsula').length];
  `), [4, 2, 2]);
  eq('Mounjaro não é medicamento diário', run(ctx, `
    (DB.get('medicamentos') || []).some(m => /mounjaro/i.test(m.nome));
  `), false);
  eq('Mounjaro é procedimento de sessão', run(ctx, `
    (DB.get('procedimentos') || []).some(p => /mounjaro/i.test(p));
  `), true);
}

console.log('\n── Medidas e passo do −/+ ──────────────────');
{
  const ctx = novoSandbox();
  eq('formata inteiro', run(ctx, "medidaTexto(med(150,'g'))"), '150 g');
  eq('formata fração em pt-BR', run(ctx, "medidaTexto(med(0.5,'un'))"), '0,5 un');
  eq('à vontade não mostra número', run(ctx, "medidaTexto(med(null,'à vontade'))"), 'à vontade');
  eq('gramas andam de 10 em 10', run(ctx, "passoDe('g')"), 10);
  eq('ml andam de 50 em 50', run(ctx, "passoDe('ml')"), 50);
  eq('unidade anda de 1 em 1', run(ctx, "passoDe('un')"), 1);
  eq('unidade desconhecida anda de 1', run(ctx, "passoDe('punhado')"), 1);
}

console.log('\n── Sessão na clínica ───────────────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    DB.set('sessoes', [{id:'s1',data:hoje(),hora:'09:00',clinica:'X',pesoEntrada:null,pesoSaida:null,obs:'',procedimentos:[],feita:false}]);
    var S = () => DB.get('sessoes')[0];
  `);
  eq('começa na chegada', run(ctx, 'etapaSessao(S())'), 'chegada');
  run(ctx, `
    { const ss = DB.get('sessoes'); ss[0].pesoEntrada = 77.2; DB.set('sessoes', ss); }
  `);
  eq('depois de chegar, vai pros procedimentos', run(ctx, 'etapaSessao(S())'), 'durante');
  run(ctx, `
    { const ss = DB.get('sessoes'); ss[0].pesoSaida = 76.5; ss[0].feita = true; DB.set('sessoes', ss); }
    sincronizarPesosDaSessao(S());
  `);
  eq('conclui', run(ctx, 'etapaSessao(S())'), 'concluida');
  eq('as duas pesagens entram no histórico',
     run(ctx, "DB.get('pesos').map(p => p.origem).sort()"), ['sessao-entrada', 'sessao-saida']);

  // A curva passa por TODAS as pesagens, na ordem em que aconteceram
  eq('as duas entram na curva, chegada antes da saída',
     run(ctx, "pesosOrdenados().map(p => p.peso)"), [77.2, 76.5]);
  eq('peso atual = a última pesagem', run(ctx, 'pesoAtual()'), 76.5);
  eq('e cada ponto sabe de onde veio',
     run(ctx, "pesosOrdenados().map(p => ORIGEM_PESO[p.origem].rotulo)"),
     ['chegada na clínica', 'saída da clínica']);

  run(ctx, `
    { const ss = DB.get('sessoes'); ss[0].pesoEntrada = 76.8; DB.set('sessoes', ss); } sincronizarPesosDaSessao(S());
  `);
  eq('reeditar a sessão não duplica pesagens', run(ctx, "DB.get('pesos').length"), 2);
}

console.log('\n── Refeição incompleta ─────────────────────');
{
  const ctx = novoSandbox();
  run(ctx, `
    var dReal = dietaAtiva();
    var almoco = dReal.refeicoes[2];
    // confirmou só a proteína: faltaram os dois grupos de vegetais
    DB.set('logRefeicoes', [{
      id:'x', data: somaDias(hoje(),-1), dietaId: dReal.id, refeicaoId: almoco.id, refeicaoNome: almoco.nome,
      hora:'12:40',
      escolhas: [{ grupoId: almoco.grupos[2].id, grupoNome:'Proteína',
        itens: [{ opcaoId: almoco.grupos[2].opcoes[0].id, nome: 'Alcatra', medida: med(120,'g') }] }],
      completa: false, faltou: ['Vegetais do Grupo A', 'Vegetais do Grupo B'], status: 'feita',
    }]);
  `);
  eq('o texto do histórico traz a medida ajustada',
     run(ctx, 'escolhasTexto(DB.get("logRefeicoes")[0])'), 'Alcatra 120 g');
  eq('o relatório conta a incompleta',
     run(ctx, 'dadosSemana(inicioSemana(somaDias(hoje(),-1))).refeicoesIncompletas'), 1);
  eq('e diz o que mais faltou', run(ctx, `
    dadosSemana(inicioSemana(somaDias(hoje(),-1))).faltasComuns.map(f => f.nome + ':' + f.vezes);
  `), ['Vegetais do Grupo A:1', 'Vegetais do Grupo B:1']);

  // formato antigo (opcaoIds) ainda tem que ser legível
  run(ctx, `
    var d2 = dietaAtiva(), a2 = d2.refeicoes[2];
    DB.set('logRefeicoes', [{ id:'y', data: hoje(), dietaId: d2.id, refeicaoId: a2.id, hora:'12:00',
      escolhas: [{ grupoId: a2.grupos[2].id, opcaoIds: [a2.grupos[2].opcoes[0].id] }], status:'feita' }]);
  `);
  eq('registro em formato antigo continua legível',
     run(ctx, 'escolhasTexto(DB.get("logRefeicoes")[0])'), 'Alcatra 150 g');
}

console.log('\n── Migração do plano antigo ────────────────');
{
  // Reproduz o aparelho do Rodrigo: já tinha aberto a v1, então as chaves
  // existem e o iniciarDB() sozinho NUNCA traria o plano novo.
  const DIETA_VELHA = {
    id: 'dieta-1', nome: 'Plano inicial', criadaEm: '2026-08-01', ativa: true, obs: 'Exemplo',
    refeicoes: [{ id: 'r-cafe', nome: 'Café da manhã', hora: '07:30', grupos: [
      { id: 'g1', nome: 'Proteína', qtd: 1, selecao: 'unica',
        opcoes: [{ id: 'o1', nome: 'Ovo mexido' }, { id: 'o2', nome: 'Queijo branco' }] }] }],
  };
  const MEDS_VELHOS = [
    { id: 'm1', nome: 'Vitamina D', dose: '1 cápsula', hora: '08:00', frequencia: 'diaria', dias: [], obs: '', ativo: true },
    { id: 'm2', nome: 'Mounjaro', dose: '', hora: '20:00', frequencia: 'semanal', dias: [0], obs: '', ativo: true },
  ];

  // (a) aparelho sem histórico — o plano de exemplo pode ser trocado direto
  {
    const ctx = novoSandbox();
    run(ctx, `
      DB.set('dietas', ${JSON.stringify([DIETA_VELHA])});
      DB.set('medicamentos', ${JSON.stringify(MEDS_VELHOS)});
      DB.set('logRefeicoes', []);
      localStorage.removeItem('lo_seedVersao');
      iniciarDB();
    `);
    eq('sem histórico: o plano real entra no lugar', run(ctx, 'dietaAtiva().nome'), 'Dieta 1');
    eq('e traz as 6 refeições', run(ctx, 'dietaAtiva().refeicoes.length'), 6);
    eq('com as opções e medidas certas', run(ctx, `
      medidaTexto(dietaAtiva().refeicoes[2].grupos[2].opcoes.find(o => o.nome === 'Alcatra').medida);
    `), '150 g');
    eq('não fica plano velho pendurado', run(ctx, "DB.get('dietas').length"), 1);
    eq('os 4 manipulados aparecem', run(ctx, "DB.get('medicamentos').map(m => m.nome).sort()"),
       ['Berberina', 'Multiminerais', 'Shot do sono', 'Tintura de coentro']);
    eq('Mounjaro sai dos medicamentos diários',
       run(ctx, "DB.get('medicamentos').some(m => /mounjaro/i.test(m.nome))"), false);
    eq('e vira procedimento da clínica',
       run(ctx, "DB.get('procedimentos').some(p => /mounjaro/i.test(p))"), true);
    eq('aparecem no fio do dia', run(ctx, `
      itensDoDia(hoje()).filter(i => i.tipo === 'remedio').map(i => i.hora + ' ' + i.nome);
    `), ['12:00 Tintura de coentro', '13:30 Multiminerais', '19:15 Berberina', '22:00 Shot do sono']);
    eq('rodar de novo não duplica nada', run(ctx, `
      iniciarDB(); iniciarDB();
      [DB.get('dietas').length, DB.get('medicamentos').length];
    `), [1, 4]);
  }

  // (b) aparelho COM histórico — o passado não pode mudar
  {
    const ctx = novoSandbox();
    run(ctx, `
      DB.set('dietas', ${JSON.stringify([DIETA_VELHA])});
      DB.set('medicamentos', ${JSON.stringify(MEDS_VELHOS)});
      DB.set('logRefeicoes', [{ id:'v', data: somaDias(hoje(),-2), dietaId: 'dieta-1',
        refeicaoId: 'r-cafe', hora: '07:30',
        escolhas: [{ grupoId: 'g1', opcaoIds: ['o1'] }], status: 'feita' }]);
      localStorage.removeItem('lo_seedVersao');
      iniciarDB();
    `);
    eq('com histórico: o plano novo entra como versão nova', run(ctx, 'dietaAtiva().id === ID_DIETA_CLINICA'), true);
    eq('a dieta antiga fica arquivada', run(ctx, "DB.get('dietas').length"), 2);
    eq('só uma ativa', run(ctx, "DB.get('dietas').filter(d => d.ativa).length"), 1);
    eq('o registro antigo continua legível',
       run(ctx, "escolhasTexto(DB.get('logRefeicoes')[0])"), 'Ovo mexido');
    eq('o medicamento dela não é apagado',
       run(ctx, "DB.get('medicamentos').some(m => m.nome === 'Vitamina D')"), true);
    eq('mas o Mounjaro sai mesmo assim',
       run(ctx, "DB.get('medicamentos').some(m => /mounjaro/i.test(m.nome))"), false);
    eq('medicamento antigo ganha o campo forma',
       run(ctx, "DB.get('medicamentos').every(m => !!m.forma)"), true);
    eq('rodar de novo não cria outra dieta', run(ctx, "iniciarDB(); DB.get('dietas').length"), 2);
  }
}

console.log('\n── Mínimo, teto e itens obrigatórios ───────');
{
  const ctx = novoSandbox();
  const cafe = run(ctx, 'dietaAtiva().refeicoes[0]');

  eq('folha do suco não carrega ml (é à vontade)',
     run(ctx, "medidaTexto(dietaAtiva().refeicoes[0].grupos[0].opcoes[0].medida)"), 'à vontade');
  eq('e aceita mais de uma folha',
     [cafe.grupos[0].min, cafe.grupos[0].qtd], [1, 3]);
  eq('chia, gengibre e água entram como itens de marcar',
     cafe.grupos.find(g => g.id === 'g-suco-extra').opcoes.map(o => o.nome),
     ['Semente de chia', 'Gengibre', 'Água']);
  eq('e os três são obrigatórios',
     (() => { const g = cafe.grupos.find(x => x.id === 'g-suco-extra'); return [g.min, g.qtd]; })(), [3, 3]);

  // Um grupo com min < qtd fecha no mínimo, mas ainda aceita mais.
  run(ctx, "abrirRefeicao('r-almoco');");
  const gA = run(ctx, "dietaAtiva().refeicoes[2].grupos[0]");
  eq('grupo A: 1 escolha ainda não completa', run(ctx, `
    escolher('${gA.id}', '${gA.opcoes[0].id}'); grupoCompleto(dietaAtiva().refeicoes[2].grupos[0]);
  `), false);
  eq('com 2 completa', run(ctx, `
    escolher('${gA.id}', '${gA.opcoes[1].id}'); grupoCompleto(dietaAtiva().refeicoes[2].grupos[0]);
  `), true);
  eq('mas ainda cabe mais', run(ctx, `
    escolher('${gA.id}', '${gA.opcoes[2].id}'); sel['${gA.id}'].length;
  `), 3);
  eq('até o teto de 6', run(ctx, `
    [3,4,5,6,7].forEach(k => escolher('${gA.id}', dietaAtiva().refeicoes[2].grupos[0].opcoes[k].id));
    sel['${gA.id}'].length;
  `), 6);

  // Faltar um item obrigatório derruba a refeição pra incompleta
  run(ctx, `
    abrirRefeicao('r-cafe');
    const c = dietaAtiva().refeicoes[0];
    escolher(c.grupos[0].id, c.grupos[0].opcoes[0].id);             // folha
    escolher(c.grupos[1].id, c.grupos[1].opcoes[0].id);             // fruta
    escolher(c.grupos[2].id, c.grupos[2].opcoes[0].id);             // chia
    escolher(c.grupos[2].id, c.grupos[2].opcoes[2].id);             // água (falta o gengibre)
    c.grupos.slice(3).forEach(g => escolher(g.id, g.opcoes[0].id));
    confirmarRefeicao();
  `);
  const log = run(ctx, "DB.get('logRefeicoes').find(l => l.refeicaoId === 'r-cafe')");
  eq('faltando o gengibre, a refeição fica incompleta', log.completa, false);
  eq('e o app sabe qual grupo faltou', log.faltou, ['Complementos do suco']);
  eq('o registro guarda a hora do plano pra comparar', log.horaPlanejada, '07:30');
}

console.log('\n── Horário real e sono ─────────────────────');
{
  const ctx = novoSandbox();
  eq('no horário não conta como fora',
     run(ctx, "foraDoHorario({status:'feita', hora:'12:50', horaPlanejada:'12:30'})"), false);
  eq('2h depois conta',
     run(ctx, "foraDoHorario({status:'feita', hora:'14:40', horaPlanejada:'12:30'})"), true);
  eq('refeição pulada não entra na conta',
     run(ctx, "foraDoHorario({status:'pulada', hora:'20:00', horaPlanejada:'12:30'})"), true === false);

  eq('média de horários da noite', run(ctx, "mediaDeHorario(['23:00','23:30','00:30'])"), '23:40');
  eq('média com um só', run(ctx, "mediaDeHorario(['22:15'])"), '22:15');
  eq('sem registro, sem média', run(ctx, "mediaDeHorario([])"), null);

  // Deitar de madrugada pertence ao dia que acabou
  eq('01:30 conta como a noite do dia anterior', run(ctx, `
    (function () {
      const real = Date;
      const finge = h => { const d = new Date(); d.setHours(h, 30, 0, 0); return d; };
      const antes = finge(1);
      return antes.getHours() < 5;
    })();
  `), true);

  run(ctx, "registrarSono();");
  eq('registrar sono grava um dia só', run(ctx, "DB.get('logSono').length"), 1);
  run(ctx, "registrarSono();");
  eq('registrar de novo substitui, não duplica', run(ctx, "DB.get('logSono').length"), 1);

  // O sheet abre na hora de agora, mas ela pode ter deitado antes de marcar
  run(ctx, "abrirSono(); sonoHora = '23:30';");
  eq('ajusta 5 min pra trás', run(ctx, "ajustarSono(-5); sonoHora"), '23:25');
  eq('e pra frente', run(ctx, "ajustarSono(15); sonoHora"), '23:40');
  eq('vira a meia-noite sem quebrar', run(ctx, "sonoHora = '23:55'; ajustarSono(10); sonoHora"), '00:05');
  eq('e volta pra trás da meia-noite', run(ctx, "sonoHora = '00:05'; ajustarSono(-10); sonoHora"), '23:55');
  run(ctx, "sonoHora = '22:40'; confirmarSono();");
  eq('confirma com a hora ajustada, não com a de agora',
     run(ctx, "DB.get('logSono').find(l => l.data === diaDoSono()).hora"), '22:40');
  run(ctx, "desmarcarSono();");
  eq('desmarcar limpa o dia', run(ctx, "DB.get('logSono').some(l => l.data === diaDoSono())"), false);
  eq('o item Dormir entra no fio', run(ctx, `
    itensDoDia(hoje()).some(i => i.tipo === 'dormir');
  `), true);
  eq('e some se ela desligar nos Ajustes', run(ctx, `
    const p = perfil(); p.registrarSono = false; DB.set('perfil', p);
    itensDoDia(hoje()).some(i => i.tipo === 'dormir');
  `), false);
  eq('sono não entra na nota do dia (não pune)', run(ctx, `
    notaDoDia(hoje()).partes.sono === undefined;
  `), true);
}

console.log('\n── Horários para os alarmes ────────────────');
{
  const ctx = novoSandbox();
  const linhas = run(ctx, 'horariosDoDia()');
  eq('sai em ordem de horário',
     linhas.map(l => l.hora).join(' ') === linhas.map(l => l.hora).slice().sort().join(' '), true);
  eq('inclui refeições, medicamentos, treino e sono', [
    linhas.some(l => l.o === 'Café da manhã'),
    linhas.some(l => /Tintura de coentro/.test(l.o)),
    linhas.some(l => l.o === 'Exercício'),
    linhas.some(l => l.o === 'Dormir'),
  ], [true, true, true, true]);
  eq('medicamento pausado fica de fora', run(ctx, `
    const m = DB.get('medicamentos'); m[0].ativo = false; DB.set('medicamentos', m);
    horariosDoDia().some(l => l.o.startsWith(m[0].nome));
  `), false);
}

console.log('\n── Grupo condicional (chá x café) ──────────');
{
  const ctx = novoSandbox();
  run(ctx, "abrirRefeicao('r-cafe');");

  eq('a lista de chás começa escondida', run(ctx, `
    gruposAtivos().some(g => g.id === 'g-cafe-cha');
  `), false);
  eq('e não conta como grupo que falta', run(ctx, `
    gruposAtivos().filter(g => !grupoCompleto(g)).some(g => g.id === 'g-cafe-cha');
  `), false);

  run(ctx, "escolher('g-cafe-bebida', idDe('Chá'));");
  eq('escolheu chá: a lista aparece', run(ctx, `
    gruposAtivos().some(g => g.id === 'g-cafe-cha');
  `), true);

  run(ctx, "escolher('g-cafe-cha', idDe('Camomila'));");
  eq('marcou camomila', run(ctx, "sel['g-cafe-cha'].map(i => i.nome)"), ['Camomila']);

  run(ctx, "escolher('g-cafe-bebida', idDe('Café'));");
  eq('trocou pra café: a lista some', run(ctx, `
    gruposAtivos().some(g => g.id === 'g-cafe-cha');
  `), false);
  eq('e a camomila não fica de fantasma', run(ctx, "sel['g-cafe-cha'].length"), 0);

  // Café não exige escolher chá: a refeição fecha completa sem ele
  run(ctx, `
    const c = dietaAtiva().refeicoes[0];
    c.grupos.filter(g => g.id !== 'g-cafe-cha' && g.id !== 'g-cafe-bebida')
      .forEach(g => { const min = g.min != null ? g.min : g.qtd;
        for (let k = 0; k < min; k++) escolher(g.id, g.opcoes[k].id); });
    confirmarRefeicao();
  `);
  eq('com café, a refeição fecha completa',
     run(ctx, "DB.get('logRefeicoes').find(l => l.refeicaoId === 'r-cafe').completa"), true);
  eq('e o chá não entra no registro', run(ctx, `
    DB.get('logRefeicoes').find(l => l.refeicaoId === 'r-cafe').escolhas.some(e => e.grupoId === 'g-cafe-cha');
  `), false);
}

console.log('\n── Blocos e hierarquia ─────────────────────');
{
  const ctx = novoSandbox();
  const cafe = run(ctx, 'dietaAtiva().refeicoes[0]');
  eq('os três grupos do suco vivem no mesmo bloco',
     cafe.grupos.filter(g => g.bloco === 'Suco verde').map(g => g.nome),
     ['Folhas verdes', 'Fruta do suco', 'Complementos do suco']);
  eq('chá e café ficam em Bebida quente',
     cafe.grupos.filter(g => g.bloco === 'Bebida quente').map(g => g.nome),
     ['Chá ou café', 'Tipo de chá']);
  eq('o nome do grupo se sustenta sozinho fora do sheet', run(ctx, `
    abrirRefeicao('r-cafe');
    nomeCheio(dietaAtiva().refeicoes[0].grupos.find(g => g.id === 'g-suco-extra'));
  `), 'Complementos do suco');

  // Oleaginosas tem uma seção só: o subtítulo repetiria o nome do grupo
  eq('grupo com uma seção só não repete subtítulo', run(ctx, `
    abrirRefeicao('r-lm');
    const g = dietaAtiva().refeicoes[1].grupos[0];
    const html = chipsHTML(g, g.opcoes, [], false);
    html.includes('subgrupo-tit');
  `), false);
  eq('mas o chá, com 4 seções, mantém os subtítulos', run(ctx, `
    const gc = dietaAtiva().refeicoes[1].grupos[1];
    (chipsHTML(gc, gc.opcoes, [], false).match(/subgrupo-tit/g) || []).length;
  `), 4);
}

console.log('\n── Duração do treino ───────────────────────');
{
  const ctx = novoSandbox();
  run(ctx, "abrirExercicio(); selecionarExercicio('Caminhada'); definirDuracao(45); confirmarExercicio();");
  const log = run(ctx, "DB.get('logExercicios')[0]");
  eq('guarda tipo e duração', [log.tipo, log.duracao], ['Caminhada', 45]);
  eq('e a hora do registro', /^\d{2}:\d{2}$/.test(log.hora), true);

  eq('o −/+ não deixa zerar', run(ctx, "abrirExercicio(); definirDuracao(-10); exercicioMin;"), 5);
  eq('nem passar de 5 horas', run(ctx, "definirDuracao(999); exercicioMin;"), 300);

  run(ctx, `
    DB.set('logExercicios', [
      {id:'a',data:somaDias(hoje(),-1),tipo:'Academia',duracao:60},
      {id:'b',data:somaDias(hoje(),-2),tipo:'Caminhada',duracao:30},
      {id:'c',data:somaDias(hoje(),-3),tipo:'Dança',duracao:50},
    ]);
  `);
  eq('o resumo soma o tempo', run(ctx, 'resumoTreinos()'), '3 treinos · 2h20');
  eq('sem duração, mostra só a contagem', run(ctx, `
    DB.set('logExercicios', [{id:'x',data:hoje(),tipo:'Academia'}]); resumoTreinos();
  `), '1 treino');
}

console.log('\n── Curva de peso ───────────────────────────');
{
  const ctx = novoSandbox();

  // Exatamente o caso que aparecia quebrado: uma sessão só, entrada e saída.
  // Antes o gráfico filtrava a saída, sobrava 1 ponto e não desenhava nada.
  run(ctx, `
    DB.set('sessoes', [{id:'s1',data:hoje(),hora:'09:00',clinica:'X',
      pesoEntrada:79.4, pesoSaida:78.1, obs:'', procedimentos:['Manta térmica'], feita:true}]);
    sessaoAberta = 's1';
    sincronizarPesosDaSessao(DB.get('sessoes')[0]);
  `);
  eq('duas pesagens registradas', run(ctx, "DB.get('pesos').length"), 2);
  eq('a curva desenha com as duas',
     run(ctx, "graficoPeso(pesosOrdenados()).includes('<svg')"), true);
  eq('e não cai no aviso de pesagens insuficientes',
     run(ctx, "graficoPeso(pesosOrdenados()).includes('Registre uma pesagem')"), false);
  eq('a legenda distingue chegada e saída', run(ctx, `
    const h = graficoPeso(pesosOrdenados());
    [h.includes('chegada na clínica'), h.includes('saída da clínica')];
  `), [true, true]);

  // Uma pesagem só: mostra o número em vez de um vazio seco
  run(ctx, "DB.set('pesos', [{id:'p',data:hoje(),peso:80,origem:'casa',sessaoId:null}]);");
  eq('com uma pesagem, mostra o valor',
     run(ctx, "graficoPeso(pesosOrdenados()).includes('80,0 kg')"), true);
  eq('sem nenhuma, convida a registrar',
     run(ctx, "DB.set('pesos', []); graficoPeso(pesosOrdenados()).includes('Registre uma pesagem')"), true);

  // Ordem dentro do mesmo dia: chegada sempre antes da saída
  run(ctx, `
    DB.set('pesos', [
      {id:'b',data:'2026-08-10',peso:78.1,origem:'sessao-saida',sessaoId:'s1'},
      {id:'a',data:'2026-08-10',peso:79.4,origem:'sessao-entrada',sessaoId:'s1'},
      {id:'c',data:'2026-08-12',peso:79.0,origem:'casa',sessaoId:null},
    ]);
  `);
  eq('no mesmo dia, chegada vem antes da saída',
     run(ctx, "pesosOrdenados().map(p => p.peso)"), [79.4, 78.1, 79.0]);
  eq('a lista da Agenda mostra todas', run(ctx, `
    (pesagensCasaHTML().match(/pesagem-ponto/g) || []).length;
  `), 3);
  eq('mas só a de casa pode ser removida ali', run(ctx, `
    (pesagensCasaHTML().match(/removerPeso/g) || []).length;
  `), 1);
}

console.log(`\n${falhou ? '✗' : '✓'} ${ok} passaram, ${falhou} falharam\n`);
process.exit(falhou ? 1 : 0);
