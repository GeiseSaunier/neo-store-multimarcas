import 'server-only';
import { fail } from './api';

// Confere se quem chamou a rota está logado no painel e é administrador.
// Devolve uma resposta de erro, ou null quando está tudo certo.
export async function denyUnlessAdmin(req, db) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
  if (!token) return fail('Sem permissão.', 401);
  const { data: u } = await db.auth.getUser(token);
  if (!u?.user) return fail('Sem permissão.', 401);
  const { data: adm } = await db.from('admins').select('user_id').eq('user_id', u.user.id).maybeSingle();
  if (!adm) return fail('Sem permissão.', 403);
  return null;
}
