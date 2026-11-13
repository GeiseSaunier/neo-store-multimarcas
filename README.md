# Neo Store Multimarcas · loja + painel do administrador

Este projeto tem três partes que funcionam juntas:

- **A loja** (`/`): o site que as clientes veem, com vitrine, sacola e checkout.
- **O painel** (`/admin`): onde vocês cadastram peças e acompanham pedidos, pagamentos, crediário, custo e lucro.
- **Os serviços externos**: Supabase (banco de dados, login e fotos), Vercel (hospedagem), Mercado Pago (cartão e boleto), Melhor Envio (frete dos Correios, opcional) e Resend (e-mails, opcional).

---

# Colocar a loja no ar (passo a passo)

Siga **na ordem**. Na primeira vez leva cerca de uma hora e meia. Cada etapa diz se é **obrigatória** ou **opcional**.

> **Atenção à ordem:** a Vercel publica o site assim que o repositório é ligado a ela. Por isso o banco (etapa 1) e as variáveis (etapa 4) vêm **antes** do primeiro deploy. Sem eles, o build falha ou o checkout quebra.

### Resumo

| # | Etapa | Obrigatória? |
|---|---|---|
| 1 | Supabase: banco, administrador e segurança do login | Sim |
| 2 | Mercado Pago: cartão e boleto | Sim, para aceitar cartão ou boleto |
| 3 | Resend (e-mails) e Melhor Envio (Correios) | Opcional |
| 4 | Vercel: variáveis e primeiro deploy | Sim |
| 5 | Domínio próprio e endereços finais | Sim (ou use o endereço `.vercel.app`) |
| 6 | Dados da loja: empresa, entregas, peças e estoque | Sim |
| 7 | Compra de teste e limpeza | Sim |
| 8 | Abrir para as clientes | — |

---

## 1. Supabase: banco de dados, login e fotos (obrigatória)

### 1.1 Criar o projeto e o banco

1. Crie uma conta em **supabase.com** e clique em **New project**. Escolha a região **São Paulo** e guarde a senha do banco num lugar seguro.
2. No menu lateral, abra **SQL Editor > New query**.
3. Abra o arquivo `supabase/schema.sql` deste projeto, copie **todo** o conteúdo, cole no editor e clique em **Run**.
   Isso cria as tabelas (pedidos, peças, crediário, custo e lucro, promoções etc.), as regras de segurança, o espaço das fotos, as opções de entrega, o cupom BEMVINDA (só na primeira compra) e as 6 bolsas iniciais.
   - Pode rodar de novo sempre que o arquivo mudar: ele só acrescenta o que falta e não apaga dados.
   - Se o banco já existia de uma versão antiga, apague depois o cupom **NEO10** (Painel > Cupons).
4. Abra **Project Settings > API** e anote três valores (eles vão para a Vercel na etapa 4):
   - **Project URL**
   - **anon public** (chave pública)
   - **service_role** (chave secreta: nunca compartilhe nem coloque no site)

### 1.2 Criar o acesso do administrador

1. Abra **Authentication > Users > Add user > Create new user**. Informe o e-mail e uma senha forte e marque **Auto Confirm User**.
2. Copie o **User UID** que aparece na lista.
3. Volte ao **SQL Editor** e rode, trocando pelo UID copiado:

   ```sql
   insert into public.admins (user_id) values ('COLE-O-UID-AQUI');
   ```

Repita para cada pessoa que vai usar o painel.

### 1.3 Segurança do login

- **Bloquear cadastros públicos:** em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**. Os acessos ao painel são criados só por vocês, como no passo acima.
- **Recuperação de senha:** em **Authentication > URL Configuration**, coloque o endereço do site em **Site URL** (ex.: `https://www.neostore.com.br`) e adicione `https://www.neostore.com.br/admin/login` em **Redirect URLs**. Se ainda não tiver o domínio, use o endereço da Vercel e troque na etapa 5.

---

## 2. Mercado Pago: cartão e boleto

