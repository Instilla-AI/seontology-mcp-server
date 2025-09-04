import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// 1) Creazione dell'app Express
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Supporto form-urlencoded

// CORS per permettere chiamate da n8n
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "seontology-mcp-server", timestamp: new Date().toISOString() });
});

// Endpoint principale
app.get("/", (req, res) => {
  res.json({ 
    service: "SEOntology MCP Server", 
    version: "0.1.0",
    endpoints: {
      health: "/health",
      seontology: "/api/seontology",
      extractQuery: "/api/extract-query",
      test: "/api/test",
      mcp: "/mcp (STDIO only)"
    }
  });
});

// Endpoint di test semplice
app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "Server funzionante",
    timestamp: new Date().toISOString(),
    query: req.query
  });
});

app.post("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "POST test ricevuto",
    body: req.body,
    headers: req.headers,
    timestamp: new Date().toISOString()
  });
});

// 2) Funzioni SEOntology

// Funzione per creare JSON-LD SEOntology
function createSeontologyJsonLD(args: {
  url: string;
  title: string;
  metaDescription: string;
  primaryQuery: string;
  bodyText?: string;
  language?: string;
}) {
  const { url, title, metaDescription, primaryQuery } = args;
  const bodyText = args.bodyText ?? "";
  const language = args.language ?? "it";

  // Validazione
  const requiredFields = ["url", "title", "metaDescription", "primaryQuery"];
  for (const field of requiredFields) {
    if (!args[field as keyof typeof args] || typeof args[field as keyof typeof args] !== "string" || !args[field as keyof typeof args]?.trim()) {
      throw new Error(`Campo richiesto mancante o vuoto: ${field}`);
    }
  }

  // Chunking semplice
  const chunks: Array<{
    "@type": string;
    "seo:chunkPosition": number;
    "seo:chunkText": string;
  }> = [];

  if (bodyText && bodyText.trim()) {
    const rawChunks = bodyText
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    rawChunks.forEach((text, i) => {
      chunks.push({
        "@type": "seo:Chunk",
        "seo:chunkPosition": i + 1,
        "seo:chunkText": text
      });
    });
  }

  // Costruzione JSON-LD
  const jsonld = {
    "@context": {
      seo: "https://seontology.org/vocab#",
      schema: "https://schema.org/"
    },
    "@type": "seo:WebPage",
    "@id": url,
    "schema:url": url,
    "seo:title": title,
    "seo:metaDescription": metaDescription,
    "seo:hasPrimaryQuery": {
      "@type": "seo:Query",
      "schema:name": primaryQuery
    },
    "seo:hasLanguage": {
      "@type": "schema:Language",
      "schema:name": language
    },
    ...(chunks.length > 0 && { "seo:hasChunk": chunks }),
    "schema:dateModified": new Date().toISOString()
  };

  return jsonld;
}

// Funzione per estrarre la query principale da una pagina
function extractMainQuery(args: {
  url?: string;
  title: string;
  metaDescription: string;
  bodyText: string;
  language?: string;
}) {
  const { url, title, metaDescription, bodyText } = args;
  const language = args.language ?? "en";

  // Validazione
  if (!title?.trim() || !bodyText?.trim()) {
    throw new Error("Title e bodyText sono richiesti per l'estrazione della query");
  }

  // Combina tutti i testi per l'analisi
  const allText = `${title} ${metaDescription} ${bodyText}`.toLowerCase();
  
  // Parole di stop comuni (basic list)
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
  ]);

  // Estrai potenziali keywords
  const words = allText
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));

  // Conta frequenze
  const wordFreq = new Map<string, number>();
  words.forEach(word => {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  });

  // Trova bigrammi e trigrammi significativi
  const ngrams = new Map<string, number>();
  
  // Bigrammi
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
      ngrams.set(bigram, (ngrams.get(bigram) || 0) + 1);
    }
  }

  // Trigrammi
  for (let i = 0; i < words.length - 2; i++) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1]) && !stopWords.has(words[i + 2])) {
      ngrams.set(trigram, (ngrams.get(trigram) || 0) + 1);
    }
  }

  // Combina singole parole e ngrams con pesi
  const candidates = new Map<string, number>();
  
  // Pesa le singole parole
  wordFreq.forEach((freq, word) => {
    let score = freq;
    // Boost se appare nel titolo
    if (title.toLowerCase().includes(word)) score += 3;
    // Boost se appare nella meta description
    if (metaDescription.toLowerCase().includes(word)) score += 2;
    candidates.set(word, score);
  });

  // Pesa gli ngrams (hanno priorità)
  ngrams.forEach((freq, ngram) => {
    let score = freq * 2; // Ngrams hanno peso maggiore
    // Boost se appare nel titolo
    if (title.toLowerCase().includes(ngram)) score += 5;
    // Boost se appare nella meta description
    if (metaDescription.toLowerCase().includes(ngram)) score += 3;
    candidates.set(ngram, score);
  });

  // Ordina per score
  const sortedCandidates = Array.from(candidates.entries())
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);

  // Determina query type basico
  let queryType = "informational";
  const commercialTerms = ["buy", "price", "cost", "cheap", "deal", "discount", "shop", "store"];
  const transactionalTerms = ["download", "get", "free", "trial", "signup", "register"];
  
  if (commercialTerms.some(term => allText.includes(term))) {
    queryType = "commercial";
  } else if (transactionalTerms.some(term => allText.includes(term))) {
    queryType = "transactional";
  }

  // Costruisci il risultato SEOntology
  const mainQuery = sortedCandidates[0]?.[0] || title.toLowerCase();
  const alternativeQueries = sortedCandidates.slice(1, 5).map(([query]) => query);

  const result = {
    "@context": {
      seo: "https://seontology.org/vocab#",
      schema: "https://schema.org/"
    },
    "@type": "seo:Query",
    "schema:name": mainQuery,
    "seo:queryType": queryType,
    "seo:language": language,
    "seo:queryScore": sortedCandidates[0]?.[1] || 1,
    "seo:alternativeQueries": alternativeQueries,
    "seo:extractedFrom": url || "provided content",
    "schema:dateCreated": new Date().toISOString()
  };

  return result;
}

