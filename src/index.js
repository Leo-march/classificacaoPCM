const path = require('path');
const { lerPlanilha } = require('./services/excelReader');
const { preprocessarOS } = require('./services/preprocessor');
const { configurarNLP, classificarOS } = require('./services/classifier');
const { salvarResultado, exibirResumo } = require('./utils/excelWriter');

/**
 * FUNÇÃO PRINCIPAL
 * Coordena todo o fluxo: Lê Excel → Algoritmo processa → IA classifica → Salva resultado
 */
async function main() {
  console.log('🚀 Iniciando classificação de Ordens de Serviço...\n');
  
  try {
    // 1. LER PLANILHA EXCEL
    const caminhoEntrada = path.join(__dirname, '../data/input/ordens_servico.xlsx');
    const osLista = lerPlanilha(caminhoEntrada);
    
    if (osLista.length === 0) {
      console.log('⚠️  Nenhuma OS encontrada na planilha!');
      return;
    }
    
    // 2. CONFIGURAR E TREINAR NLP (IA)
    const manager = await configurarNLP();
    
    // 3. PROCESSAR CADA OS
    console.log('\n⚙️  Processando ordens de serviço...');
    const resultados = [];
    
    for (let i = 0; i < osLista.length; i++) {
      const os = osLista[i];
      
      // Algoritmo preprocessa os dados
      const dadosProcessados = preprocessarOS(os);
      
      // IA classifica baseada no resultado do algoritmo
      const classificacao = await classificarOS(dadosProcessados, manager);
      
      // Combina dados originais + classificação
      resultados.push({
        ...os,
        CLASSIFICACAO: classificacao.tipo,
        CONFIANCA: `${classificacao.confianca}%`,
        METODO: classificacao.metodo,
        MOTIVO: classificacao.motivo
      });
      
      // Mostra progresso
      if ((i + 1) % 10 === 0 || i === osLista.length - 1) {
        process.stdout.write(`\r   Processadas: ${i + 1}/${osLista.length}`);
      }
    }
    
    console.log('\n');
    
    // 4. EXIBIR RESUMO
    exibirResumo(resultados);
    
    // 5. SALVAR RESULTADO
    const timestamp = new Date().toISOString().split('T')[0];
    salvarResultado(resultados, `ordens_classificadas_${timestamp}.xlsx`);
    
    console.log('\n✨ Processamento concluído com sucesso!');
    
  } catch (erro) {
    console.error('\n❌ ERRO:', erro.message);
    console.error(erro.stack);
    process.exit(1);
  }
}

// Executar
main();