**O PIX não precisa do Mercado Pago.** O checkout gera o QR Code e o copia e cola com a chave da loja (CNPJ 32.315.010/0001-02, Vanessa Neo Gomes · Nubank), o valor exato e um identificador (`NEO` + número do pedido). A confirmação é **manual**: quando o PIX cair na Nubank (a cliente também manda o comprovante pelo WhatsApp), abra o pedido no painel e use **Marcar como pago**. A cliente recebe o e-mail e a tela dela muda sozinha. A chave fica em `PIX` (`lib/config.js` e `public/loja/js/config.js`); com `direct: false`, o PIX volta a ser pelo Mercado Pago, com confirmação automática.

> **Importante:** cartão e boleto **aparecem no checkout mesmo sem o Mercado Pago configurado**, e a cliente recebe um erro ao finalizar. Não abra a loja para as clientes sem concluir esta etapa (ou peça para esconder cartão e boleto).

1. Entre na sua conta Mercado Pago (conta de vendedor) e acesse **Suas integrações** em mercadopago.com.br/developers.
2. Crie uma aplicação do tipo **Pagamentos online**.
3. Copie o **Access Token**: primeiro o das **Credenciais de teste** (para a etapa 7) e, depois, o das **Credenciais de produção** (para a etapa 8).
4. Em **Webhooks**, configure:
   - **URL**: `https://SEU-SITE/api/webhooks/mercadopago` (o endereço final da etapa 5)
   - **Evento**: marque **Pagamentos**
   - Salve e copie a **Assinatura secreta**.
5. Nas configurações de vendas da conta, confira se o parcelamento em até 3x está como **sem juros para o comprador**.

O parcelamento está limitado a 3x e o desconto do PIX é de 5%. Para mudar, edite `lib/config.js`.

---

## 3. E-mails e Correios (opcionais)

### 3.1 Resend: e-mails de aviso

Sem esta etapa a loja funciona e os avisos aparecem no painel, mas ninguém recebe e-mail.

1. Crie uma conta em **resend.com** e adicione o domínio da loja em **Domains** (siga as instruções de DNS no lugar onde o domínio foi comprado).
2. Em **API Keys**, crie uma chave.
3. Defina quem envia (ex.: `Neo Store <pedidos@neostore.com.br>`) e quem recebe os avisos de pedido.

E-mails enviados:
- **Para vocês:** novo pedido, pagamento confirmado e alertas de erro.
- **Para a cliente:** pedido recebido (com link para pagar), pagamento confirmado, pedido enviado (com rastreio) e pedido entregue.

### 3.2 Melhor Envio: PAC e SEDEX

Sem esta etapa, a loja funciona só com as entregas regionais (Parintins, Maués, Manaus, barco).

1. Crie uma conta em **melhorenvio.com.br**.
2. Em **Integrações > Permissões de acesso**, gere um token com permissão de **cálculo de frete** (`shipping-calculate`).
3. Anote o token e o CEP de onde os pedidos saem.

As medidas padrão da embalagem são 15 × 35 × 40 cm e 1 kg por peça. Ajuste nas variáveis `PKG_...`, se preferir.

---

## 4. Vercel: variáveis e primeiro deploy (obrigatória)

O código já está no GitHub (repositório `neo-store-multimarcas`, ramo `main`).

1. Em **vercel.com**, entre com a conta do GitHub e clique em **Add New > Project**. Escolha o repositório. A Vercel reconhece o Next.js sozinha.
2. **Antes de clicar em Deploy**, abra **Environment Variables** e cadastre as variáveis abaixo (os nomes estão também em `.env.example`):

| Variável | Onde pegar | Obrigatória? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Endereço do site, sem barra no final (ex.: `https://www.neostore.com.br`) | Sim |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project URL | Sim (sem ela, o build falha) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > anon public | Sim (sem ela, o build falha) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > service_role | Sim |
| `CRON_SECRET` | Invente uma senha longa (ex.: num gerador de senhas). A rotina diária usa para cancelar pedidos abandonados e limpar fotos sem uso | Sim |
| `MP_ACCESS_TOKEN` | Mercado Pago > Access Token (comece com o **de teste**) | Para cartão e boleto |
| `MP_WEBHOOK_SECRET` | Mercado Pago > Webhooks > Assinatura secreta | Para cartão e boleto |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAILS` | Resend | Opcional |
| `MELHOR_ENVIO_TOKEN`, `MELHOR_ENVIO_EMAIL`, `STORE_CEP` | Melhor Envio | Opcional |
| `PKG_HEIGHT_CM`, `PKG_WIDTH_CM`, `PKG_LENGTH_CM`, `PKG_WEIGHT_KG` | Medidas da embalagem | Opcional |

3. Clique em **Deploy** e espere terminar (2 a 4 minutos). A Vercel mostra um endereço `https://….vercel.app`.
4. Abra o endereço: a loja deve aparecer com as peças. Abra `/admin` e entre com o usuário da etapa 1.2.

