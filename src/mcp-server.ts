// src/mcp-server.ts
import express from "express";
import { HttpServerTransport } from "@modelcontextprotocol/sdk/transport/http";
import { Server } from "@modelcontextprotocol/sdk/server";

const app = express();
app.use(express.json());

const mcp = new Server({ name: "seontology-mcp", version: "0.1.0" });

// Chunking minimale: separa in paragrafi
function simpleChunk(text: string): Array<{ chunkText: string; chunkPosition: number }> {
  return text
    .split(/\n\s*\n/) // split su righe vuote
    .map(s => s.trim())
    .filter(Boolean)
    .map((chunk, i) => ({ chunkText: chunk, chunkPosition: i + 1 }));
}

mcp.tool("wrap_as_seontology", {
  description: "Impacchetta URL+title+meta (e testo opzionale) in JSON-LD conforme a SEOntology",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL canonico della pagina" },
      title: { type: "string", description: "Titolo HTML/SEO" },
      metaDescription: { type: "string", description: "Meta description" },
      primaryQuery: { type: "string", description: "Query primaria target" },
      bodyText: { type: "string", description: "Testo completo della pagina (opzionale)" },
      language: { type: "string", description: "Codice lingua (es. it, en)", default: "it" }
    },
    required: ["url", "title", "metaDescription", "primaryQuery"]
  },
  handler: async ({ url, title, metaDescription, primaryQuery, bodyText, language = "it" }) => {
    const context = {
      "@context": {
        "seo": "https://seontology.org/vocab#",
        "schema": "https://schema.org/",
      }
    };

    const primaryQueryNode = {
      "@type": "seo:Query",
      "schema:name": primaryQuery,
      "seo:intent": null // potrai popolarlo in step successivi
    };

    const chunks = bodyText ? simpleChunk(bodyText).map(c => ({
      "@type": "seo:Chunk",
      "seo:chunkPosition": c.chunkPosition,
      "seo:chunkText": c.chunkText
    })) : [];

    const jsonld = {
      ...context,
      "@type": "seo:WebPage",
      "@id": url,
      "schema:url": url,
      "seo:title": title,
      "seo:metaDescription": metaDescription,
      "seo:hasPrimaryQuery": primaryQueryNode,
      ...(chunks.length ? { "seo:hasChunk": chunks } : {}),
      "seo:hasLanguage": language ? { "@type": "schema:Language", "schema:name": language } : undefined
    };

    return { content: jsonld };
  }
});

const transport = new HttpServerTransport({ app, path: "/mcp" });
await mcp.connect(transport);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MCP ready on :${PORT}/mcp`));
