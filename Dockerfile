# 1. Build stage (TypeScript → JS)
FROM node:20 AS builder
WORKDIR /app

# Copia package e installa dipendenze
COPY package*.json tsconfig.json ./
RUN npm install

# Copia sorgenti
COPY src ./src

# Compila TypeScript
RUN npm run build

# 2. Runtime stage (solo JS e dipendenze prod)
FROM node:20-slim AS runtime
WORKDIR /app

# Copia package.json e node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Railway userà automaticamente la variabile PORT
ENV PORT=3000

# Avvio server MCP
CMD ["node", "dist/mcp-server.js"]
