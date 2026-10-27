import { LEGAL, STORE } from '@/lib/config';

export const metadata = { title: 'Trocas e devoluções · Neo Store Multimarcas' };

// Texto-base seguindo o Código de Defesa do Consumidor. Revise com a loja (e, se possível, com um advogado).
export default function Trocas() {
  return (
    <>
      <h1>Trocas e devoluções</h1>
      <p className="upd">Última atualização: [DATA]</p>

      <h2>Arrependimento (até 7 dias)</h2>
      <p>Comprou pelo site e mudou de ideia? Você pode desistir da compra em até <b>7 dias corridos a partir do recebimento</b>, sem precisar explicar o motivo (art. 49 do Código de Defesa do Consumidor). Devolvemos o valor integral pago, incluindo o frete.</p>
      <ul>
        <li>A peça deve voltar sem sinais de uso, com etiquetas e embalagem original.</li>
        <li>Fale com a gente pelo WhatsApp {STORE.whatsappLabel} ou pelo e-mail {LEGAL.email} informando o número do pedido.</li>
        <li>O reembolso é feito pela mesma forma de pagamento: estorno no cartão (o prazo depende da operadora) ou devolução via PIX para compras no PIX e no boleto.</li>
      </ul>

      <h2>Troca por tamanho ou modelo</h2>
      <p>[PREENCHER: prazo e condições da troca por tamanho/modelo, ex.: até 30 dias do recebimento, peça sem uso e com etiqueta, sujeita a disponibilidade. Informe quem paga o frete da troca.]</p>

      <h2>Produto com defeito</h2>
      <p>Se a peça apresentar defeito, você tem até <b>90 dias</b> a partir do recebimento para nos avisar (art. 26 do CDC). Avaliamos o produto e fazemos o reparo, a troca por outra peça igual ou a devolução do valor. Nesse caso, o frete fica por nossa conta.</p>

      <h2>Como enviar a peça</h2>
      <p>[PREENCHER: como a cliente devolve a peça. Ex.: em Parintins, retiramos ou você entrega na loja; nas demais cidades, enviamos um código de postagem dos Correios.]</p>
    </>
  );
}
