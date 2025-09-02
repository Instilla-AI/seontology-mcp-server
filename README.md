# SEOntology MCP Server

🚀 **MCP Server per l'integrazione con SEOntology** - Framework semantico per l'analisi e ottimizzazione SEO


## 🌟 Caratteristiche

- ✅ **Analisi semantica** delle pagine web usando SEOntology
- ✅ **Estrazione automatica** di keywords e entità
- ✅ **Generazione schema markup** per SEO
- ✅ **Analisi link interni** e suggerimenti
- ✅ **Scoring qualità contenuti** multi-dimensionale
- ✅ **Content gap analysis** vs competitor
- ✅ **API RESTful** completa
- ✅ **Rate limiting** e security headers
- ✅ **Health checks** e monitoring
- ✅ **Deploy ready** su Railway, Docker, ecc.

## 🚀 Quick Start

### Sviluppo Locale

```bash
# Clone repository
git clone https://github.com/Instilla-AI/seontology-mcp-server.git
cd seontology-mcp-server

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env con le tue configurazioni

# Start development server
npm run dev
```

### Deploy su Railway

1. Clicca sul bottone "Deploy on Railway" sopra
2. Connetti il tuo repository GitHub
3. Configura le variabili d'ambiente
4. Deploy automatico!

**URL Deploy**: https://seontology-mcp-production.up.railway.app

## 📚 API Endpoints

### Analisi Pagine
```bash
POST /api/analyze
{
  "url": "https://example.com",
  "options": {
    "includeImages": true,
    "extractEntities": true,
    "qualityScore": true
  }
}
```

### Estrazione Keywords
```bash
POST /api/keywords
{
  "url": "https://example.com",
  "maxKeywords": 20,
  "minFrequency": 2
}
```

### Generazione Schema
```bash
POST /api/schema
{
  "url": "https://example.com",
  "type": "Article"
}
```

### Analisi Link
```bash
POST /api/links
{
  "url": "https://example.com",
  "checkBroken": true
}
```

### Content Gap Analysis
```bash
POST /api/gap-analysis
{
  "primaryUrl": "https://mysite.com",
  "competitorUrls": [
    "https://competitor1.com",
    "https://competitor2.com"
  ],
  "topic": "SEO optimization"
}
```

## 🏗️ Struttura SEOntology

```json
{
  "@context": {
    "seo": "https://seontology.org/",
    "schema": "https://schema.org/"
  },
  "@type": "seo:WebPage",
  "seo:hasURL": "https://example.com",
  "seo:title": "Page Title",
  "seo:hasQuery": [
    {
      "@type": "seo:Query",
      "seo:queryText": "main keyword",
      "seo:searchVolume": 1000
    }
  ],
  "seo:qualityScore": {
    "@type": "seo:QualityScore",
    "seo:overallScore": 85
  }
}
```

## 🔧 Configurazione

### Variabili d'ambiente

| Variabile | Descrizione | Default |
|-----------|-------------| --------|
| `PORT` | Porta server | `3000` |
| `NODE_ENV` | Ambiente | `production` |
| `HTTP_MODE` | Modalità HTTP per Railway | `true` |
| `OPENAI_API_KEY` | Chiave OpenAI (opzionale) | - |
| `RATE_LIMIT_MAX_REQUESTS` | Max richieste per finestra | `100` |

## 🐳 Docker

```bash
# Build image
docker build -t seontology-mcp .

# Run container
docker run -p 3000:3000 -e PORT=3000 seontology-mcp
```

## 🧪 Testing

```bash
# Run tests
npm test

# Test coverage
npm run test:coverage

# Lint code
npm run lint
```

## 📊 Monitoraggio

- **Health check**: `GET /health`
- **Metrics**: `GET /metrics` 
- **Status**: `GET /api/status`

## 🛠️ Sviluppo

### Architettura

- **MCP Protocol**: Compatibile con Model Context Protocol
- **Express API**: Server REST per accesso HTTP
- **TypeScript**: Type-safe development
- **Modulare**: Servizi separati per ogni funzionalità

### Servizi principali

- `SEOAnalyzer`: Analisi SEO completa
- `ContentExtractor`: Estrazione contenuti web
- `SEOntologyFormatter`: Formattazione dati SEOntology

## 🤝 Contributi

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/amazing-feature`)
3. Commit modifiche (`git commit -m 'Add amazing feature'`)
4. Push branch (`git push origin feature/amazing-feature`)
5. Apri Pull Request

## 📄 Licenza

MIT License - vedi [LICENSE](LICENSE) per dettagli.

## 🔗 Link Utili

- [SEOntology Framework](https://github.com/seontology/seontology)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Railway Deploy](https://railway.app/)
- [API Documentation](./docs/API.md)

---

**Creato con ❤️ da [Instilla-AI](https://github.com/Instilla-AI)**
