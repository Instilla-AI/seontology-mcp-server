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
app.use(express.urlencoded({ extended: true })); // Aggiungi supporto form-urlencoded

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

// 2) Funzione per creare JSON-LD SEOntology (estratta dal MCP per riuso)
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

// 3) HTTP REST API endpoint per n8n
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
          tools: [{
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
          }]
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
      tools: [{
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
      }]
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