Daqui em diante, **cada envio para o ramo `main` do GitHub publica o site sozinho**. A rotina diária (`vercel.json`) já fica ligada.

> Mudou alguma variável depois? Ela só passa a valer depois de um novo deploy: **Deployments > ⋯ > Redeploy**.

---

## 5. Domínio próprio e endereços finais (obrigatória)

1. Na Vercel, abra **Settings > Domains**, adicione `www.neostore.com.br` (e `neostore.com.br`) e siga as instruções de DNS no lugar onde o domínio foi comprado. Pode levar algumas horas para começar a valer.
2. Com o domínio funcionando, confira se o endereço final está igual em **todos** estes lugares:
   - Vercel > `NEXT_PUBLIC_SITE_URL` (depois faça **Redeploy**)
   - Supabase > Authentication > URL Configuration (Site URL e Redirect URLs)
   - Mercado Pago > Webhooks > URL (`https://www.neostore.com.br/api/webhooks/mercadopago`)

---

## 6. Dados da loja (obrigatória)

1. **Empresa:** confira nome, CNPJ, cidades, e-mail e Instagram em **dois arquivos**: `lib/config.js` e `public/loja/js/config.js` (objeto `LEGAL`). Eles aparecem no rodapé, nas páginas de informação e no PDF do relatório de vendas. O **e-mail está vazio** até a loja ter um e-mail com domínio próprio; enquanto estiver vazio, ele não aparece no site.
2. **Textos legais:** revise `content/trocas.md`, `content/privacidade.md` e `app/(info)/pagamentos/page.js`. Eles seguem o Código de Defesa do Consumidor e a LGPD, mas vale uma revisão com o contador ou o advogado da loja.
3. **Entregas:** em Painel > Entregas, confira cidades, valores e descrições. Eles aparecem sozinhos no trajeto da página inicial e na sacola.
4. **Peças e estoque:** em Painel > Produtos, confira as peças e as fotos e **preencha o estoque** de cada uma (as 6 bolsas iniciais vêm sem controle de estoque). Peça sem estoque preenchido nunca esgota.
5. **Custo das peças (opcional, para o lucro):** em Painel > Custo e lucro > Compras e estoque, lance as compras de mercadoria. Assim o lucro de cada venda aparece certo.

Mudou algo nos arquivos? Envie para o GitHub e a Vercel publica sozinha.

---

## 7. Compra de teste e limpeza (obrigatória)

Com o **token de teste** do Mercado Pago:

1. Cadastre uma peça com foto e confira se ela aparece na loja.
2. Faça uma compra com **PIX**: o QR Code deve aparecer. No painel, abra o pedido e use **Marcar como pago**. A tela da cliente deve mudar sozinha.
3. Faça uma compra com **cartão de teste** (o Mercado Pago lista os cartões de teste em Suas integrações). O pedido deve virar **Pago** sozinho.
4. Confira se os e-mails chegam (se configurou o Resend).
5. Marque um pedido como **Enviado**, com código de rastreio, e veja se o e-mail chega para a cliente.
6. Em **Custo e lucro**, confira se as vendas aparecem e teste **Imprimir ou salvar em PDF**.

**Limpeza dos testes:** o painel ainda não apaga pedidos. Cancele os pedidos de teste no painel (o estoque volta) ou apague-os no Supabase, em **Table Editor > orders**. Apague também as vendas de teste em Custo e lucro (botão **Apagar**) e confira o estoque das peças.

---

## 8. Abrir para as clientes

