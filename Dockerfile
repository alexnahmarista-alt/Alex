FROM node:20-bookworm-slim

WORKDIR /app

# Herramientas de compilación por si no hay binario precompilado de better-sqlite3
# para la plataforma de destino.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .
RUN mkdir -p data uploads/receipts

ENV NODE_ENV=production
EXPOSE 3000

CMD ["node", "src/server.js"]
