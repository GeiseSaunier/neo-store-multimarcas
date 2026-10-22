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
   Isso cria as tabelas, as regras de segurança, o espaço das fotos, as opções de entrega, os cupons NEO10 e BEMVINDA e as 6 bolsas atuais.
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

### Link de recuperação de senha

Em **Authentication > URL Configuration**, coloque o endereço do site em **Site URL** (ex.: `https://www.neostore.com.br`) e adicione `https://www.neostore.com.br/admin/login` em **Redirect URLs**.

---

## 2. Mercado Pago: PIX, cartão e boleto

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
- **Para a cliente:** pagamento confirmado, pedido enviado (com rastreio) e pedido entregue.

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

4. Clique em **Deploy**. Ao terminar, conecte o domínio próprio em **Settings > Domains**.
5. Se o endereço final mudou, atualize `NEXT_PUBLIC_SITE_URL` na Vercel e a URL do webhook no Mercado Pago, e faça um novo deploy.

---

## 6. Teste antes de abrir para clientes

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
- **Tirar uma peça da loja sem apagar:** desligue **Mostrar na loja**.
- **Peça esgotada:** coloque estoque 0. Com estoque preenchido, ele baixa sozinho a cada venda paga.
- **Pedido novo:** aparece com som e aviso no canto da tela. Para receber aviso mesmo com o painel em outra aba, clique no sininho e em **Ativar**.
- **Entregas regionais e cupons:** edite em Painel > Entregas e Painel > Cupons.
- **Relatório do mês:** Painel > Visão geral. Para planilha, use **Exportar planilha** em Pedidos.

## Para desenvolvedores

O mapa completo das pastas, o que cada arquivo faz e onde mexer para cada ajuste estão no [`README.md`](./README.md).
