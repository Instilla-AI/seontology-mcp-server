import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const app = express();
app.use(express.json());

// 1) Istanzia MCP server
const server = new McpServer({
  name: "seontology-mcp",
  version: "0.1.0",
});

// 2) Registra il tool minimale: wrap_as_seontology
server.registerTool(
  "wrap_as_seontology",
  {
    title: "Wrap WebPage as SEOntology JSON-LD",
    description:
      "Impacchetta url/title/meta (+ testo opzionale) in JSON-LD conforme a SEOntology",
    // JSON Schema (niente Zod, per semplicità/compatibilità)
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string", description: "URL canonico della pagina" },
        title: { type: "string", description: "Titolo HTML/SEO" },
        metaDescription: { type: "string", description: "Meta description" },
        primaryQuery: { type: "string", description: "Query primaria target" },
        bodyText: {
          type: "string",
          description: "Testo completo della pagina (opzionale)"
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
  },
  async (args: {
    url: string;
    title: string;
    metaDescription: string;
    primaryQuery: string;
    bodyText?: string;
    language?: string;
  }) => {
    const { url, title, metaDescription, primaryQuery } = args;
    const bodyText = args.bodyText ?? "";
    const language = args.language ?? "it";

    // Chunking molto semplice: split su paragrafi (righe vuote)
    const rawChunks = bodyText
      .split(/\n\s*\n/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const chunks = rawChunks.map((text, i) => ({
      "@type": "seo:Chunk",
      "seo:chunkPosition": i + 1,
      "seo:chunkText": text
    }));

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
      ...(chunks.length ? { "seo:hasChunk": chunks } : {}),
      "seo:hasLanguage": {
        "@type": "schema:Language",
        "schema:name": language
      }
    };

    return { content: [{ type: "json", json: jsonld }] };
  }
);

// 3) Transport HTTP “streamable”
const transport = new StreamableHTTPServerTransport({
  app,
  endpoint: "/mcp"
});
await server.connect(transport);

// 4) Avvio server HTTP
const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MCP server ready on :${PORT}/mcp`);
});
