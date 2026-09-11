# Ação e Valorização

Página de pesquisa profissional em Next.js, React e TypeScript.

## Executar

```bash
npm install
npm run dev
```

Abra http://localhost:3000. Para produção: `npm run build` e `npm start`.

## Cadastros no servidor e download do Excel

Cada envio válido acrescenta uma linha ao arquivo **data/cadastros.xlsx**, no próprio servidor. A confirmação e a abertura do WhatsApp acontecem após a gravação. O formulário não depende mais do Google Sheets. As respostas antigas que ficaram no Google não são importadas automaticamente.

O Excel contém data e hora de Fortaleza, nome, CRMV, e-mail, WhatsApp, área, cidades e sugestões. As gravações usam bloqueio entre processos e substituição atômica do arquivo para preservar cadastros simultâneos e evitar downloads parciais. O arquivo fica fora da pasta pública e do Git.

Para baixar, abra **`/api/participacoes/planilha`** no domínio do site. O navegador pedirá usuário **admin** e a senha definida em **PLANILHA_SENHA**. Antes do primeiro cadastro, o download entrega uma planilha com os cabeçalhos.

Configure no `.env.local` ou nas variáveis do servidor:

```dotenv
PLANILHA_SENHA=sua-senha-privada
# Opcional: pasta persistente absoluta; padrão: ./data
PARTICIPACOES_DIR=/caminho/persistente/dados
```

Reinicie o servidor após mudar variáveis. Use HTTPS no domínio público. Não use prefixo `NEXT_PUBLIC_` nessas variáveis. Em Docker, monte essa pasta em um volume persistente; faça backup de `cadastros.xlsx`. Esta implementação requer um servidor Node com disco persistente e não deve ser usada em hospedagem com sistema de arquivos temporário. Processos que atendem o mesmo site devem compartilhar a mesma pasta de dados.

Os arquivos em `google-apps-script/` são apenas a integração anterior, sem uso no fluxo atual.

## Verificação

```bash
node --test tests/*.test.mjs
npx tsc --noEmit --incremental false
```