1. Na Vercel, troque `MP_ACCESS_TOKEN` (e `MP_WEBHOOK_SECRET`, se mudou) pelos de **produção** e faça **Redeploy**.
2. Faça uma compra real pequena com cartão e estorne pelo Mercado Pago, para confirmar que está tudo certo.
3. Divulgue o endereço.

### Lista final antes de divulgar

- [ ] `supabase/schema.sql` mais recente rodado no Supabase
- [ ] Usuário administrador criado e cadastros públicos desligados
- [ ] Todas as variáveis obrigatórias cadastradas na Vercel e o deploy concluído
- [ ] Domínio próprio funcionando, com o mesmo endereço na Vercel, no Supabase e no webhook do Mercado Pago
- [ ] Token de **produção** do Mercado Pago na Vercel (ou cartão e boleto escondidos)
- [ ] Estoque preenchido em todas as peças e entregas conferidas
- [ ] Compra de teste com PIX e com cartão funcionando, e pedidos de teste limpos

### Se algo der errado

| Sintoma | O que conferir |
|---|---|
| O build falha na Vercel | `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` cadastradas |
| A loja abre sem peças | `SUPABASE_SERVICE_ROLE_KEY` e se o `schema.sql` foi rodado |
| O checkout dá erro | `schema.sql` mais recente rodado; no cartão e no boleto, `MP_ACCESS_TOKEN` |
| Cartão pago não vira **Pago** | URL e assinatura do webhook no Mercado Pago e `MP_WEBHOOK_SECRET` |
| Não consigo entrar no painel | Usuário criado com **Auto Confirm** e UID inserido na tabela `admins` |
| O link de recuperar senha abre o endereço errado | Site URL e Redirect URLs no Supabase |
| Os e-mails não chegam | `RESEND_API_KEY` e domínio verificado no Resend |
| PAC e SEDEX não aparecem | `MELHOR_ENVIO_TOKEN` e `STORE_CEP` |

---

## Uso do dia a dia

- **Cadastrar peça:** Painel > Produtos > Nova peça. Fotos tiradas no celular são reduzidas automaticamente.
- **Roupas e marcas avulsas:** escolha a marca **Outras marcas** e digite o nome da marca da peça. Ela aparece na loja pelo atalho **Roupas** do menu. Peças de qualquer marca aparecem também nos atalhos **Calçados** e **Roupas**.
- **Tirar uma peça da loja sem apagar:** desligue **Mostrar na loja**.
- **Fotos:** ao excluir uma peça ou remover uma foto, o arquivo é apagado do Supabase na rotina diária, depois de 24 h, e só se nenhuma peça e nenhum pedido usar aquela foto (pedidos antigos continuam com as miniaturas).
- **Peça esgotada:** coloque estoque 0. Com estoque preenchido, as peças ficam reservadas assim que o pedido é feito e voltam ao estoque se o pedido for cancelado ou o pagamento não for concluído no prazo (PIX: 30 min; cartão: 48 h; boleto: 5 dias).
- **Calçados e peças com tamanhos:** o estoque é preenchido por tamanho na tela da peça.
- **"Combine com":** na janela de cada bolsa e na sacola, a loja sugere sozinha até 2 calçados que combinam (cor parecida, tons neutros, mesma marca e preço parecido) e a cliente leva os dois com um clique. Para a sugestão ficar boa, cadastre as **cores** das bolsas e dos calçados. Só entram calçados com tamanho disponível.
- **PIX direto:** o QR vale 1 hora; o pedido só é cancelado sozinho 1 hora depois de vencer. Se o PIX cair depois do cancelamento, ainda dá para usar **Marcar como pago** no pedido cancelado (se a peça já tiver sido vendida, aparece o alerta de estoque).
- **Pedido novo:** aparece com som e aviso no canto da tela. Para receber aviso mesmo com o painel em outra aba, clique no sininho e em **Ativar**.
- **Promoções:** Painel > Promoções > Nova promoção. Defina o nome (ex.: Black Friday), o desconto em %, a data e hora de início e de fim e as peças. No período, a loja mostra o preço com desconto, o preço riscado e uma faixa na página inicial; no fim, as peças voltam sozinhas ao preço normal. Dá para pausar, retomar, encerrar na hora, editar e excluir. Se uma peça estiver em duas promoções, vale a de maior desconto. **Cupom não vale em peça em promoção:** numa sacola misturada, ele desconta só das peças fora da promoção.
- **Entregas regionais e cupons:** edite em Painel > Entregas e Painel > Cupons. Os valores de entrega aparecem sozinhos na página da loja e na sacola.
- **Cupom de boas-vindas:** marque **Só na primeira compra** para o cupom valer uma única vez por CPF (o BEMVINDA já vem assim). O cadastro de novidades só cita o BEMVINDA enquanto ele estiver ativo.
- **Pedido de exclusão de dados (LGPD):** em Painel > Novidades, use **Excluir** no contato.
- **Relatório do mês:** Painel > Visão geral. Para planilha, use **Exportar planilha** em Pedidos.
- **Custo e lucro:** na aba **Vendas e lucro**, digite quanto pagou e por quanto vendeu: o lucro aparece na hora. **Guardar no relatório** grava a venda (peça do catálogo sai do estoque). As vendas do site entram sozinhas. Escolha o mês para ver o balanço, a peça que mais e a que menos deu lucro, **Imprimir ou salvar em PDF** e **Baixar planilha**. Na aba **Compras e estoque**, lance as compras de mercadoria e veja o que está parado no estoque.
- **Crediário:** Painel > Crediário. Lance a venda a prazo e cada pagamento da cliente; o link do extrato pode ser enviado para ela pelo WhatsApp.

