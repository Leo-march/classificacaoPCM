const { NlpManager } = require('node-nlp');

// Simular dados reais da sua planilha
const exemploOS = {
  'SERVICO': 'Iniciar manutenção do moinho 3',
  'Nome do Bem': 'MOINHO 3',
  'Linha': 'Produção',
  'area de manutenção': 'Manutenção Mecânica'
};

async function testarClassificacao() {
  console.log('🔍 INICIANDO TESTE DE CLASSIFICAÇÃO\n');
  console.log('Dados da OS:');
  console.log(JSON.stringify(exemploOS, null, 2));
  console.log('\n' + '='.repeat(60) + '\n');

  // Inicializar NLP
  console.log('🤖 Treinando modelo NLP...');
  const manager = new NlpManager({ languages: ['pt'], forceNER: true });
  
  // Treinar com exemplos
  manager.addDocument('pt', 'preventiva manutencao periodica', 'preventiva');
  manager.addDocument('pt', 'inspecao programada equipamento', 'preventiva');
  manager.addDocument('pt', 'verificacao preventiva mensal', 'preventiva');
  manager.addDocument('pt', 'servico preventivo rotina', 'preventiva');
  manager.addDocument('pt', 'manutencao preventiva aerador', 'preventiva');
  manager.addDocument('pt', 'revisao periodica sistema', 'preventiva');
  manager.addDocument('pt', 'manutencao preventiva', 'preventiva');
  manager.addDocument('pt', 'iniciar manutencao', 'preventiva');
  manager.addDocument('pt', 'realizar manutencao', 'preventiva');
  manager.addDocument('pt', 'executar manutencao', 'preventiva');
  manager.addDocument('pt', 'manutencao equipamento', 'preventiva');
  manager.addDocument('pt', 'manutencao moinho', 'preventiva');
  manager.addDocument('pt', 'manutencao bomba', 'preventiva');
  
  manager.addDocument('pt', 'corretiva programada reparo', 'corretiva_programada');
  manager.addDocument('pt', 'manutencao corretiva agendada', 'corretiva_programada');
  manager.addDocument('pt', 'reparo equipamento', 'corretiva_programada');
  manager.addDocument('pt', 'conserto equipamento', 'corretiva_programada');
  
  await manager.train();
  console.log('✅ Treinamento concluído!\n');

  // Testar normalização
  const servico = exemploOS['SERVICO'] || '';
  console.log('PASSO 1 - Texto original:');
  console.log(`"${servico}"\n`);

  // Normalização simples (para detecção de palavras-chave)
  const textoSimples = servico.toLowerCase();
  console.log('PASSO 2 - Normalização simples:');
  console.log(`"${textoSimples}"`);
  console.log(`Contém "preventiv"? ${/preventiv/i.test(servico)}\n`);

  // Normalização completa (para NLP)
  const textoNormalizado = servico
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log('PASSO 3 - Normalização completa (NLP):');
  console.log(`"${textoNormalizado}"\n`);

  // Teste 1: Regra de palavra-chave
  console.log('TESTE 1 - Detecção por palavra-chave:');
  if (/preventiv/i.test(servico)) {
    console.log('✅ MATCH! Detectou PREVENTIVA no texto');
    console.log('Resultado: PREVENTIVA (99% confiança)\n');
  } else {
    console.log('❌ Não detectou palavra-chave\n');
  }

  // Teste 2: NLP
  console.log('TESTE 2 - Classificação NLP:');
  const resultado = await manager.process('pt', textoNormalizado);
  
  console.log('Resposta completa do NLP:');
  console.log(JSON.stringify({
    intent: resultado.intent,
    score: resultado.score,
    classifications: resultado.classifications
  }, null, 2));

  console.log('\nClassificações ordenadas:');
  if (resultado.classifications) {
    resultado.classifications
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.intent}: ${(c.score * 100).toFixed(1)}%`);
      });
  }

  // Resultado final
  console.log('\n' + '='.repeat(60));
  console.log('RESULTADO FINAL:\n');
  
  if (/preventiv/i.test(servico)) {
    console.log('✅ Tipo: PREVENTIVA');
    console.log('✅ Confiança: 99%');
    console.log('✅ Método: Regra de palavra-chave');
  } else {
    const mapeamento = {
      'preventiva': 'PREVENTIVA',
      'corretiva_programada': 'CORRETIVA_PROGRAMADA'
    };
    
    const tipo = mapeamento[resultado.intent] || 'REVISAR';
    const confianca = Math.round((resultado.score || 0) * 100);
    
    console.log(`✅ Tipo: ${tipo}`);
    console.log(`✅ Confiança: ${confianca}%`);
    console.log('✅ Método: NLP');
  }
  
  console.log('='.repeat(60));
}

// Executar teste
testarClassificacao().catch(err => {
  console.error('❌ ERRO:', err);
  console.error(err.stack);
});