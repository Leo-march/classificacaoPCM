const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { NlpManager } = require('node-nlp');

const app = express();
const PORT = 3000;

// Configurar multer para upload de arquivos
const upload = multer({ 
  dest: 'uploads/',
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() === '.xlsx') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos .xlsx são permitidos!'));
    }
  }
});

// Servir arquivos estáticos
app.use(express.static('public'));
app.use(express.json());

// Configurar e treinar NLP
let nlpManager = null;

// Carregar dados de treinamento personalizados (se existir)
function carregarDadosTreinamento() {
  try {
    const caminhoArquivo = path.join(__dirname, 'training-data.json');
    if (fs.existsSync(caminhoArquivo)) {
      const dados = JSON.parse(fs.readFileSync(caminhoArquivo, 'utf8'));
      console.log('📚 Dados de treinamento personalizados carregados!');
      return dados;
    }
  } catch (erro) {
    console.log('⚠️  Arquivo training-data.json não encontrado, usando treinamento padrão');
  }
  return null;
}

async function inicializarNLP() {
  console.log('🤖 Inicializando modelo NLP...');
  
  nlpManager = new NlpManager({ languages: ['pt'], forceNER: true });
  
  // PREVENTIVAS
  nlpManager.addDocument('pt', 'preventiva manutencao periodica', 'preventiva');
  nlpManager.addDocument('pt', 'inspecao programada equipamento', 'preventiva');
  nlpManager.addDocument('pt', 'verificacao preventiva mensal', 'preventiva');
  nlpManager.addDocument('pt', 'servico preventivo rotina', 'preventiva');
  nlpManager.addDocument('pt', 'manutencao preventiva aerador', 'preventiva');
  nlpManager.addDocument('pt', 'revisao periodica sistema', 'preventiva');
  
  // CORRETIVA PROGRAMADA
  nlpManager.addDocument('pt', 'corretiva programada reparo', 'corretiva_programada');
  nlpManager.addDocument('pt', 'manutencao corretiva agendada', 'corretiva_programada');
  nlpManager.addDocument('pt', 'reparo programado equipamento', 'corretiva_programada');
  nlpManager.addDocument('pt', 'correcao planejada defeito', 'corretiva_programada');
  nlpManager.addDocument('pt', 'manutencao corretiva planejada', 'corretiva_programada');
  
  await nlpManager.train();
  console.log('✅ Modelo NLP pronto!');
}

