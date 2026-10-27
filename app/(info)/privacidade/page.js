import InfoText from '../_components/InfoText';

export const metadata = { title: 'Política de privacidade · Neo Store Multimarcas' };

// O texto fica em content/privacidade.md (fácil de editar, pode ser longo).
export default function Privacidade() {
  return <InfoText file="privacidade.md" />;
}
