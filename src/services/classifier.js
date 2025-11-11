const { NlpManager } = require('node-nlp');

/**
 * Configura e treina o modelo NLP
 */
async function configurarNLP() {
  console.log('🤖 Configurando modelo NLP...');
  
  const manager = new NlpManager({ languages: ['pt'], forceNER: true });
  
  // TREINAR: PREVENTIVAS
  manager.addDocument('pt', 'preventiva manutencao periodica', 'preventiva');
  manager.addDocument('pt', 'inspecao programada equipamento', 'preventiva');
  manager.addDocument('pt', 'verificacao preventiva mensal', 'preventiva');
  manager.addDocument('pt', 'servico preventivo rotina', 'preventiva');
  manager.addDocument('pt', 'manutencao preventiva aerador', 'preventiva');
  manager.addDocument('pt', 'revisao periodica sistema', 'preventiva');
  
  // TREINAR: CORRETIVA PRONTO ATENDIMENTO
  manager.addDocument('pt', 'equipamento parado urgente', 'corretiva_pronto');
  manager.addDocument('pt', 'quebra emergencia imediata', 'corretiva_pronto');
  manager.addDocument('pt', 'correcao urgente falha', 'corretiva_pronto');
  manager.addDocument('pt', 'reparo emergencial equipamento', 'corretiva_pronto');
  manager.addDocument('pt', 'manutencao emergencia parada', 'corretiva_pronto');
  
  // TREINAR: CORRETIVA PROGRAMADA
  manager.addDocument('pt', 'corretiva programada reparo', 'corretiva_programada');
  manager.addDocument('pt', 'manutencao corretiva agendada', 'corretiva_programada');
  manager.addDocument('pt', 'reparo programado equipamento', 'corretiva_programada');
  manager.addDocument('pt', 'correcao planejada defeito', 'corretiva_programada');
  manager.addDocument('pt', 'manutencao corretiva planejada', 'corretiva_programada');
  
  await manager.train();
  console.log('✅ Modelo treinado com sucesso!');
  
  return manager;
}

/**
 * Classifica uma OS usando ALGORITMO + IA
 */
async function classificarOS(dadosProcessados, manager) {
  // ETAPA 1: REGRAS ALGORÍTMICAS (mais rápidas e precisas)
  
  // Regra 1: Nome contém "PREVENTIV"
  if (dadosProcessados.temPreventivaNome) {
    return {
      ordemServ: dadosProcessados.ordemServ,
      tipo: 'PREVENTIVA',
      confianca: 99,
      metodo: 'regra_nome',
      motivo: 'Palavra "PREVENTIVA" encontrada no serviço'
    };
  }
  
  // Regra 2: Menos de 2 dias de antecedência = urgente
  if (dadosProcessados.diasAntecedencia < 2) {
    return {
      ordemServ: dadosProcessados.ordemServ,
      tipo: 'CORRETIVA_PRONTO_ATENDIMENTO',
      confianca: 95,
      metodo: 'regra_urgencia',
      motivo: `Apenas ${dadosProcessados.diasAntecedencia} dia(s) de antecedência`
    };
  }
  
  // Regra 3: "CORRETIV" no nome + mais de 5 dias
  if (dadosProcessados.temCorretivoNome && dadosProcessados.diasAntecedencia > 5) {
    return {
      ordemServ: dadosProcessados.ordemServ,
      tipo: 'CORRETIVA_PROGRAMADA',
      confianca: 90,
      metodo: 'regra_programada',
      motivo: `Corretiva com ${dadosProcessados.diasAntecedencia} dias de antecedência`
    };
  }
  
  // ETAPA 2: SE NÃO BATEU NAS REGRAS, USA NLP (IA)
  const resultado = await manager.process('pt', dadosProcessados.textoCompleto);
  
  const mapeamento = {
    'preventiva': 'PREVENTIVA',
    'corretiva_pronto': 'CORRETIVA_PRONTO_ATENDIMENTO',
    'corretiva_programada': 'CORRETIVA_PROGRAMADA'
  };
  
  return {
    ordemServ: dadosProcessados.ordemServ,
    tipo: mapeamento[resultado.intent] || 'INDEFINIDO',
    confianca: Math.round(resultado.score * 100),
    metodo: 'nlp',
    motivo: 'Classificado por análise de linguagem natural'
  };
}

module.exports = { configurarNLP, classificarOS };