# API da pesquisa no Google Sheets

## Configurar

1. Crie uma planilha no Google Sheets. Abra **Extensões → Apps Script**.
2. Substitua o conteúdo de `Código.gs` pelo arquivo [Code.gs](./Code.gs) deste diretório e salve.
3. Selecione a função **configurar** no editor e clique em **Executar**. Autorize o acesso solicitado à sua planilha. Isso guarda o ID da planilha e prepara a aba **Respostas** sem apagar respostas existentes. Não execute `doPost` pelo editor: ela recebe uma requisição HTTP.
4. Em **Configurações do projeto → Propriedades do script → Adicionar propriedade**, crie `API_TOKEN` com uma senha aleatória longa. Guarde esse valor para configurar o servidor Next.js; não o coloque no código do navegador nem em variáveis `NEXT_PUBLIC_*`.
5. Em **Implantar → Nova implantação**, selecione **Aplicativo da Web**. Escolha **Executar como: Eu** e **Quem pode acessar: Qualquer pessoa**. Clique em **Implantar**. Contas de organizações podem restringir essa opção.
6. Copie a URL terminada em `/exec`. Não use a URL `/dev`. A planilha pode continuar privada: o script escreve usando sua autorização e exige o token no POST.
7. Nas configurações da planilha, escolha o fuso horário desejado para a coluna de data e hora.

Ao editar o script depois, vá a **Implantar → Gerenciar implantações → Editar → Nova versão → Implantar** para atualizar o endpoint existente.

## Enviar uma resposta

Os nomes dos campos são os mesmos do formulário Next.js. Exemplo de JavaScript **para executar no servidor**, usando `fetch`:

```js
const resposta = await fetch(process.env.GOOGLE_SHEETS_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  redirect: 'follow',
  body: JSON.stringify({
    token: process.env.GOOGLE_SHEETS_TOKEN,
    name: 'Maria da Silva',
    crmv: 'CRMV-CE 12345',
    email: 'maria@example.com',
    phone: '(85) 99999-9999',
    area: 'Clínica de pequenos animais',
    cities: ['Fortaleza - CE', 'Caucaia - CE'],
  }),
});

if (!resposta.ok) throw new Error('Falha ao acessar a API da planilha.');
const resultado = await resposta.json();
if (!resultado.ok) throw new Error(resultado.message);
console.log(resultado.message);
```

Para `area: 'Outra'`, envie também `otherArea`, contendo a área informada pelo participante.

O fluxo de integração é **formulário → rota de API do Next.js → Apps Script → planilha**. O token fica no servidor. Não use `mode: 'no-cors'`: isso impede ler a resposta para confirmar a gravação. O formulário do projeto já usa a rota `POST /api/participacoes`, que implementa esse fluxo. Configure as duas variáveis de ambiente no servidor Next.js.

## Retorno

```json
{ "ok": true, "message": "Participação registrada com sucesso." }
```

Erros retornam `ok: false`, `code` e `message`. Verifique sempre o campo `ok`: o ContentService não oferece configuração de status HTTP para esses erros. Uma visita à URL no navegador só mostra a disponibilidade da API, sem gravar ou listar dados.

Cada POST válido adiciona uma linha. Não há deduplicação entre requisições: não faça reenvios automáticos após uma falha de conexão, pois a linha pode já ter sido gravada. Há bloqueio de escrita para envios simultâneos, validação dos campos e tratamento de texto para evitar fórmulas vindas do formulário.

## Referências

- https://developers.google.com/apps-script/guides/web
- https://developers.google.com/apps-script/guides/content
- https://developers.google.com/apps-script/reference/lock/lock-service
