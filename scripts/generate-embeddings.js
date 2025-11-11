require('dotenv').config();
const fs = require("fs");
const path = require("path");
const { embed } = require("../utils/embeddings");

async function gerar() {
  const trainingData = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "training-data.json")));

  const embeddingsDB = {};

  for (const categoria in trainingData) {
    embeddingsDB[categoria] = [];
    for (const frase of trainingData[categoria]) {
      const vetor = await embed(frase);
      embeddingsDB[categoria].push({ frase, vetor });
      console.log(`[OK] Embedding → ${categoria}: ${frase}`);
    }
  }

  fs.writeFileSync(path.join(__dirname, "..", "embeddings.json"), JSON.stringify(embeddingsDB));
  console.log("\n✅ embeddings.json gerado com sucesso.\n");
}

gerar();
