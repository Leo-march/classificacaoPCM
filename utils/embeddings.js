require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Inicializa cliente com sua GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embed(text) {
  const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

  const result = await model.embedContent({
    content: { parts: [{ text }] }
  });

  return result.embedding.values;
}

module.exports = { cosineSimilarity, embed };
