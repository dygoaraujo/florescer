# Como colocar o Florescer no celular da Lorena

São 5 passos. Do começo ao fim leva uns 20 minutos, e você só faz uma vez.

Do passo 1 ao 3 é no computador. O passo 4 é no seu celular ou no PC. O passo 5
é no iPhone dela.

---

## 1. Subir para o GitHub

O repositório local já está pronto, com todos os commits. Falta só criar o
repositório vazio no GitHub e apontar para ele.

1. Vá em **[github.com/new](https://github.com/new)**
2. Nome: `florescer`
3. Marque **Private**
4. **NÃO** marque "Add a README", "Add .gitignore" nem licença — o repositório
   precisa nascer vazio, senão dá conflito
5. Clique em **Create repository**

Depois, no terminal, dentro de `R:\Claude Projects\florescer`:

```bash
git remote add origin https://github.com/dygoaraujo/florescer.git
```

```bash
git push -u origin main
```

Se pedir login, use seu usuário do GitHub e um **token** como senha (o mesmo
tipo de token do passo 3 — GitHub não aceita mais senha de conta no push).

---

## 2. Publicar na Vercel

1. Vá em **[vercel.com/new](https://vercel.com/new)**
2. **Import** o repositório `florescer`
3. Nas configurações do projeto:
   - **Framework Preset:** `Other`
   - **Build Command:** deixe vazio
   - **Output Directory:** deixe vazio
   - **Install Command:** deixe vazio
4. **Deploy**

Não tem build: é HTML, CSS e JS puro, a Vercel só serve os arquivos.

Quando terminar, entre em **Settings → Domains** e troque o nome automático por
algo que ela reconheça, tipo `florescer-lorena.vercel.app`.

**A partir daqui, todo `git push` republica o app sozinho.**

---

## 3. Criar o token do GitHub (para o backup na nuvem)

Esse token é o que deixa os dados dela subirem para um Gist privado seu. É o
seguro contra o iPhone limpar o app.

1. Vá em **[github.com/settings/tokens](https://github.com/settings/tokens)**
   → **Generate new token** → **Tokens (classic)**
2. Note: `florescer`
3. Expiration: **No expiration** (se expirar, o sync para de funcionar sem avisar)
4. Marque **apenas** o escopo **`gist`** — nada mais
5. **Generate token** e **copie na hora**. O GitHub não mostra de novo.

Guarde num lugar seguro. Você vai colar esse token duas vezes: no passo 4 e no 5.

---

## 4. Criar o Gist (uma vez só, no seu aparelho)

Abra o app publicado na Vercel, no computador mesmo:

1. **Ajustes** → role até **Cópia na nuvem** → **Configurar**
2. Cole o **token**. Deixe o campo **ID do Gist vazio**.
3. **Salvar**
4. Toque em **Enviar agora**

O app cria o Gist privado e mostra o **ID do Gist** na tela. **Copie esse ID** —
é ele que liga os dois aparelhos aos mesmos dados.

---

## 5. Instalar no iPhone dela

Esta é a parte que mais importa acertar.

1. No **Safari** (não no Chrome), abra a URL da Vercel
2. Toque no botão **Compartilhar** (o quadrado com a seta para cima)
3. **Adicionar à Tela de Início** → **Adicionar**
4. **Feche o Safari e abra o app pelo ícone na tela de início.**

> **Isso não é frescura.** O iPhone apaga o armazenamento de sites que ficam
> só numa aba do Safari depois de uns dias sem uso. Um app adicionado à tela
> de início é tratado como app de verdade e mantém os dados. Peça a ela para
> usar **sempre pelo ícone**.

Com o app aberto pelo ícone:

5. **Ajustes** → **Cópia na nuvem** → **Configurar**
6. Cole o **token** e o **ID do Gist** do passo 4
7. **Salvar**
8. Toque em **Puxar da nuvem** — **antes de qualquer outra coisa**

> **Por que puxar primeiro:** o envio automático só liga depois do primeiro
> "Puxar". É essa trava que impede um aparelho recém-instalado (e portanto
> vazio) de sobrescrever o backup bom com nada.

Pronto. Daí em diante tudo que ela registrar sobe sozinho poucos segundos
depois, e você consegue ver os mesmos dados abrindo o app no computador.

---

## 6. Últimos ajustes dentro do app

Em **Ajustes**:

- **Perfil:** peso inicial, peso desejado e data de início do tratamento
- **Metas do dia:** confira a meta de água (3 L) e o ideal (4 L), os dias de
  treino e o horário
- **Lembretes:** toque em **Copiar horários do dia** e cadastre os alarmes no
  app **Relógio** do iPhone — o app não consegue tocar alarme sozinho

Em **Agenda**: toque nos dias do calendário para marcar as sessões da clínica.

---

## Manutenção

**Para publicar uma mudança:** commit e `git push`. A Vercel republica em
segundos. No iPhone, feche e abra o app pelo ícone.

**Backup em arquivo:** de vez em quando, em Ajustes → **Baixar backup**. É uma
cópia independente do Gist, que fica no seu computador. O card de sync mostra
há quantos dias foi o último.

**Se o token vazar ou você quiser trocar:** gere outro em github.com/settings/tokens
e troque nos dois aparelhos. O **ID do Gist não muda** quando o token muda.

**Se um dia parecer que sumiu tudo:** não toque em "Enviar". Vá em
**Puxar da nuvem** — os dados voltam do Gist.
