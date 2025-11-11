Sistema de Classificação de Ordens de Serviço
Sistema automatizado que classifica Ordens de Serviço em:

PREVENTIVA
CORRETIVA_PRONTO_ATENDIMENTO
CORRETIVA_PROGRAMADA
Usa Algoritmo + IA (NLP) para classificação inteligente.

🚀 Como Usar
1. Instalar dependências
bash
npm install
2. Colocar sua planilha
Coloque seu arquivo Excel em:

data/input/ordens_servico.xlsx
3. Executar
bash
npm start
4. Ver resultado
O arquivo classificado será salvo em:

data/output/ordens_classificadas_YYYY-MM-DD.xlsx
📊 Formato da Planilha de Entrada
Sua planilha deve ter as seguintes colunas:

Coluna	Exemplo
Ordem Serv.	013022
Dt. Inicio	01/12/2025
Nome do Bem	AERADOR MONDOMIX MARSH 1
SERVICO	PREVENTIVA10001144
Linha	MEC GERAL III
Previsto Inicio	20/10/2025
Previsto Fim	22/10/2025
area de manutenção	área XYZ
🧠 Como Funciona
Fluxo de Processamento:
Excel → JSON: Lê a planilha
Algoritmo: Analisa datas, extrai palavras-chave
Regras: Aplica regras lógicas rápidas
IA/NLP: Classifica casos ambíguos
Excel: Salva resultado com classificação
Regras Algorítmicas (prioridade):
Se SERVICO contém "PREVENTIV" → PREVENTIVA (99% confiança)
Se menos de 2 dias de antecedência → CORRETIVA_PRONTO_ATENDIMENTO (95%)
Se contém "CORRETIV" + mais de 5 dias → CORRETIVA_PROGRAMADA (90%)
Caso contrário → NLP analisa o contexto completo
📁 Estrutura de Arquivos
meu-projeto-classificacao/
├── package.json
├── README.md
├── src/
│   ├── index.js                    ← ARQUIVO PRINCIPAL
│   ├── services/
│   │   ├── excelReader.js          ← Lê Excel
│   │   ├── preprocessor.js         ← Algoritmo
│   │   └── classifier.js           ← IA/NLP
│   └── utils/
│       └── excelWriter.js          ← Salva Excel
├── data/
│   ├── input/
│   │   └── ordens_servico.xlsx     ← COLOQUE SUA PLANILHA AQUI
│   └── output/
│       └── (resultados gerados)
└── node_modules/
📈 Exemplo de Saída
🚀 Iniciando classificação de Ordens de Serviço...

📂 Lendo arquivo: data/input/ordens_servico.xlsx
✅ 65 ordens de serviço encontradas

🤖 Configurando modelo NLP...
✅ Modelo treinado com sucesso!

⚙️  Processando ordens de serviço...
   Processadas: 65/65

📈 RESUMO DA CLASSIFICAÇÃO:
══════════════════════════════════════════════════
PREVENTIVA                             45 (69.2%)
CORRETIVA_PRONTO_ATENDIMENTO           12 (18.5%)
CORRETIVA_PROGRAMADA                    8 (12.3%)
══════════════════════════════════════════════════
TOTAL: 65 ordens de serviço
Confiança média: 94.3%

💾 Planilha salva em: data/output/ordens_classificadas_2025-11-11.xlsx

✨ Processamento concluído com sucesso!
🔧 Melhorias Futuras
 Adicionar mais exemplos de treinamento
 Interface web para upload de planilhas
 Dashboard com gráficos
 Integração com banco de dados
 API REST para classificação em tempo real
📝 Notas
O sistema aprende com os padrões dos seus dados
Você pode adicionar mais regras em classifier.js
Para treinar melhor, adicione mais exemplos em configurarNLP()
