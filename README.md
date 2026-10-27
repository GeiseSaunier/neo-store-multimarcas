# Neo Store Multimarcas · loja + painel do administrador

Este projeto tem três partes que funcionam juntas:

- **A loja** (`/`): o site que as clientes veem, com vitrine, sacola e checkout.
- **O painel** (`/admin`): onde vocês cadastram peças e acompanham pedidos, pagamentos e vendas do mês.
- **Os serviços externos**: Supabase (banco de dados, login e fotos), Mercado Pago (pagamentos), Melhor Envio (frete dos Correios, opcional) e Resend (e-mails, opcional).

Siga os passos na ordem. Leva cerca de uma hora na primeira vez.

---

## 1. Supabase: banco de dados, login e fotos

1. Crie uma conta em **supabase.com** e clique em **New project**. Escolha a região **São Paulo** e guarde a senha do banco.
2. No menu lateral, abra **SQL Editor > New query**.
3. Abra o arquivo `supabase/schema.sql` deste projeto, copie todo o conteúdo, cole no editor e clique em **Run**.
   Isso cria as tabelas, as regras de segurança, o espaço das fotos, as opções de entrega, o cupom BEMVINDA (só na primeira compra) e as 6 bolsas atuais.
   Se o banco já tinha sido criado com uma versão anterior, apague o cupom **NEO10** em Painel > Cupons (ele não deve mais existir).
4. Abra **Project Settings > API** e anote três valores:
   - **Project URL**
   - **anon public** (chave pública)
   - **service_role** (chave secreta: nunca compartilhe nem coloque no site)

### Criar o acesso do administrador

1. Abra **Authentication > Users > Add user > Create new user**. Informe o e-mail e uma senha e marque **Auto Confirm User**.
2. Copie o **User UID** que aparece na lista.
3. Volte ao **SQL Editor** e rode, trocando pelo UID copiado:

   ```sql
   insert into public.admins (user_id) values ('COLE-O-UID-AQUI');
   ```

Repita esses passos para cada pessoa que vai usar o painel.

### Bloquear cadastros públicos

Em **Authentication > Sign In / Providers**, desligue **Allow new users to sign up**. Os acessos do painel são criados só por vocês, como no passo acima.

### Link de recuperação de senha

Em **Authentication > URL Configuration**, coloque o endereço do site em **Site URL** (ex.: `https://www.neostore.com.br`) e adicione `https://www.neostore.com.br/admin/login` em **Redirect URLs**.

---

## 2. Pagamentos: PIX direto, cartão e boleto (Mercado Pago)

**PIX direto na conta da loja.** O PIX não passa pelo Mercado Pago: o checkout gera o QR Code e o copia e cola com a chave da loja (CNPJ 32.315.010/0001-02, Vanessa Neo Gomes · Nubank), o valor exato e um identificador (`NEO` + número do pedido). A confirmação é **manual**: quando o PIX cair na Nubank (a cliente também manda o comprovante pelo WhatsApp), abra o pedido no painel e use **Marcar como pago**. A cliente recebe o e-mail e a tela dela muda sozinha. A chave e os dados ficam em `PIX` (`lib/config.js` e `public/loja/js/config.js`); com `direct: false` o PIX volta a ser pelo Mercado Pago, com confirmação automática.

**Cartão e boleto** continuam pelo Mercado Pago:

1. Entre na sua conta Mercado Pago (conta de vendedor) e acesse **Suas integrações** em mercadopago.com.br/developers.
2. Crie uma aplicação do tipo **Pagamentos online**.
3. Em **Credenciais de produção**, copie o **Access Token**.
   Para testar antes de vender, use primeiro as **Credenciais de teste**.
4. Em **Webhooks**, configure:
   - **URL**: `https://SEU-SITE/api/webhooks/mercadopago`
   - **Evento**: marque **Pagamentos**
   - Salve e copie a **Assinatura secreta**.

O parcelamento está limitado a 3x e o desconto do PIX é de 5%. Para mudar, edite `lib/config.js`.

Os juros do parcelamento sem juros são configurados na própria conta Mercado Pago. Confira se o parcelamento em até 3x está como "sem juros para o comprador" nas configurações de vendas.

---

## 3. Melhor Envio: PAC e SEDEX (opcional)

Sem esta etapa, a loja funciona só com as entregas regionais (Parintins, Maués, Manaus, barco).

1. Crie uma conta em **melhorenvio.com.br**.
2. Em **Integrações > Permissões de acesso**, gere um token com permissão de **cálculo de frete** (`shipping-calculate`).
3. Anote o token e o CEP de onde os pedidos saem.

As medidas padrão da embalagem são 15 × 35 × 40 cm e 1 kg por peça. Ajuste nas variáveis `PKG_...` se preferir.

---

## 4. Resend: e-mails de aviso (opcional)

Sem esta etapa, os avisos continuam aparecendo no painel, mas ninguém recebe e-mail.

1. Crie uma conta em **resend.com** e adicione o domínio da loja em **Domains** (siga as instruções de DNS).
2. Em **API Keys**, crie uma chave.
3. Defina quem envia (ex.: `Neo Store <pedidos@neostore.com.br>`) e quem recebe os avisos de pedido.

E-mails enviados:
- **Para vocês:** novo pedido e pagamento confirmado.
- **Para a cliente:** pedido recebido (com link para pagar), pagamento confirmado, pedido enviado (com rastreio) e pedido entregue.

---

## 5. Vercel: colocar no ar

