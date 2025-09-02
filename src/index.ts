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
