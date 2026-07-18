# --- Build-Stage: Frontend bauen ---------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

# Nur Manifeste kopieren, damit die npm-Installation gecacht wird.
COPY package.json package-lock.json* ./
COPY client/package.json ./client/
COPY server/package.json ./server/
RUN npm install

# Restlichen Code kopieren und Frontend bauen.
COPY . .
RUN npm run build

# --- Runtime-Stage: schlankes Image mit nur den Server-Abhängigkeiten --------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Nur Produktions-Abhängigkeiten des Servers installieren.
COPY server/package.json ./server/package.json
RUN cd server && npm install --omit=dev

# Server-Code und gebautes Frontend übernehmen.
COPY server ./server
COPY --from=build /app/client/dist ./client/dist

EXPOSE 3000
CMD ["node", "server/index.js"]
