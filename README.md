# Neo Store Multimarcas

Loja virtual + painel do administrador. Next.js 14 (App Router), Supabase e Mercado Pago, pronta para a Vercel.

- **Instalação passo a passo (contas, banco, Vercel):** veja [`LEIA-ME.md`](./LEIA-ME.md).
- **Rodar no computador:** `cp .env.example .env.local`, preencha as chaves, depois `npm install` e `npm run dev`. A loja abre em `http://localhost:3000` e o painel em `/admin`.

## Estrutura

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
│       └── admin/notify/            POST e-mail de "enviado/entregue" (só administradores)
├── lib/
│   ├── config.js                    Marcas, subcategorias, WhatsApp, PIX, parcelas, status
│   ├── format.js                    Moeda, datas e números
│   ├── supabase-browser.js          Cliente Supabase do navegador (painel)
│   ├── supabase-server.js           Cliente Supabase com chave secreta (só servidor)
│   ├── mercadopago.js               PIX, checkout de cartão/boleto, consulta e assinatura do webhook
│   ├── shipping.js                  Cotação Melhor Envio
│   ├── email.js                     E-mails pelo Resend
│   ├── api.js                       Respostas padrão das rotas
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
├── next.config.mjs                  "/" → loja.html e noindex no painel
└── .env.example                     Variáveis de ambiente
```

## Onde mexer para…

| Quero… | Arquivo |
|---|---|
| Adicionar uma marca ou subcategoria | `lib/config.js`, `public/loja/js/config.js` e o `check` de `brand`/`category` em `supabase/schema.sql` |
| Mudar desconto do PIX ou número de parcelas | `lib/config.js` (servidor) e os textos em `public/loja.html` / `public/loja/js/checkout.js` |
| Trocar o WhatsApp da loja | `lib/config.js` e `public/loja/js/config.js` |
| Mudar cores ou fontes da loja | `public/loja/css/base.css` |
| Mudar textos da página inicial | `public/loja.html` |
| Mudar o texto "Atenção às entregas" | `public/loja/js/checkout.js` (função `renderCo`) |
| Mudar os e-mails enviados | `lib/email.js` |
| Mudar o tamanho padrão da embalagem | variáveis `PKG_*` na Vercel |
| Cores do painel | `app/admin/styles/base.css` |

## Como as partes se conversam

1. A loja (`public/loja/js/main.js`) busca peças em `/api/products` e entregas em `/api/shipping`.
2. No checkout, `/api/checkout` lê os preços do banco, aplica cupom, frete e desconto do PIX, grava o pedido e cria o pagamento no Mercado Pago.
   - **PIX:** devolve o QR Code e a loja fica consultando `/api/orders/[id]` até o pagamento ser confirmado.
   - **Cartão e boleto:** a cliente vai para o Mercado Pago e volta para `/pedido/[id]`.
3. O Mercado Pago avisa `/api/webhooks/mercadopago`, que marca o pedido como pago, baixa o estoque e envia os e-mails.
4. O painel recebe a mudança na hora pelo Supabase Realtime (som, aviso na tela e sininho).

## Regras importantes

- A chave `SUPABASE_SERVICE_ROLE_KEY` e o token do Mercado Pago **só existem no servidor**. Nunca use em `public/` nem em arquivos com `'use client'`.
- Preço, cupom e frete **sempre** são recalculados no servidor. O navegador só envia ids, tamanhos e quantidades.
- O acesso ao painel é protegido pelas regras do banco (RLS): mesmo que alguém abra `/admin`, só quem está na tabela `admins` consegue ler pedidos ou editar produtos.
- Os scripts da loja são JavaScript simples, sem etapa de build: o que está em `public/loja/js` é exatamente o que roda no navegador. Mantenha a ordem dos `<script>` no fim de `loja.html`.