---

## Para desenvolvedores

Next.js 16 (App Router), Supabase e Mercado Pago, pronta para a Vercel.

- **Testes automáticos:** `npm test` (Node 22 ou mais novo). Testam o estoque, os cupons e o limite de tentativas direto no `supabase/schema.sql` (num Postgres em memória, sem precisar do Supabase) e as funções de `lib/`. Rodam sozinhos no GitHub a cada envio (`.github/workflows/testes.yml`).
- **Rodar no computador:** `cp .env.example .env.local`, preencha as chaves, depois `npm install` e `npm run dev`. A loja abre em `http://localhost:3000` e o painel em `/admin`.

### Estrutura

```
neo-store/
├── app/
│   ├── layout.js                    Layout raiz (fontes)
│   ├── admin/                       Painel do administrador (/admin)
│   │   ├── layout.js                Login obrigatório, menu lateral, notificações em tempo real
│   │   ├── _ctx.js                  Contexto compartilhado (cliente Supabase, sessão, avisos)
│   │   ├── _components/
│   │   │   ├── charts.js            Gráfico por dia, barras e comparação com o mês anterior
│   │   │   ├── OrderDetail.js       Gaveta com detalhes do pedido e mudança de status
│   │   │   └── Chips.js             Campo de etiquetas (tamanhos)
│   │   ├── styles/                  CSS do painel, um arquivo por área (responsive.css por último)
│   │   ├── page.js                  Visão geral (dashboard mensal)
│   │   ├── login/page.js            Entrar e recuperar senha
│   │   ├── pedidos/page.js          Lista de pedidos, filtros e exportação
│   │   ├── produtos/page.js         Lista de peças
│   │   ├── produtos/[id]/page.js    Cadastro e edição de peça (id "nova" para criar)
│   │   ├── lucro/page.js            Custo e lucro: calculadora, relatório de vendas (PDF e planilha), compras e estoque
│   │   ├── crediario/page.js        Vendas a prazo e pagamentos
│   │   ├── promocoes/page.js        Promoções com início e fim
│   │   ├── fretes/page.js           Entregas regionais
│   │   ├── cupons/page.js           Cupons de desconto
│   │   └── assinantes/page.js       Cadastros de novidades
│   ├── pedido/[id]/                 Página de status do pedido (volta do Mercado Pago)
│   ├── crediario/[token]/           Extrato do crediário para a cliente (link secreto)
│   └── api/                         Rotas do servidor
│       ├── products/                GET  peças ativas da vitrine
│       ├── shipping/                GET  entregas regionais (+ se Correios está ligado)
│       ├── shipping/quote/          POST cotação PAC/SEDEX pelo CEP (Melhor Envio)
│       ├── coupons/                 GET  valida cupom
│       ├── checkout/                POST cria pedido e pagamento (recalcula tudo no servidor)
│       ├── orders/[id]/             GET  status público do pedido
│       ├── subscribers/             POST cadastro de novidades
│       ├── webhooks/mercadopago/    POST confirmação de pagamento do Mercado Pago
│       ├── admin/orders/[id]/       POST muda status/rastreio do pedido e envia e-mails (só administradores)
│       └── cron/expire-orders/      GET  cancela pedidos abandonados e apaga fotos sem uso (Vercel Cron, diário)
│   ├── (info)/                      Trocas, pagamentos e privacidade (dados da empresa em lib/config.js)
│   ├── robots.js, sitemap.js        Indexação no Google
├── lib/
│   ├── config.js                    Marcas, subcategorias, WhatsApp, PIX, parcelas, status
│   ├── format.js                    Moeda, datas e números
│   ├── supabase-browser.js          Cliente Supabase do navegador (painel)
│   ├── supabase-server.js           Cliente Supabase com chave secreta (só servidor)
│   ├── mercadopago.js               PIX, checkout de cartão/boleto, consulta e assinatura do webhook
│   ├── shipping.js                  Cotação Melhor Envio
│   ├── email.js                     E-mails pelo Resend
│   ├── api.js                       Respostas padrão das rotas
│   ├── admin.js                     Confere se quem chamou é administrador
│   ├── orders.js                    Expiração de pedidos e mensagens de estoque
│   ├── promo.js                     Preço com promoção (vitrine e checkout usam o mesmo cálculo)
│   ├── pix.js                       Código PIX copia e cola (BR Code do Banco Central)
│   ├── photos.js                    Limpeza segura das fotos sem uso no Storage
│   ├── ratelimit.js                 Limite de tentativas por IP (no banco, função rate_hit)
│   ├── crediario.js                 Contas do crediário (em centavos)
│   ├── lucro.js                     Contas de custo e lucro, calculadora e relatório de vendas
│   ├── lucro-dados.js               Leitura e gravação do Custo e lucro no banco (único ponto de acesso)
│   ├── csv.js                       Exportação de planilhas
│   └── image.js                     Redução de fotos antes do envio
├── public/
│   ├── loja.html                    Estrutura da loja (servida em "/")
│   ├── loja/css/                    Estilos da loja
│   │   ├── base.css                 Cores (tema claro e escuro), fontes, utilitários
│   │   ├── header.css               Faixa do topo, cabeçalho e menu com submenus
│   │   ├── hero.css                 Abertura com o monograma
│   │   ├── sections.css             Marcas, vitrine, benefícios, "a loja", entrega
│   │   ├── footer.css               Cadastro de novidades e rodapé
│   │   ├── overlays.css             Sacola, produto, checkout, busca, avisos
│   │   └── responsive.css           Tablet e celular (sempre por último)
│   ├── loja/js/                     Scripts da loja, carregados nesta ordem:
│   │   ├── config.js                Marcas e WhatsApp
│   │   ├── utils.js                 $, brl, esc, armazenamento local, toast
│   │   ├── state.js                 Produtos, entregas, sacola, favoritos, cupom, filtro
│   │   ├── catalog.js               Vitrine, filtros, favoritos, janela do produto
│   │   ├── cart.js                  Sacola e cupom
│   │   ├── promos.js                Faixa de promoções da página inicial
│   │   ├── look.js                  "Combine com": calçado que combina com a bolsa
│   │   ├── ui.js                    Abrir e fechar janelas, menu do celular, busca
│   │   ├── checkout.js              Dados, entrega, pagamento, PIX
│   │   ├── newsletter.js            Cadastro de novidades
│   │   ├── effects.js               Monograma 3D, revelar ao rolar, tema, destaque do menu
│   │   └── main.js                  Carrega a API e desenha a página
│   ├── brand/                       Monograma, logotipo e padrão da marca
│   └── seed/                        Fotos das 6 peças iniciais
├── supabase/schema.sql              Tabelas, regras de acesso, fotos e dados iniciais
├── scripts/og-tags.mjs              Na Vercel, põe o endereço completo na imagem de prévia do link
├── tests/                           Testes automáticos (npm test)
├── next.config.mjs                  "/" → loja.html, noindex no painel e cabeçalhos de segurança
└── .env.example                     Variáveis de ambiente
```

