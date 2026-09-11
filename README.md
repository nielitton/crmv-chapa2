# Ação e Valorização

Página de pesquisa profissional em Next.js, React e TypeScript.

## Executar

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Para produção: `npm run build` e `npm start`.

## Dados

O formulário valida campos obrigatórios, e-mail, nome completo e celular com DDD. Permite adicionar várias cidades e informar uma área personalizada.

O formulário envia os dados para `POST /api/participacoes`. A rota valida os campos e chama o Google Apps Script pelo servidor. A confirmação aparece somente quando o Apps Script retorna `ok: true`. Não há repetição automática de envios nem gravação local das novas respostas.

Configure `GOOGLE_SHEETS_URL` (URL publicada terminada em `/exec`) e `GOOGLE_SHEETS_TOKEN` (mesmo valor de `API_TOKEN` no Apps Script) em `.env.local` para desenvolvimento e nas variáveis de ambiente do provedor em produção. Essas variáveis são exclusivas do servidor e não devem usar o prefixo `NEXT_PUBLIC_`. Reinicie o servidor após alterar a configuração.

Consulte [as instruções do Google Apps Script](google-apps-script/README.md).
