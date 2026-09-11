# Ação e Valorização

Página de pesquisa profissional em Next.js, React e TypeScript.

## Executar

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Para produção: `npm run build` e `npm start`.

## Cadastros persistentes na Vercel

O formulário salva cada cadastro como um objeto JSON privado no Vercel Blob. A confirmação e a abertura do WhatsApp acontecem somente após o Blob confirmar a gravação. Não há envio ao Google Sheets nem gravação no disco da aplicação.

Os objetos ficam em `cadastros/v1/production/`, com nomes únicos. Cada envio adiciona um objeto sem sobrescrever os anteriores, inclusive quando há envios simultâneos. O download reúne todos os cadastros em **cadastros.xlsx**, gerado em memória no momento da solicitação. O XLSX contém data e hora de Fortaleza, nome, CRMV, e-mail, WhatsApp, área, cidades e sugestões.

Os dados permanecem no mesmo Blob após builds e redeploys: não há rotina de exclusão na aplicação. É necessário manter o armazenamento existente conectado ao projeto; excluir o armazenamento ou os objetos remove os dados. Trocar a conexão por outro Blob não transfere os cadastros. Dados anteriores no Sheets ou em um XLSX local não são importados automaticamente.

Preview e desenvolvimento usam prefixos separados (`preview/` e `development/`) para não misturar testes com a planilha de produção. Abra o endereço de produção para baixar os cadastros reais.

## Configurar o projeto Vercel

1. Em **Storage**, crie ou conecte um Blob **Private** ao projeto, no ambiente **Production** (e Preview, se desejado).
2. A conexão atual usa **OIDC** com **BLOB_STORE_ID**, configurados pela Vercel. O SDK autentica as requisições automaticamente. **BLOB_WEBHOOK_PUBLIC_KEY** pode permanecer como configurada pela integração; este projeto não usa webhooks.
3. Em **Settings → Environment Variables**, defina **PLANILHA_SENHA** para proteger o download. Essa configuração precisa existir na Vercel; o `.env.local` do computador não é enviado ao deploy.
4. Publique esta versão do código com um novo deploy para carregar a conexão e as variáveis.

Não adicione prefixo `NEXT_PUBLIC_` às credenciais. As variáveis antigas `GOOGLE_SHEETS_URL`, `GOOGLE_SHEETS_TOKEN` e `PARTICIPACOES_DIR` não são usadas e podem ser removidas das configurações da Vercel.

Para desenvolvimento fora da Vercel, configure `BLOB_READ_WRITE_TOKEN` em `.env.local` com acesso a um Blob privado de testes, ou use um ambiente de desenvolvimento Vercel com OIDC. Não é necessário esse token adicional no deploy conectado com OIDC.

Referência: [Vercel Blob privado e autenticação](https://vercel.com/docs/vercel-blob/private-storage).

## Baixar a planilha

Abra **`/api/participacoes/planilha`** no domínio de produção. O navegador pede usuário **admin** e a senha definida em **PLANILHA_SENHA**. Nenhum dado é consultado antes da autenticação. Sem cadastros, o Excel contém apenas os cabeçalhos. Se houver erro ao ler qualquer cadastro, a exportação falha em vez de entregar uma planilha incompleta.

A exportação percorre todas as páginas do Blob e faz até dez leituras simultâneas. O tempo de execução foi configurado para até 60 segundos; volumes muito grandes podem exigir exportação em segundo plano. A planilha inclui os registros retornados durante a consulta, não uma transação congelada enquanto novos envios chegam.

## Verificação

```bash
npm test
npx tsc --noEmit --incremental false
npm run build
```

Os testes simulam o SDK do Blob: verificam envios concorrentes, paginação, recuperação por uma nova instância do aplicativo, separação entre produção e preview, proteção do download e falhas de gravação/leitura. A conexão OIDC real deve ser validada no deploy Vercel.
