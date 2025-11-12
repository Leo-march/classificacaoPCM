require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { NlpManager } = require('node-nlp');

const app = express();
const PORT = 3000;

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

app.use(express.static('public'));
app.use(express.json());

// ---- Configurar e treinar NLP ----
let nlpManager = null;
let nlpReady = false;

async function inicializarNLP() {
  console.log('🤖 Configurando modelo NLP...');
  
  const manager = new NlpManager({ languages: ['pt'], forceNER: true });
  
  // CARREGAR training-data.json
  const trainingPath = path.join(__dirname, 'training-data.json');
  
  if (!fs.existsSync(trainingPath)) {
    console.error('❌ ERRO: training-data.json não encontrado!');
    console.log('   Usando treinamento padrão limitado...');
    return await treinarPadrao(manager);
  }
  
  try {
    const trainingData = JSON.parse(fs.readFileSync(trainingPath, 'utf-8'));
    
    console.log('\n📚 Carregando dados de treinamento do training-data.json:');
    
    let totalExemplos = 0;
    
    // TREINAR: PREVENTIVAS
    if (trainingData.preventiva) {
      trainingData.preventiva.forEach(doc => {
        manager.addDocument('pt', doc, 'preventiva');
      });
      console.log(`   ✅ PREVENTIVA: ${trainingData.preventiva.length} exemplos`);
      totalExemplos += trainingData.preventiva.length;
    }
    
    // TREINAR: CORRETIVA PROGRAMADA
    if (trainingData.corretiva_programada) {
      trainingData.corretiva_programada.forEach(doc => {
        manager.addDocument('pt', doc, 'corretiva_programada');
      });
      console.log(`   ✅ CORRETIVA_PROGRAMADA: ${trainingData.corretiva_programada.length} exemplos`);
      totalExemplos += trainingData.corretiva_programada.length;
    }
    
    // TREINAR: PREDITIVA (se existir)
    if (trainingData.preditiva) {
      trainingData.preditiva.forEach(doc => {
        manager.addDocument('pt', doc, 'preditiva');
      });
      console.log(`   ✅ PREDITIVA: ${trainingData.preditiva.length} exemplos`);
      totalExemplos += trainingData.preditiva.length;
    }
    
    await manager.train();
    manager.save();
    
    console.log('\n✅ Modelo NLP treinado com sucesso!');
    console.log(`   📊 Total de exemplos: ${totalExemplos}`);
    console.log('   📁 Fonte: training-data.json\n');
    
    nlpReady = true;
    return manager;
    
  } catch (err) {
    console.error('❌ Erro ao carregar training-data.json:', err.message);
    console.log('   Usando treinamento padrão limitado...');
    return await treinarPadrao(manager);
  }
}

// Fallback: treinamento padrão (caso training-data.json não exista)
async function treinarPadrao(manager) {
  console.log('\n⚠️  Usando treinamento padrão (limitado)...');
  
  const preventivas = [
    'preventiva manutencao periodica',
    'inspecao programada equipamento',
    'verificacao preventiva mensal',
    'servico preventivo rotina',
    'manutencao preventiva aerador',
    'revisao periodica sistema',
    'manutencao preventiva',
    'inspecao periodica',
    'revisao programada',
    'preventiva rotina',
    'manutencao programada',
    'iniciar manutencao',
    'realizar manutencao',
    'executar manutencao',
    'manutencao equipamento',
    'manutencao moinho',
    'manutencao bomba',
    'manutencao motor',
    'inspecao equipamento',
    'verificacao equipamento',
    'revisao equipamento'
  ];
  
  const programadas = [
    'corretiva programada reparo',
    'manutencao corretiva agendada',
    'reparo programado equipamento',
    'correcao planejada defeito',
    'manutencao corretiva planejada',
    'reparo agendado',
    'conserto programado',
    'corretiva planejada',
    'correcao equipamento',
    'reparo equipamento',
    'conserto equipamento',
    'substituir componente',
    'trocar peca',
    'corrigir falha',
    'reparar defeito'
  ];
  
  preventivas.forEach(doc => manager.addDocument('pt', doc, 'preventiva'));
  programadas.forEach(doc => manager.addDocument('pt', doc, 'corretiva_programada'));
  
  await manager.train();
  manager.save();
  
  console.log(`   - ${preventivas.length} exemplos de PREVENTIVA`);
  console.log(`   - ${programadas.length} exemplos de PROGRAMADA\n`);
  
  nlpReady = true;
  return manager;
}

