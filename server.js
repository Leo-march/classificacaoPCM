require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const { cosineSimilarity, embed } = require('./utils/embeddings');

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

// ---- Carregar embeddings treinados ----
const embeddingsPath = path.join(__dirname, 'embeddings.json');
if (!fs.existsSync(embeddingsPath)) {
  console.error('\n❌ ERRO: Você ainda não gerou embeddings.\nExecute:\nnode scripts/generate-embeddings.js\n');
  process.exit(1);
}
const embeddingsDB = JSON.parse(fs.readFileSync(embeddingsPath));

// ---- Normalização de texto ----
function normalizarTexto(texto) {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}



// ---- Classificação por similaridade ----
async function classificarTexto(textoBruto) {
    const texto = normalizarTexto(textoBruto || '');
  
    if (!texto || texto.length < 3) {
      return { tipo: 'REVISAR', confianca: 0 };
    }
  
    let embTexto;
    try {
      embTexto = await embed(texto);
    } catch (e) {
      console.log("⚠️ Falha ao gerar embedding:", texto, e.message);
      return { tipo: 'REVISAR', confianca: 0 };
    }
  
    if (!embTexto || embTexto.length === 0) {
      return { tipo: 'REVISAR', confianca: 0 };
    }
  
    let melhor = { tipo: 'REVISAR', score: 0 };
  
    for (const categoria in embeddingsDB) {
      for (const item of embeddingsDB[categoria]) {
        if (!item.embedding || item.embedding.length === 0) continue;
        const sim = cosineSimilarity(embTexto, item.embedding);
        if (sim > melhor.score) {
          melhor = { tipo: categoria.toUpperCase(), score: sim };
        }
      }
    }
  
    if (melhor.score < 0.55) {
      return { tipo: 'REVISAR', confianca: Math.round(melhor.score * 100) };
    }
  
    return { tipo: melhor.tipo, confianca: Math.round(melhor.score * 100) };
  }
  
// ---- Processamento do Excel ----
app.post('/processar', upload.single('arquivo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: 'Nenhum arquivo enviado' });

    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const dados = XLSX.utils.sheet_to_json(sheet);

    const resultados = [];

    for (const os of dados) {
        const texto = os['SERVICO'] || os['Servico'] || os['DESCRIÇÃO'] || os['Descrição'] || '';

      const result = await classificarTexto(texto);

      resultados.push({
        ...os,
        Classificacao: result.tipo,
        Confianca: result.confianca + '%'
      });
    }

    const ws = XLSX.utils.json_to_sheet(resultados);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultado');

    if (!fs.existsSync('downloads')) fs.mkdirSync('downloads');
    const nome = `classificadas_${Date.now()}.xlsx`;
    const caminho = path.join(__dirname, 'downloads', nome);
    XLSX.writeFile(wb, caminho);

    fs.unlinkSync(req.file.path);

    res.json({ sucesso: true, arquivoDownload: nome });

  } catch (e) {
    res.status(500).json({ erro: e.message });
  }
});

app.get('/download/:arquivo', (req, res) => {
  const caminho = path.join(__dirname, 'downloads', req.params.arquivo);
  if (fs.existsSync(caminho)) return res.download(caminho);
  res.status(404).json({ erro: 'Arquivo não encontrado' });
});

app.listen(PORT, () => console.log(`Servidor rodando http://localhost:${PORT}`));
