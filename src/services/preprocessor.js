const XLSX = require('xlsx');

/**
 * ALGORITMO: Preprocessa e extrai informações das OS
 */
function preprocessarOS(os) {
  // Função auxiliar para converter datas do Excel
  const parseData = (data) => {
    if (!data) return new Date();
    
    if (typeof data === 'number') {
      // Excel armazena datas como números seriais
      const date = XLSX.SSF.parse_date_code(data);
      return new Date(date.y, date.m - 1, date.d);
    }
    
    // Se for string no formato DD/MM/YYYY
    if (typeof data === 'string') {
      const partes = data.split('/');
      if (partes.length === 3) {
        return new Date(partes[2], partes[1] - 1, partes[0]);
      }
    }
    
    return new Date(data);
  };

  const dtInicio = parseData(os['Dt. Inicio'] || os['Dt. Início']);
  const previstoInicio = parseData(os['Previsto Inicio'] || os['Previsto Início']);
  
  // Calcula diferença em dias
  const diasAntecedencia = Math.floor(
    (previstoInicio - dtInicio) / (1000 * 60 * 60 * 24)
  );
  
  const servico = (os['SERVICO'] || os['Servico'] || '').toString();
  const nomeBem = (os['Nome do Bem'] || '').toString();
  const linha = (os['Linha'] || '').toString();
  const area = (os['area de manutenção'] || os['Area'] || '').toString();
  
  const dados = {
    ordemServ: os['Ordem Serv.'] || os['Ordem Serv'] || '',
    nomeBem,
    servico,
    linha,
    area,
    dtInicio,
    previstoInicio,
    
    // ANÁLISES ALGORÍTMICAS
    temPreventivaNome: /PREVENTIV/i.test(servico),
    temCorretivoNome: /CORRETIV/i.test(servico),
    diasAntecedencia,
    
    // Texto normalizado para NLP
    textoCompleto: `${nomeBem} ${servico} ${linha} ${area}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim()
  };
  
  return dados;
}

module.exports = { preprocessarOS };