1. Suba esta pasta para um repositório no **GitHub** (pode ser privado).
2. Em **vercel.com**, clique em **Add New > Project** e importe o repositório. A Vercel reconhece o Next.js sozinha.
3. Antes de clicar em **Deploy**, abra **Environment Variables** e cadastre as variáveis do arquivo `.env.example`:

| Variável | Onde pegar |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Endereço do site, sem barra no final |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > service_role |
| `MP_ACCESS_TOKEN` | Mercado Pago > Access Token |
| `MP_WEBHOOK_SECRET` | Mercado Pago > Webhooks > Assinatura secreta |
| `MELHOR_ENVIO_TOKEN`, `STORE_CEP`, `MELHOR_ENVIO_EMAIL` | Melhor Envio (opcional) |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_NOTIFY_EMAILS` | Resend (opcional) |
| `CRON_SECRET` | Invente uma senha longa (ex.: gerador de senhas). Usada pela rotina diária que cancela pedidos abandonados |

4. Clique em **Deploy**. Ao terminar, conecte o domínio próprio em **Settings > Domains**.
5. Se o endereço final mudou, atualize `NEXT_PUBLIC_SITE_URL` na Vercel e a URL do webhook no Mercado Pago, e faça um novo deploy.

---

## 6. Dados da empresa e textos legais

Antes de abrir a loja, confira os dados da empresa (nome, CNPJ, cidades, e-mail e Instagram) em **dois arquivos**: `lib/config.js` (objeto `LEGAL`) e `public/loja/js/config.js` (objeto `LEGAL`). Eles aparecem no rodapé da loja e nas páginas de informação.

Depois revise os trechos marcados com `[PREENCHER]` e `[DATA]` em:
- `content/trocas.md` (Trocas e devoluções)
- `content/privacidade.md` (Política de privacidade)
- `app/(info)/pagamentos/page.js` (Formas de pagamento)

Os textos seguem o Código de Defesa do Consumidor e a LGPD, mas vale uma revisão com o contador ou advogado da loja.

---

## 7. Teste antes de abrir para clientes

Com as **credenciais de teste** do Mercado Pago:

1. Entre em `/admin` com o usuário criado.
2. Cadastre uma peça com foto e confira se ela aparece na loja.
3. Faça uma compra com PIX e outra com cartão de teste (o Mercado Pago lista cartões de teste em Suas integrações).
4. Confira se o pedido aparece no painel, se o status muda para **Pago** sozinho e se os e-mails chegam.
5. Marque um pedido como **Enviado** com código de rastreio e veja se a cliente recebe o e-mail.

Quando tudo estiver certo, troque `MP_ACCESS_TOKEN` pelo token de **produção** e faça um novo deploy.

---

## Uso do dia a dia

- **Cadastrar peça:** Painel > Produtos > Nova peça. Fotos tiradas no celular são reduzidas automaticamente.
- **Roupas e marcas avulsas:** escolha a marca **Outras marcas** e digite o nome da marca da peça. Ela aparece na loja pelo atalho **Roupas** do menu. Peças de qualquer marca aparecem também nos atalhos **Calçados** e **Roupas**.
- **Tirar uma peça da loja sem apagar:** desligue **Mostrar na loja**.
- **Fotos:** ao excluir uma peça ou remover uma foto, o arquivo é apagado do Supabase na rotina diária, depois de 24 h, e só se nenhuma peça e nenhum pedido usar aquela foto (pedidos antigos continuam com as miniaturas).
- **Peça esgotada:** coloque estoque 0. Com estoque preenchido, as peças ficam reservadas assim que o pedido é feito e voltam ao estoque se o pedido for cancelado ou o pagamento não for concluído no prazo (PIX: 30 min; cartão: 48 h; boleto: 5 dias).
- **Calçados e peças com tamanhos:** o estoque é preenchido por tamanho na tela da peça.
- **PIX direto:** o QR vale 1 hora; o pedido só é cancelado sozinho 1 hora depois de vencer. Se o PIX cair depois do cancelamento, ainda dá para usar **Marcar como pago** no pedido cancelado (se a peça já tiver sido vendida, aparece o alerta de estoque).
- **Pedido novo:** aparece com som e aviso no canto da tela. Para receber aviso mesmo com o painel em outra aba, clique no sininho e em **Ativar**.
- **Entregas regionais e cupons:** edite em Painel > Entregas e Painel > Cupons. Os valores de entrega aparecem sozinhos na página da loja e na sacola.
- **Cupom de boas-vindas:** marque **Só na primeira compra** para o cupom valer uma única vez por CPF (o BEMVINDA já vem assim). O cadastro de novidades só cita o BEMVINDA enquanto ele estiver ativo.
- **Pedido de exclusão de dados (LGPD):** em Painel > Novidades, use **Excluir** no contato.
- **Relatório do mês:** Painel > Visão geral. Para planilha, use **Exportar planilha** em Pedidos.

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
│   │   ├── fretes/page.js           Entregas regionais
│   │   ├── cupons/page.js           Cupons de desconto
│   │   └── assinantes/page.js       Cadastros de novidades
│   ├── pedido/[id]/                 Página de status do pedido (volta do Mercado Pago)
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
│   ├── pix.js                       Código PIX copia e cola (BR Code do Banco Central)
│   ├── photos.js                    Limpeza segura das fotos sem uso no Storage
│   ├── ratelimit.js                 Limite de tentativas por IP (no banco, função rate_hit)
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
