# Florescer

Companheiro diário do tratamento da Lorena — plano alimentar, água, medicamentos,
treino, sessões na clínica e evolução de peso.

O app responde a uma pergunta: **"qual é a próxima coisa que eu preciso fazer?"**

Uso quase inteiro no iPhone. Se não for bonito e fácil, ela larga — isso guia
toda decisão de interface.

## Como rodar aqui

```bash
node .claude/static-server.mjs
```

Abre em `http://localhost:3334`. Não tem build nem dependência: HTML, CSS e JS
puro, dados no `localStorage`.

## Testes

```bash
node .claude/testes.mjs
```

129 testes headless da lógica que não é visual: nota do dia, sequência,
relatório semanal, migração do plano, merge do sync, grupos condicionais.

## Publicar

Veja [DEPLOY.md](DEPLOY.md) — GitHub, Vercel, token do Gist e instalação no
iPhone, passo a passo.

## Estrutura

```
index.html          casca, tab bar, sheets e modais
style.css           sistema visual (pastel: rosa, lavanda, céu, ouro)
sw.js               service worker (rede primeiro, cache como reserva)
js/core.js          DB, datas, medidas, SEED do plano da clínica, migração
js/hoje.js          o Fio do Dia, card de água, sheets de registro
js/alimentacao.js   consulta: hoje, histórico e plano ativo
js/progresso.js     peso, sequência, gráficos SVG, conquistas
js/relatorio.js     relatório semanal (segunda a sábado)
js/agenda.js        calendário, sessões da clínica, pesagens
js/ajustes.js       editor do plano, medicamentos, metas, backup
js/sync.js          cópia na nuvem num Gist privado
```

## Duas regras que não podem ser quebradas

**Mudou o `SEED`?** Suba o `SEED_VERSAO` em `js/core.js`. O `iniciarDB()` só
semeia chave que ainda não existe — sem subir a versão, quem já abriu o app
fica preso no plano antigo para sempre.

**Chave de dado nova?** Adicione em `CHAVES_DADOS` (`js/core.js`). É a fonte
única do que sincroniza e do que entra no backup. Esquecer ali significa um
módulo que silenciosamente não sobe para a nuvem.