// 3) HTTP REST API endpoints

// Endpoint per estrarre la query principale
app.post("/api/extract-query", async (req, res) => {
  try {
    const { url, title, metaDescription, bodyText, language } = req.body;

    // Validazione
    if (!title?.trim()) {
      throw new Error("Il campo 'title' è richiesto");
    }
    if (!bodyText?.trim()) {
      throw new Error("Il campo 'bodyText' è richiesto");
    }

    // Estrai la query principale
    const queryResult = extractMainQuery({
      url,
      title,
      metaDescription: metaDescription || "",
      bodyText,
      language
    });

    const summary = `Query principale estratta: "${queryResult["schema:name"]}"\n` +
                   `Tipo di query: ${queryResult["seo:queryType"]}\n` +
                   `Score: ${queryResult["seo:queryScore"]}\n` +
                   `Query alternative: ${queryResult["seo:alternativeQueries"].join(", ")}\n` +
                   `Lingua: ${queryResult["seo:language"]}`;

    res.json({
      success: true,
      summary: summary,
      query: queryResult,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Errore estrazione query:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint per generare JSON-LD SEOntology
app.post("/api/seontology", async (req, res) => {
  try {
    const { url, title, metaDescription, primaryQuery, bodyText, language } = req.body;

    // Crea il JSON-LD
    const jsonld = createSeontologyJsonLD({
      url,
      title,
      metaDescription,
      primaryQuery,
      bodyText,
      language
    });

    const summary = `JSON-LD SEOntology creato con successo per: ${title}\n` +
                   `URL: ${url}\n` +
                   `Query primaria: ${primaryQuery}\n` +
                   `Chunks generati: ${jsonld["seo:hasChunk"]?.length || 0}\n` +
                   `Lingua: ${language || "it"}`;

    res.json({
      success: true,
      summary: summary,
      jsonLd: jsonld,
      processedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error("Errore API SEOntology:", error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Errore sconosciuto",
      timestamp: new Date().toISOString()
    });
  }
});

// 4) Endpoint per compatibilità MCP (formato jsonrpc)
app.post("/mcp", async (req, res) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    if (jsonrpc !== "2.0") {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: id,
        error: { code: -32600, message: "Invalid Request - jsonrpc must be 2.0" }
      });
    }

    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          tools: [
            {
              name: "wrap_as_seontology",
              description: "Impacchetta url/title/meta (+ testo opzionale) in JSON-LD conforme a SEOntology",
              inputSchema: {
                type: "object",
                properties: {
                  url: { type: "string", description: "URL canonico della pagina web" },
                  title: { type: "string", description: "Titolo HTML/SEO della pagina" },
                  metaDescription: { type: "string", description: "Meta description della pagina" },
                  primaryQuery: { type: "string", description: "Query primaria target" },
                  bodyText: { type: "string", description: "Testo completo della pagina (opzionale)" },
                  language: { type: "string", description: "Codice lingua", default: "it" }
                },
                required: ["url", "title", "metaDescription", "primaryQuery"]
              }
            },
            {
              name: "extract_main_query",
              description: "Estrae la query principale da una pagina analizzando titolo, descrizione e contenuto",
              inputSchema: {
                type: "object",
                properties: {
                  title: { type: "string", description: "Titolo HTML/SEO della pagina" },
                  metaDescription: { type: "string", description: "Meta description della pagina" },
                  bodyText: { type: "string", description: "Testo completo della pagina" },
                  url: { type: "string", description: "URL della pagina (opzionale)" },
                  language: { type: "string", description: "Codice lingua", default: "en" }
                },
                required: ["title", "bodyText"]
              }
            }
          ]
        }
      });
    }

    if (method === "tools/call" && params?.name === "wrap_as_seontology") {
      const jsonld = createSeontologyJsonLD(params.arguments);
      
      const summary = `JSON-LD SEOntology creato con successo per: ${params.arguments.title}\n` +
                     `URL: ${params.arguments.url}\n` +
                     `Query primaria: ${params.arguments.primaryQuery}\n` +
                     `Chunks generati: ${jsonld["seo:hasChunk"]?.length || 0}\n` +
                     `Lingua: ${params.arguments.language || "it"}`;

      return res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(jsonld, null, 2) }
          ]
        }
      });
    }

    if (method === "tools/call" && params?.name === "extract_main_query") {
      const queryResult = extractMainQuery(params.arguments);
      
      const summary = `Query principale estratta: "${queryResult["schema:name"]}"\n` +
                     `Tipo di query: ${queryResult["seo:queryType"]}\n` +
                     `Score: ${queryResult["seo:queryScore"]}\n` +
                     `Query alternative: ${queryResult["seo:alternativeQueries"].join(", ")}\n` +
                     `Lingua: ${queryResult["seo:language"]}`;

      return res.json({
        jsonrpc: "2.0",
        id: id,
        result: {
          content: [
            { type: "text", text: summary },
            { type: "text", text: JSON.stringify(queryResult, null, 2) }
          ]
        }
      });
    }

    res.status(404).json({
      jsonrpc: "2.0",
      id: id,
      error: { code: -32601, message: `Method not found: ${method}` }
    });

  } catch (error) {
    console.error("Errore MCP endpoint:", error);
    res.status(500).json({
      jsonrpc: "2.0",
      id: req.body?.id,
      error: { 
        code: -32603, 
        message: "Internal error", 
        data: error instanceof Error ? error.message : "Unknown error" 
      }
    });
  }
});

