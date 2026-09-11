import { verificarAcesso, privateHeaders } from '../../../../lib/admin-auth.ts';
import { listarParticipacoes, ArmazenamentoNaoConfigurado } from '../../../../lib/participacoes.ts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: Request) {
  const denied = verificarAcesso(request);
  if (denied) return denied;
  try {
    const registros = await listarParticipacoes();
    return Response.json({ registros: registros.reverse() }, { headers: privateHeaders });
  } catch (error) {
    console.error('[admin] Falha ao consultar cadastros', { type: error instanceof Error ? error.name : 'Unknown' });
    return new Response(error instanceof ArmazenamentoNaoConfigurado
      ? 'O armazenamento dos cadastros ainda não foi conectado.'
      : 'Não foi possível carregar os cadastros. Tente novamente.', {
      status: error instanceof ArmazenamentoNaoConfigurado ? 503 : 502, headers: privateHeaders,
    });
  }
}
