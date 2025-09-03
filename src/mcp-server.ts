import express from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

// 1) Creazione dell'app Express per la compatibilità Railway (HTTP endpoint)
const app = express();
app.use(express.json());

// Health check endpoint per Railway
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "seontology-mcp-server" });
});

// Endpoint principale
app.get("/", (req, res) => {
  res.json({ 
    service: "SEOntology MCP Server", 
    version: "0.1.0",
    endpoint: "/mcp" 
  });
});

// 2) Funzione principale per inizializzare il server MCP
async function main() {
  // Crea il server MCP
  const server = new Server({
    name: "seontology-mcp",
    version: "0.1.0",
  }, {
    capabilities: {
      tools: {},
    },
  });

  // Registra il tool per convertire contenuto web in JSON-LD SEOntology
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "wrap_as_seontology",
          description: "Impacchetta url/title/meta (+ testo opzionale) in JSON-LD conforme a SEOntology",
          inputSchema: {
            type: "object",
            properties: {
              url: { 
                type: "string", 
                description: "URL canonico della pagina web" 
              },
              title: { 
                type: "string", 
                description: "Titolo HTML/SEO della pagina" 
              },
              metaDescription: { 
                type: "string", 
                description: "Meta description della pagina" 
              },
              primaryQuery: { 
                type: "string", 
                description: "Query primaria target per cui la pagina dovrebbe rankare" 
              },
              bodyText: {
                type: "string",
                description: "Testo completo della pagina (opzionale per chunking)"
              },
              language: {
                type: "string",
                description: "Codice lingua (es. it, en)",
                default: "it"
              }
            },
            required: ["url", "title", "metaDescription", "primaryQuery"],
            additionalProperties: false
          }
        }
      ]
    };
  });

  // Handler per l'esecuzione del tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name !== "wrap_as_seontology") {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Tool non trovato: ${name}`
      );
    }

    try {
      // Validazione degli argomenti richiesti
      const requiredFields = ["url", "title", "metaDescription", "primaryQuery"];
      for (const field of requiredFields) {
        if (!args || typeof args[field] !== "string" || !args[field].trim()) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Campo richiesto mancante o vuoto: ${field}`
          );
        }
      }

      const {
        url,
        title,
        metaDescription,
        primaryQuery,
        bodyText = "",
        language = "it"
      } = args as {
        url: string;
        title: string;
        metaDescription: string;
        primaryQuery: string;
        bodyText?: string;
        language?: string;
      };

      // Chunking semplice: split su paragrafi (righe vuote multiple)
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

      // Costruzione del JSON-LD conforme a SEOntology
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
        // Aggiungi chunks solo se presenti
        ...(chunks.length > 0 && { "seo:hasChunk": chunks }),
        // Timestamp per tracciamento
        "schema:dateModified": new Date().toISOString()
      };

      return {
        content: [
          {
            type: "text",
            text: `JSON-LD SEOntology creato con successo per: ${title}\n` +
                  `URL: ${url}\n` +
                  `Query primaria: ${primaryQuery}\n` +
                  `Chunks generati: ${chunks.length}\n` +
                  `Lingua: ${language}`
          },
          {
            type: "text",
            text: JSON.stringify(jsonld, null, 2)
          }
        ]
      };

    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Errore nella creazione del JSON-LD SEOntology: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  });

  // Connessione STDIO per MCP
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("SEOntology MCP server avviato con successo");
}

// 3) Avvio del server HTTP per Railway
const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`HTTP server avviato su porta ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

// 4) Avvio del server MCP se eseguito direttamente
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error("Errore durante l'avvio del server MCP:", error);
    process.exit(1);
  });
}
