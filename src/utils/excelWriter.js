const XLSX = require('xlsx');
const path = require('path');

/**
 * Salva os resultados classificados em uma nova planilha Excel
 */
function salvarResultado(resultados, nomeArquivo = 'ordens_classificadas.xlsx') {
  try {
    const caminhoSaida = path.join(__dirname, '../../data/output', nomeArquivo);
    
    // Criar worksheet a partir dos dados
    const ws = XLSX.utils.json_to_sheet(resultados);
    
    // Criar workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Classificadas');
    
    // Salvar arquivo
    XLSX.writeFile(wb, caminhoSaida);
    
    console.log(`\n💾 Planilha salva em: ${caminhoSaida}`);
    
    return caminhoSaida;
  } catch (erro) {
    console.error('❌ Erro ao salvar planilha:', erro.message);
    throw erro;
  }
}

/**
 * Exibe resumo estatístico das classificações
 */
function exibirResumo(resultados) {
  console.log('\n📈 RESUMO DA CLASSIFICAÇÃO:');
  console.log('═'.repeat(50));
  
  const resumo = resultados.reduce((acc, r) => {
    const tipo = r.CLASSIFICACAO || 'INDEFINIDO';
    acc[tipo] = (acc[tipo] || 0) + 1;
    return acc;
  }, {});
  
  Object.entries(resumo).forEach(([tipo, quantidade]) => {
    const percentual = ((quantidade / resultados.length) * 100).toFixed(1);
    console.log(`${tipo.padEnd(35)} ${quantidade.toString().padStart(4)} (${percentual}%)`);
  });
  
  console.log('═'.repeat(50));
  console.log(`TOTAL: ${resultados.length} ordens de serviço`);
  
  // Mostrar confiança média
  const confiancaMedia = resultados.reduce((acc, r) => {
    const conf = parseInt(r.CONFIANCA) || 0;
    return acc + conf;
  }, 0) / resultados.length;
  
  console.log(`Confiança média: ${confiancaMedia.toFixed(1)}%`);
}

module.exports = { salvarResultado, exibirResumo };