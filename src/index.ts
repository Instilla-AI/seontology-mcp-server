#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { ContentExtractor } from './services/content-extractor.js';
import { SEOAnalyzer } from './services/seo-analyzer.js';
import { SEOntologyFormatter } from './services/seontology-formatter.js';

// Load environment variables
dotenv.config();

// Express app for health checks
const app = express();
const port = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'seontology-mcp-server' 
  });
});

// Initialize services
const contentExtractor = new ContentExtractor();
const seoAnalyzer = new SEOAnalyzer();
const seontologyFormatter = new SEOntologyFormatter();

// Create MCP server
const server = new Server(
  {
    name: 'seontology-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
const tools: Tool[] = [
  {
    name: 'analyze_webpage',
    description: 'Analyze a webpage using SEOntology framework',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to analyze' },
        includeContent: { type: 'boolean', default: true },
        includeLinks: { type: 'boolean', default: true },
        includeImages: { type: 'boolean', default: true },
      },
      required: ['url'],
    },
  },
  {
    name: 'extract_entities',
    description: 'Extract entities from content using SEOntology',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        content: { type: 'string' },
      },
    },
  },
];

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  try {
    switch (name) {
case 'analyze_webpage': {
        const { url, includeContent = true, includeLinks = true, includeImages = true } = args as {
          url: string;
          includeContent?: boolean;
          includeLinks?: boolean;
          includeImages?: boolean;
        };

        const contentData = await contentExtractor.extractFromUrl(url);
        const seoData = await seoAnalyzer.analyzePage(contentData, {
          includeContent,
          includeLinks,
          includeImages,
        });
        const seontologyData = seontologyFormatter.formatAnalysis(seoData);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(seontologyData, null, 2),
          }],
        };
      }

      case 'extract_entities': {
        const { url, content } = args as { url?: string; content?: string; };

        let extractedContent;
        if (url) {
          extractedContent = await contentExtractor.extractFromUrl(url);
        } else if (content) {
          extractedContent = contentExtractor.extractFromText(content);
        } else {
          throw new Error('Either url or content must be provided');
        }

        const entities = await seoAnalyzer.extractEntities(extractedContent);
        const formattedEntities = seontologyFormatter.formatEntities(entities);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(formattedEntities, null, 2),
          }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error instanceof Error ? error.message : String(error)}`,
      }],
      isError: true,
    };
  }
});

// Start HTTP server
app.listen(port, () => {
  console.log(`SEOntology MCP Server running on port ${port}`);
});

// Start MCP server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('SEOntology MCP Server connected');
}

main().catch(console.error);
