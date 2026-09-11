/**
 * Cole no Apps Script aberto pela planilha (Extensões > Apps Script).
 * Execute configurar() uma vez antes de publicar como aplicativo da Web.
 * Configure API_TOKEN nas Propriedades do script e guarde-o apenas no servidor.
 */
const ABA_RESPOSTAS = 'Respostas';
const CABECALHOS = [
  'Data e hora', 'Nome completo', 'Nº CRMV', 'E-mail',
  'Celular / WhatsApp', 'Área de atuação', 'Cidades de atuação',
  'Nos diga no que o CRMV pode melhorar!?'
];

function configurar() {
  const planilha = SpreadsheetApp.getActiveSpreadsheet();
  if (!planilha) throw new Error('Abra o Apps Script pela planilha: Extensões > Apps Script.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID', planilha.getId());
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    prepararAba_(planilha);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  // Não expõe as respostas da pesquisa.
  return json_({ ok: true, message: 'API Ação e Valorização. Envie as respostas por POST.' });
}

function doPost(e) {
  let lock;
  try {
    const propriedades = PropertiesService.getScriptProperties();
    const token = propriedades.getProperty('API_TOKEN');
    const planilhaId = propriedades.getProperty('SPREADSHEET_ID');
    if (!token || !planilhaId) {
      return json_({ ok: false, code: 'NOT_CONFIGURED', message: 'Configure a planilha e o API_TOKEN.' });
    }
    const corpo = e && e.postData && e.postData.contents;
    if (!corpo || corpo.length > 20000) {
      return json_({ ok: false, code: 'INVALID_BODY', message: 'Envie um JSON de até 20 mil caracteres.' });
    }
    let dados;
    try { dados = JSON.parse(corpo); } catch (_) {
      return json_({ ok: false, code: 'INVALID_JSON', message: 'O corpo da requisição deve ser um JSON válido.' });
    }
    if (!dados || typeof dados !== 'object' || Array.isArray(dados)) {
      return json_({ ok: false, code: 'INVALID_BODY', message: 'Envie um objeto JSON.' });
    }
    if (dados.token !== token) {
      return json_({ ok: false, code: 'UNAUTHORIZED', message: 'Token inválido.' });
    }

    let resposta;
    try { resposta = validar_(dados); } catch (erro) {
      return json_({ ok: false, code: 'VALIDATION_ERROR', message: erro.message });
    }

    lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return json_({ ok: false, code: 'BUSY', message: 'Muitos envios simultâneos. Tente novamente em instantes.' });
    }
    const aba = prepararAba_(SpreadsheetApp.openById(planilhaId));
    const linha = aba.getLastRow() + 1;
    if (linha > aba.getMaxRows()) aba.insertRowsAfter(aba.getMaxRows(), 100);
    // Preserva zeros e telefone como texto. Impede que entradas sejam fórmulas.
    aba.getRange(linha, 2, 1, CABECALHOS.length - 1).setNumberFormat('@');
    aba.getRange(linha, 1, 1, CABECALHOS.length).setValues([[
      new Date(), ...resposta.map(textoSeguro_)
    ]]);
    aba.getRange(linha, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    SpreadsheetApp.flush();
    return json_({ ok: true, message: 'Participação registrada com sucesso.' });
  } catch (_) {
    return json_({ ok: false, code: 'INTERNAL_ERROR', message: 'Não foi possível confirmar o registro. Verifique a planilha antes de reenviar.' });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function validar_(dados) {
  function campo(chave, rotulo, limite) {
    if (typeof dados[chave] !== 'string' || !dados[chave].trim()) {
      throw new Error('Informe ' + rotulo + '.');
    }
    const valor = dados[chave].trim();
    if (valor.length > limite) throw new Error('O campo ' + rotulo + ' excedeu o limite de caracteres.');
    return valor;
  }
  const nome = campo('name', 'o nome completo', 150);
  if (nome.split(/\s+/).length < 2) throw new Error('Informe nome e sobrenome.');
  const crmv = campo('crmv', 'o número do CRMV', 40);
  const email = campo('email', 'o e-mail', 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Informe um e-mail válido.');
  const telefone = campo('phone', 'o celular', 30).replace(/\D/g, '');
  if (telefone.length !== 11) throw new Error('Informe o celular com DDD e 11 dígitos.');
  let area = campo('area', 'a área de atuação', 150);
  if (area === 'Outra') area = campo('otherArea', 'a outra área de atuação', 150);
  if (!Array.isArray(dados.cities) || !dados.cities.length || dados.cities.length > 100) {
    throw new Error('Informe de 1 a 100 cidades de atuação em uma lista.');
  }
  const cidades = [];
  dados.cities.forEach(function (cidade) {
    if (typeof cidade !== 'string' || !cidade.trim() || cidade.trim().length > 100) {
      throw new Error('Cada cidade deve ter entre 1 e 100 caracteres.');
    }
    const valor = cidade.trim();
    if (!cidades.some(function (item) { return item.toLowerCase() === valor.toLowerCase(); })) cidades.push(valor);
  });
  if (typeof dados.improvements !== 'string' || !dados.improvements.trim() ||
      dados.improvements.length > 2000) {
    throw new Error('Informe sua sugestão para o CRMV em até 2.000 caracteres.');
  }
  const melhorias = dados.improvements.trim();
  return [nome, crmv, email, telefone, area, cidades.join('; '), melhorias];
}

function prepararAba_(planilha) {
  const aba = planilha.getSheetByName(ABA_RESPOSTAS) || planilha.insertSheet(ABA_RESPOSTAS);
  if (aba.getLastRow() === 0) {
    aba.getRange(1, 1, 1, CABECALHOS.length).setValues([CABECALHOS])
      .setBackground('#041b38').setFontColor('#ffffff').setFontWeight('bold');
    aba.setFrozenRows(1);
    aba.setColumnWidths(1, CABECALHOS.length, 200);
    aba.setColumnWidth(7, 350);
  } else {
    const atuais = aba.getRange(1, 1, 1, CABECALHOS.length).getValues()[0];
    if (atuais.some(function (titulo, i) {
      return titulo !== CABECALHOS[i] && !(i === 7 && titulo === '');
    })) {
      throw new Error('A aba Respostas tem cabeçalhos diferentes dos esperados.');
    }
  }
  aba.getRange(1, 8).setValue(CABECALHOS[7])
    .setBackground('#041b38').setFontColor('#ffffff').setFontWeight('bold');
  aba.setColumnWidth(8, 350);
  return aba;
}

function textoSeguro_(valor) {
  return /^[=+\-@]/.test(valor) ? "'" + valor : valor;
}

function json_(dados) {
  return ContentService.createTextOutput(JSON.stringify(dados))
    .setMimeType(ContentService.MimeType.JSON);
}
