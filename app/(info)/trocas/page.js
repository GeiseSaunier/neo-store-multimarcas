import InfoText from '../_components/InfoText';

export const metadata = { title: 'Trocas e devoluções · Neo Store Multimarcas' };

// O texto fica em content/trocas.md (fácil de editar, pode ser longo).
export default function Trocas() {
  return <InfoText file="trocas.md" />;
}