// Inicializar NLP ao iniciar o servidor
inicializarNLP().then(manager => {
  nlpManager = manager;
}).catch(err => {
  console.error('❌ Erro ao inicializar NLP:', err);
});

// ---- Normalização de texto ----
function normalizarTexto(texto) {
  if (!texto) return '';
  return texto
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---- Função para calcular diferença de dias ----
function calcularDiasAntecedencia(dtInicio, previstoInicio) {
  try {
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

    const dt1 = parseData(dtInicio);
    const dt2 = parseData(previstoInicio);
    
    return Math.floor((dt2 - dt1) / (1000 * 60 * 60 * 24));
  } catch (err) {
    return -1;
  }
}

// ---- Classificação por regras + NLP ----
async function classificarOS(os, index) {
  console.log(`\n📋 Classificando OS ${index + 1}:`);
  
  // Extrair campos
  const servicoRaw = os['SERVICO'] || os['Servico'] || os['DESCRIÇÃO'] || os['Descrição'] || os['Serviço'] || '';
  const nomeBem = os['Nome do Bem'] || os['NOME DO BEM'] || '';
  const linha = os['Linha'] || os['LINHA'] || '';
  const area = os['area de manutenção'] || os['Area'] || os['AREA'] || '';
  
  console.log(`   Serviço: "${servicoRaw}"`);
  console.log(`   Bem: "${nomeBem}"`);
  
  // PASSO 1: Verificar se há texto
  if (!servicoRaw || servicoRaw.toString().trim().length < 3) {
    console.log('   ⚠️ Texto muito curto ou vazio');
    return { tipo: 'REVISAR', confianca: 0 };
  }
  
  // PASSO 2: Detectar PREVENTIVA
  const servicoStr = servicoRaw.toString();
  const temPreventiva = /preventiv/i.test(servicoStr);
  const temCorretiva = /corretiv/i.test(servicoStr);
  
  console.log(`   Contém "preventiv"? ${temPreventiva}`);
  console.log(`   Contém "corretiv"? ${temCorretiva}`);
  
  if (temPreventiva) {
    console.log('   ✅ REGRA: Detectou PREVENTIVA no texto');
    return { tipo: 'PREVENTIVA', confianca: 99 };
  }
  
  // PASSO 3: Detectar corretiva programada
  const diasAntecedencia = calcularDiasAntecedencia(
    os['Dt. Inicio'] || os['Dt. Início'] || os['DT. INICIO'],
    os['Previsto Inicio'] || os['Previsto Início'] || os['PREVISTO INICIO']
  );
  
  console.log(`   Dias de antecedência: ${diasAntecedencia}`);
  
  if (temCorretiva && diasAntecedencia > 0) {
    console.log('   ✅ REGRA: Corretiva programada detectada');
    return { tipo: 'CORRETIVA_PROGRAMADA', confianca: 90 };
  }
  
  // PASSO 4: Usar NLP
  if (!nlpManager || !nlpReady) {
    console.log('   ⚠️ NLP não disponível');
    return { tipo: 'REVISAR', confianca: 0 };
  }
  
  const textoCompleto = normalizarTexto(`${nomeBem} ${servicoStr} ${linha} ${area}`);
  console.log(`   Texto para NLP: "${textoCompleto}"`);
  
  try {
    const resultado = await nlpManager.process('pt', textoCompleto);
    
    console.log(`   NLP Intent: ${resultado.intent}`);
    console.log(`   NLP Score: ${(resultado.score * 100).toFixed(1)}%`);
    
    const mapeamento = {
      'preventiva': 'PREVENTIVA',
      'corretiva_programada': 'CORRETIVA_PROGRAMADA',
      'preditiva': 'PREDITIVA'
    };
    
    const tipo = mapeamento[resultado.intent] || 'REVISAR';
    const confianca = Math.round((resultado.score || 0) * 100);
    
    if (confianca < 35 || !resultado.intent || resultado.intent === 'None') {
      console.log('   ⚠️ Confiança muito baixa ou intent indefinido');
      return { tipo: 'REVISAR', confianca };
    }
    
    console.log(`   ✅ NLP: ${tipo} (${confianca}%)`);
    return { tipo, confianca };
    
  } catch (err) {
    console.error('   ❌ Erro no NLP:', err.message);
    return { tipo: 'REVISAR', confianca: 0 };
  }
}

// ---- Processamento do Excel ----
app.post('/processar', upload.single('arquivo'), async (req, res) => {
  console.log('\n' + '='.repeat(80));
  console.log('📥 NOVO PROCESSAMENTO INICIADO');
  console.log('='.repeat(80));
  
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }

    console.log(`📄 Arquivo recebido: ${req.file.originalname}`);

    if (!nlpManager || !nlpReady) {
      console.log('⚠️ NLP ainda não está pronto');
      return res.status(503).json({ erro: 'Sistema ainda inicializando. Aguarde alguns segundos e tente novamente.' });
    }

    console.log('📖 Lendo planilha Excel...');
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    let dados = XLSX.utils.sheet_to_json(sheet);

    console.log(`✅ ${dados.length} linhas encontradas`);

    if (dados.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ erro: 'Planilha vazia ou formato inválido' });
    }

    // Verificar e corrigir cabeçalho
    const primeiraLinha = dados[0];
    const colunasDetectadas = Object.keys(primeiraLinha);
    
    console.log('\n📊 Colunas detectadas:', colunasDetectadas.join(', '));
    
    if (colunasDetectadas.some(col => col.includes('__EMPTY'))) {
      console.log('⚠️ Detectado que a primeira linha contém o cabeçalho real');
      
      const novoCabecalho = Object.values(primeiraLinha);
      console.log('📋 Novo cabeçalho:', novoCabecalho.join(', '));
      
      dados = dados.slice(1);
      
      dados = dados.map(linha => {
        const novaLinha = {};
        Object.keys(linha).forEach((chave, index) => {
          const novoNome = novoCabecalho[index] || chave;
          novaLinha[novoNome] = linha[chave];
        });
        return novaLinha;
      });
      
      console.log(`✅ Dados reorganizados: ${dados.length} linhas de dados`);
    }

    console.log('\n📊 Colunas finais:', Object.keys(dados[0]).join(', '));

    const resultados = [];
    const resumo = {};
    let somaConfianca = 0;

    console.log('\n🔄 Iniciando classificação...');
    
    for (let i = 0; i < dados.length; i++) {
      const os = dados[i];
      const classificacao = await classificarOS(os, i);

      resultados.push({
        ...os,
        Classificacao: classificacao.tipo,
        Confianca: classificacao.confianca + '%'
      });

      resumo[classificacao.tipo] = (resumo[classificacao.tipo] || 0) + 1;
      somaConfianca += classificacao.confianca;
    }

    console.log('\n📈 RESUMO:');
    Object.entries(resumo).forEach(([tipo, qtd]) => {
      console.log(`   ${tipo}: ${qtd}`);
    });

    // Criar planilha de saída
    const ws = XLSX.utils.json_to_sheet(resultados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado');

    if (!fs.existsSync('downloads')) {
      fs.mkdirSync('downloads');
    }
    
    const nome = `classificadas_${Date.now()}.xlsx`;
    const caminho = path.join(__dirname, 'downloads', nome);
    XLSX.writeFile(wb, caminho);

    console.log(`💾 Arquivo salvo: ${nome}`);

    fs.unlinkSync(req.file.path);

    const confiancaMedia = Math.round(somaConfianca / dados.length);

    console.log(`\n✅ Processamento concluído! Confiança média: ${confiancaMedia}%`);
    console.log('='.repeat(80) + '\n');

    res.json({
      sucesso: true,
      total: dados.length,
      confiancaMedia,
      resumo,
      arquivoDownload: nome
    });

  } catch (e) {
    console.error('\n❌ ERRO ao processar:', e);
    console.error(e.stack);
    
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ erro: e.message });
  }
});

app.get('/download/:arquivo', (req, res) => {
  const caminho = path.join(__dirname, 'downloads', req.params.arquivo);
  if (fs.existsSync(caminho)) {
    return res.download(caminho);
  }
  res.status(404).json({ erro: 'Arquivo não encontrado' });
});

app.listen(PORT, () => {
  console.log('\n' + '='.repeat(80));
  console.log('🚀 SERVIDOR INICIADO');
  console.log('='.repeat(80));
  console.log(`🌐 Acesse: http://localhost:${PORT}`);
  console.log('⏳ Aguarde o NLP ser treinado antes de processar arquivos...');
  console.log('='.repeat(80) + '\n');
});