### Onde mexer para…

| Quero… | Arquivo |
|---|---|
| Adicionar uma marca ou subcategoria | `BRANDS`/`SUBS` em `lib/config.js` e em `public/loja/js/config.js`, e as regras `products_brand_check`/`products_category_check` em `supabase/schema.sql`. Os menus da loja (topo, celular e rodapé) se montam sozinhos |
| Mudar os atalhos de categoria do menu (Calçados, Roupas) | `SHORTCUTS` em `public/loja/js/config.js` |
| Mudar desconto do PIX ou número de parcelas | `lib/config.js` (servidor) e os textos em `public/loja.html` / `public/loja/js/checkout.js` |
| Trocar o WhatsApp da loja | `lib/config.js` e `public/loja/js/config.js` |
| Mudar cores ou fontes da loja | `public/loja/css/base.css` |
| Mudar textos da página inicial | `public/loja.html` |
| Mudar o texto "Atenção às entregas" | `public/loja/js/checkout.js` (função `renderCo`) |
| Mudar o texto da política de privacidade ou de trocas | `content/privacidade.md` e `content/trocas.md` (texto simples: `#`/`##`/`###` para títulos, `- ` para listas, `**negrito**`, `[link](https://...)`; variáveis como `{{whatsapp}}` e `{{empresa}}` viram os dados da loja) |
| Mudar os e-mails enviados | `lib/email.js` |
| Mudar o tamanho padrão da embalagem | variáveis `PKG_*` na Vercel |
| Cores do painel | `app/admin/styles/base.css` |