// Função para preprocessar OS
function preprocessarOS(os) {
  const parseData = (data) => {
    if (!data) return new Date();
    
    if (typeof data === 'number') {
      const date = XLSX.SSF.parse_date_code(data);
      return new Date(date.y, date.m - 1, date.d);
    }
    
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
  
  const diasAntecedencia = Math.floor(
    (previstoInicio - dtInicio) / (1000 * 60 * 60 * 24)
  );
  
  const servico = (os['SERVICO'] || os['Servico'] || '').toString();
  const nomeBem = (os['Nome do Bem'] || '').toString();
  const linha = (os['Linha'] || '').toString();
  const area = (os['area de manutenção'] || os['Area'] || '').toString();
  
  return {
    ordemServ: os['Ordem Serv.'] || os['Ordem Serv'] || '',
    nomeBem,
    servico,
    linha,
    area,
    dtInicio,
    previstoInicio,
    temPreventivaNome: /PREVENTIV/i.test(servico),
    diasAntecedencia,
    textoCompleto: `${nomeBem} ${servico} ${linha} ${area}`
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  };
}

// Função de classificação
async function classificarOS(dadosProcessados) {
  // Regra 1: Nome contém "PREVENTIV"
  if (dadosProcessados.temPreventivaNome) {
    return {
      tipo: 'PREVENTIVA',
      confianca: 99,
      motivo: 'Palavra "PREVENTIVA" encontrada no serviço'
    };
  }
  
  // Regra 2: Análise de dias (preventiva geralmente tem mais antecedência)
  if (dadosProcessados.diasAntecedencia > 7) {
    return {
      tipo: 'PREVENTIVA',
      confianca: 85,
      motivo: `${dadosProcessados.diasAntecedencia} dias de antecedência (planejada)`
    };
  }
  
  // Usar NLP
  const resultado = await nlpManager.process('pt', dadosProcessados.textoCompleto);
  
  const mapeamento = {
    'preventiva': 'PREVENTIVA',
    'corretiva_programada': 'CORRETIVA_PROGRAMADA'
  };
  
  return {
    tipo: mapeamento[resultado.intent] || 'CORRETIVA_PROGRAMADA',
    confianca: Math.round(resultado.score * 100),
    motivo: 'Classificado por análise de linguagem natural'
  };
}

// Rota de upload e processamento
app.post('/processar', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo foi enviado!' });
    }

    console.log(`📂 Processando arquivo: ${req.file.originalname}`);

    // Ler arquivo Excel
    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const dados = XLSX.utils.sheet_to_json(sheet);

    if (dados.length === 0) {
      fs.unlinkSync(req.file.path); // Limpar arquivo
      return res.status(400).json({ erro: 'Planilha vazia!' });
    }

    // Processar cada OS
    const resultados = [];
    
    for (const os of dados) {
      const dadosProcessados = preprocessarOS(os);
      const classificacao = await classificarOS(dadosProcessados);
      
      // Criar nova linha com todos os dados originais + classificação
      resultados.push({
        ...os,
        Classificacao: classificacao.tipo,
        Confianca: `${classificacao.confianca}%`,
        Motivo: classificacao.motivo
      });
    }

    // Criar nova planilha
    const wsResultado = XLSX.utils.json_to_sheet(resultados);
    const wbResultado = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wbResultado, wsResultado, 'Classificadas');

    // Salvar arquivo de saída
    const timestamp = Date.now();
    const nomeArquivoSaida = `classificadas_${timestamp}.xlsx`;
    const caminhoSaida = path.join(__dirname, 'downloads', nomeArquivoSaida);
    
    // Criar pasta downloads se não existir
    if (!fs.existsSync(path.join(__dirname, 'downloads'))) {
      fs.mkdirSync(path.join(__dirname, 'downloads'));
    }

    XLSX.writeFile(wbResultado, caminhoSaida);

    // Limpar arquivo de upload
    fs.unlinkSync(req.file.path);

    // Calcular estatísticas
    const resumo = resultados.reduce((acc, r) => {
      const tipo = r.Classificacao || 'INDEFINIDO';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});

    const confiancaMedia = resultados.reduce((acc, r) => {
      const conf = parseInt(r.Confianca) || 0;
      return acc + conf;
    }, 0) / resultados.length;

    console.log('✅ Processamento concluído!');

    res.json({
      sucesso: true,
      total: resultados.length,
      resumo,
      confiancaMedia: confiancaMedia.toFixed(1),
      arquivoDownload: nomeArquivoSaida
    });

  } catch (erro) {
    console.error('❌ Erro:', erro);
    
    // Limpar arquivo de upload em caso de erro
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({ erro: erro.message });
  }
});

// Rota de download
app.get('/download/:arquivo', (req, res) => {
  const caminhoArquivo = path.join(__dirname, 'downloads', req.params.arquivo);
  
  if (fs.existsSync(caminhoArquivo)) {
    res.download(caminhoArquivo, 'ordens_classificadas.xlsx', (err) => {
      if (!err) {
        // Deletar arquivo após download
        setTimeout(() => {
          if (fs.existsSync(caminhoArquivo)) {
            fs.unlinkSync(caminhoArquivo);
          }
        }, 5000);
      }
    });
  } else {
    res.status(404).json({ erro: 'Arquivo não encontrado' });
  }
});

// Inicializar servidor
async function iniciar() {
  await inicializarNLP();
  
  // Criar pastas necessárias
  ['uploads', 'downloads'].forEach(pasta => {
    const caminho = path.join(__dirname, pasta);
    if (!fs.existsSync(caminho)) {
      fs.mkdirSync(caminho);
    }
  });
  
  app.listen(PORT, () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log('📊 Acesse o navegador para fazer upload de planilhas\n');
  });
}

iniciar();