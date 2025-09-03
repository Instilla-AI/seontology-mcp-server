import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

const app = express();
app.use(express.json());

// Istanzia MCP server
const server = new McpServer({
  name: "seontology-mcp",
  version: "0.1.0",
});

// Tool minimale: wrap_as_seontology
server.registerTool(
  "wrap_as_seontology",
  {
    title: "Wrap WebPage as SEOntology JSON-LD",
    description:
      "Impacchetta url/title/meta (+ testo opzionale) in JSON-LD conforme a SEOntology",
    inputSchema: z.object({
      url: z.string().url(),
      title: z.string(),
      metaDescription: z.string(),
      primaryQuery: z.string(),
      bodyText: z.string().optional(),
      language: z.string().default("it"),
    }),
  },
  async ({ url, title, metaDescription, primaryQuery, bodyText, language }) => {
    const chunks =
      bodyText
        ?.split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((text, i) => ({
          "@type": "seo:Chunk",
          "seo:chunkPosition": i + 1,
          "seo:chunkText": text,
        })) ?? [];

    const jsonld = {
      "@context": {
        seo: "https://seontology.org/vocab#",
        schema: "https://schema.org/",
      },
      "@type": "seo:WebPage",
      "@id": url,
      "schema:url": url,
      "seo:title": title,
      "seo:metaDescription": metaDescription,
      "seo:hasPrimaryQuery": {
        "@type": "seo:Query",
        "schema:name": primaryQuery,
      },
      ...(chunks.length ? { "seo:hasChunk": chunks } : {}),
      "seo:hasLanguage": {
        "@type": "schema:Language",
        "schema:name": language,
      },
    };

    return { content: [{ type: "json", json: jsonld }] };
  }
);

// Transport “Streamable HTTP” con gestione sessioni (raccomandato)
const transports: Record<string, StreamableHTTPServerTransport> = {};
app.all("/mcp", async (req, res) => {
  // Crea (o riprendi) una sessione
  const sessionId = (req.query.sessionId as string) ?? randomUUID();
  let transport = transports[sessionId];
  if (!transport) {
    transport = new StreamableHTTPServerTransport({ req, res, sessionId });
    transports[sessionId] = transport;
    transport.onclose = () => delete transports[sessionId];
    await server.connect(transport);
  } else {
    await transport.handleRequest(req, res);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP on :${PORT}/mcp`));
