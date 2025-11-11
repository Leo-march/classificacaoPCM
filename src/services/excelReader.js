const XLSX = require('xlsx');

/**
 * Lê a planilha Excel e retorna os dados em formato JSON
 */
function lerPlanilha(caminhoArquivo) {
  try {
    console.log(`📂 Lendo arquivo: ${caminhoArquivo}`);
    
    const workbook = XLSX.readFile(caminhoArquivo);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Converte para JSON
    const dados = XLSX.utils.sheet_to_json(sheet);
    
    console.log(`✅ ${dados.length} ordens de serviço encontradas`);
    
    return dados;
  } catch (erro) {
    console.error('❌ Erro ao ler planilha:', erro.message);
    throw erro;
  }
}

module.exports = { lerPlanilha };