### Como as partes se conversam

1. A loja (`public/loja/js/main.js`) busca peças em `/api/products` e entregas em `/api/shipping`.
2. No checkout, `/api/checkout` lê os preços do banco, aplica cupom, frete e desconto do PIX, grava o pedido e cria o pagamento no Mercado Pago.
   - **PIX:** devolve o QR Code e a loja fica consultando `/api/orders/[id]` até o pagamento ser confirmado.
   - **Cartão e boleto:** a cliente vai para o Mercado Pago e volta para `/pedido/[id]`.
3. O Mercado Pago avisa `/api/webhooks/mercadopago`, que marca o pedido como pago e envia os e-mails.
   - **Estoque:** é reservado no banco (`reserve_stock`) quando o pedido é criado. A troca de status devolve ou reserva de novo sozinha (gatilho `orders_stock`). Pedidos abandonados são cancelados no próximo checkout e pela rotina diária.
4. O painel recebe a mudança na hora pelo Supabase Realtime (som, aviso na tela e sininho).

### Regras importantes

- **Alertas:** falhas no checkout, no webhook e na rotina diária mandam e-mail para `ADMIN_NOTIFY_EMAILS` (no máximo um a cada 15 minutos por tipo). Se um pagamento chega depois de a peça ter sido vendida para outra cliente, o pedido fica marcado **Sem estoque** no painel e o e-mail de pagamento avisa.
- **Estoque no painel:** se o estoque de uma peça mudar enquanto a tela está aberta (uma venda, por exemplo), o painel não grava o número antigo: avisa e mostra o valor novo.
- **Limite de tentativas:** fica no banco e vale para todos os servidores. Para proteção extra contra ataques grandes, ligue o Firewall da Vercel (Settings > Firewall > Rate Limiting).

- A chave `SUPABASE_SERVICE_ROLE_KEY` e o token do Mercado Pago **só existem no servidor**. Nunca use em `public/` nem em arquivos com `'use client'`.
- Preço, cupom e frete **sempre** são recalculados no servidor. O navegador só envia ids, tamanhos e quantidades.
- O acesso ao painel é protegido pelas regras do banco (RLS): mesmo que alguém abra `/admin`, só quem está na tabela `admins` consegue ler pedidos ou editar produtos.
- Os scripts da loja são JavaScript simples, sem etapa de build: o que está em `public/loja/js` é exatamente o que roda no navegador. Mantenha a ordem dos `<script>` no fim de `loja.html`.
