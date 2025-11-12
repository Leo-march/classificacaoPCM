require('dotenv').config();
const fs = require("fs");
const path = require("path");
const { embed } = require("../utils/embeddings");

async function gerar() {
  console.log('🚀 Iniciando geração de embeddings...\n');
  
  const trainingPath = path.join(__dirname, "..", "training-data.json");
  
  if (!fs.existsSync(trainingPath)) {
    console.error('❌ ERRO: training-data.json não encontrado!');
    process.exit(1);
  }

  const trainingData = JSON.parse(fs.readFileSync(trainingPath, 'utf-8'));

  const embeddingsDB = {};

  for (const categoria in trainingData) {
    console.log(`\n📚 Processando categoria: ${categoria.toUpperCase()}`);
    embeddingsDB[categoria] = [];
    
    for (const frase of trainingData[categoria]) {
      try {
        const vetor = await embed(frase);
        embeddingsDB[categoria].push({ frase, embedding: vetor });
        console.log(`   ✓ ${frase.substring(0, 50)}...`);
        
        // Pequeno delay para evitar rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`   ✗ Erro ao processar: ${frase.substring(0, 50)}...`);
        console.error(`     ${error.message}`);
      }
    }
  }

  const outputPath = path.join(__dirname, "..", "embeddings.json");
  fs.writeFileSync(outputPath, JSON.stringify(embeddingsDB, null, 2));
  
  console.log("\n✅ embeddings.json gerado com sucesso!");
  console.log(`📁 Localização: ${outputPath}`);
  console.log('\n🎯 Agora você pode executar: node server.js\n');
}

gerar().catch(err => {
  console.error('\n❌ ERRO:', err.message);
  process.exit(1);
});