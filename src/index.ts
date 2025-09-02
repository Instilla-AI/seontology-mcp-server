import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import dotenv from 'dotenv';
import { SEOAnalyzer } from './services/seo-analyzer.js';
import { SEOntologyFormatter } from './services/seontology-formatter.js';
import { ContentExtractor } from './services/content-extractor.js';

dotenv.config();

// Configurazione
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Rate limiting
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  duration: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') / 1000, // 15 minutes
});

// Initialize services
const seoAnalyzer = new SEOAnalyzer();
const formatter = new SEOntologyFormatter();
const contentExtractor = new ContentExtractor();

// MCP Server Setup
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

// Available MCP Tools
const TOOLS = [
  {
    name: 'analyze_page',
    description: 'Analyze a webpage using SEOntology framework',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the webpage to analyze',
        },
        options: {
          type: 'object',
          properties: {
            includeImages: { type: 'boolean', default: true },
            extractEntities: { type: 'boolean', default: true },
            qualityScore: { type: 'boolean', default: true },
            deepAnalysis: { type: 'boolean', default: false },
          },
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'extract_keywords',
    description: 'Extract keywords from webpage content',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the webpage',
        },
        maxKeywords: {
          type: 'number',
          description: 'Maximum number of keywords to extract',
          default: 20,
        },
        minFrequency: {
          type: 'number', 
          description: 'Minimum frequency threshold',
          default: 2,
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'generate_schema',
    description: 'Generate structured data schema for SEO',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the webpage',
        },
        schemaType: {
          type: 'string',
          enum: ['Article', 'WebPage', 'Product', 'Organization', 'Person'],
          default: 'Article',
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'analyze_internal_links',
    description: 'Analyze internal link structure and opportunities',
    inputSchema: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'URL of the webpage or domain',
        },
        depth: {
          type: 'number',
          description: 'Crawling depth for link analysis',
          default: 2,
        },
        checkBroken: {
          type: 'boolean',
          description: 'Check for broken internal links',
          default: true,
        },
      },
      required: ['url'],
    },
  },
  {
    name: 'content_gap_analysis',
    description: 'Identify content gaps using SEOntology entity mapping',
    inputSchema: {
      type: 'object',
      properties: {
        primaryUrl: {
          type: 'string',
          description: 'Primary domain/page to analyze',
        },
        competitorUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Competitor URLs for comparison',
        },
        topic: {
          type: 'string',
          description: 'Main topic/industry for analysis',
        },
      },
      required: ['primaryUrl', 'competitorUrls'],
    },
  },
];

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: TOOLS,
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'analyze_page':
        return await handleAnalyzePage(args);
      case 'extract_keywords':
        return await handleExtractKeywords(args);
      case 'generate_schema':
        return await handleGenerateSchema(args);
      case 'analyze_internal_links':
        return await handleAnalyzeInternalLinks(args);
      case 'content_gap_analysis':
        return await handleContentGapAnalysis(args);
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error.message}`);
  }
});

// Tool handlers
async function handleAnalyzePage(args: any) {
  const { url, options = {} } = args;
  
  // Extract content
  const content = await contentExtractor.extract(url);
  
  // Perform SEO analysis
  const analysis = await seoAnalyzer.analyzePage(content, options);
  
  // Format using SEOntology
  const formatted = formatter.formatPageAnalysis(url, analysis);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formatted, null, 2),
      },
    ],
  };
}

async function handleExtractKeywords(args: any) {
  const { url, maxKeywords = 20, minFrequency = 2 } = args;
  
  const content = await contentExtractor.extract(url);
  const keywords = await seoAnalyzer.extractKeywords(content, {
    maxKeywords,
    minFrequency,
  });
  
  const formatted = formatter.formatKeywordAnalysis(url, keywords);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formatted, null, 2),
      },
    ],
  };
}

async function handleGenerateSchema(args: any) {
  const { url, schemaType = 'Article' } = args;
  
  const content = await contentExtractor.extract(url);
  const schema = await seoAnalyzer.generateSchema(content, schemaType);
  
  return {
    content: [
      {
        type: 'text', 
        text: JSON.stringify(schema, null, 2),
      },
    ],
  };
}

async function handleAnalyzeInternalLinks(args: any) {
  const { url, depth = 2, checkBroken = true } = args;
  
  const linkAnalysis = await seoAnalyzer.analyzeInternalLinks(url, {
    depth,
    checkBroken,
  });
  
  const formatted = formatter.formatLinkAnalysis(url, linkAnalysis);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formatted, null, 2),
      },
    ],
  };
}

async function handleContentGapAnalysis(args: any) {
  const { primaryUrl, competitorUrls, topic } = args;
  
  const gapAnalysis = await seoAnalyzer.analyzeContentGaps(
    primaryUrl,
    competitorUrls,
    topic
  );
  
  const formatted = formatter.formatContentGapAnalysis(primaryUrl, gapAnalysis);
  
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(formatted, null, 2),
      },
    ],
  };
}

// Express API Server (optional HTTP interface)
const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*',
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting middleware
app.use(async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Rate limit exceeded',
      resetTime: rejRes.msBeforeNext,
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'seontology-mcp-server',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// API endpoints
app.post('/api/analyze', async (req, res) => {
  try {
    const result = await handleAnalyzePage(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/keywords', async (req, res) => {
  try {
    const result = await handleExtractKeywords(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/schema', async (req, res) => {
  try {
    const result = await handleGenerateSchema(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/links', async (req, res) => {
  try {
    const result = await handleAnalyzeInternalLinks(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gap-analysis', async (req, res) => {
  try {
    const result = await handleContentGapAnalysis(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Status endpoint
app.get('/api/status', (req, res) => {
  res.json({
    service: 'SEOntology MCP Server',
    version: '1.0.0',
    environment: NODE_ENV,
    tools: TOOLS.length,
    uptime: process.uptime(),
  });
});

// Start servers
if (NODE_ENV === 'development' || process.env.HTTP_MODE === 'true') {
  // HTTP mode for development/testing
  app.listen(PORT, () => {
    console.log(`🚀 SEOntology MCP Server running on port ${PORT}`);
    console.log(`📚 API Documentation: http://localhost:${PORT}/api/status`);
  });
} else {
  // MCP mode for production
  const transport = new StdioServerTransport();
  server.connect(transport);
  console.log('🔗 SEOntology MCP Server running in MCP mode');
}
