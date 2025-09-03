# Multi-stage build for SEOntology MCP Server

# 1. Build stage - Compilazione TypeScript
FROM node:20-alpine AS builder

WORKDIR /app

# Installa le dipendenze necessarie per la build
RUN apk add --no-cache python3 make g++

# Copia i file di configurazione
COPY package*.json ./
COPY tsconfig.json ./

# Installa tutte le dipendenze (dev incluse)
RUN npm ci --only=production=false

# Copia il codice sorgente
COPY src/ ./src/

# Compila TypeScript
RUN npm run build

# 2. Runtime stage - Produzione
FROM node:20-alpine AS runtime

WORKDIR /app

# Installa curl per health checks
RUN apk add --no-cache curl

# Crea utente non-root per sicurezza
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001

# Copia solo i file necessari per la produzione
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Installa solo le dipendenze di produzione
RUN npm install --omit=dev && npm cache clean --force

# Cambia proprietario dei file
RUN chown -R nextjs:nodejs /app

# Cambia utente
USER nextjs

# Esponi la porta (Railway userà la variabile PORT automaticamente)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

# Comando di avvio
CMD ["node", "dist/mcp-server.js"]