// 5) Funzione per inizializzare il server MCP STDIO (per uso locale)
async function initMcpServer() {
  const server = new Server({
    name: "seontology-mcp",
    version: "0.1.0",
  }, {
    capabilities: { tools: {} },
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "wrap_as_seontology",
          description: "Impacchetta url/title/meta (+ testo opzionale) in JSON-LD conforme a SEOntology",
          inputSchema: {
            type: "object",
            properties: {
              url: { type: "string", description: "URL canonico della pagina web" },
              title: { type: "string", description: "Titolo HTML/SEO della pagina" },
              metaDescription: { type: "string", description: "Meta description della pagina" },
              primaryQuery: { type: "string", description: "Query primaria target" },
              bodyText: { type: "string", description: "Testo completo della pagina (opzionale)" },
              language: { type: "string", description: "Codice lingua", default: "it" }
            },
            required: ["url", "title", "metaDescription", "primaryQuery"]
          }
        },
        {
          name: "extract_main_query",
          description: "Estrae la query principale da una pagina analizzando titolo, descrizione e contenuto",
          inputSchema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Titolo HTML/SEO della pagina" },
              metaDescription: { type: "string", description: "Meta description della pagina" },
              bodyText: { type: "string", description: "Testo completo della pagina" },
              url: { type: "string", description: "URL della pagina (opzionale)" },
              language: { type: "string", description: "Codice lingua", default: "en" }
            },
            required: ["title", "bodyText"]
          }
        }
      ]
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "wrap_as_seontology") {
      const jsonld = createSeontologyJsonLD(args as any);
      const summary = `JSON-LD SEOntology creato con successo per: ${(args as any).title}`;

      return {
        content: [
          { type: "text", text: summary },
          { type: "text", text: JSON.stringify(jsonld, null, 2) }
        ]
      };
    }

    if (name === "extract_main_query") {
      const queryResult = extractMainQuery(args as any);
      const summary = `Query principale estratta: "${queryResult["schema:name"]}" (${queryResult["seo:queryType"]})`;

      return {
        content: [
          { type: "text", text: summary },
          { type: "text", text: JSON.stringify(queryResult, null, 2) }
        ]
      };
    }

    throw new McpError(ErrorCode.MethodNotFound, `Tool non trovato: ${name}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP STDIO server avviato con successo");
}

// 6) Avvio del server HTTP
const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`✅ HTTP server avviato su porta ${PORT}`);
  console.log(`🌍 API endpoint: http://localhost:${PORT}/api/seontology`);
  console.log(`🔍 Query extraction: http://localhost:${PORT}/api/extract-query`);
  console.log(`🔗 MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
});

// 7) Avvio del server MCP STDIO se eseguito direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  initMcpServer().catch((error) => {
    console.error("Errore durante l'avvio del server MCP:", error);
    process.exit(1);
  });
}
