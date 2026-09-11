import { verificarAcesso, privateHeaders as headers } from '../../../../lib/admin-auth.ts';
import { baixarPlanilha, ArmazenamentoNaoConfigurado } from '../../../../lib/participacoes.ts';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = verificarAcesso(request, true);
  if (denied) return denied;
  try {
    const bytes = await baixarPlanilha();
    return new Response(new Uint8Array(bytes), {
      headers: {
        ...headers,
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="cadastros.xlsx"',
      },
    });
  } catch (error) {
    console.error('[planilha] Falha na exportação', { type: error instanceof Error ? error.name : 'Unknown' });
    if (error instanceof ArmazenamentoNaoConfigurado) {
      return new Response('Conecte o armazenamento privado ao projeto para habilitar a planilha.', { status: 503, headers });
    }
    return new Response('Não foi possível baixar a planilha. Tente novamente.', { status: 500, headers });
  }
}
