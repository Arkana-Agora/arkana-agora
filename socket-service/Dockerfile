# T067 — Dockerfile do Socket.io mini-service (ADR-007, porta 3003).
# Revisão I-b: base fixa `node:20.20.2-alpine3.23` (tag verificada no
# Docker Hub — sem `node:20-alpine` flutuante), árvore npm SÓ do serviço
# (package.json/lock locais, nunca o lockfile do monólito), tsx como
# dependência local (sem `npm i -g`) e runtime não-root (USER node).
# REDIS_URL/AUTH_URL/JWT_PUBLIC_KEY chegam do orquestrador (Railway/dev).
FROM node:20.20.2-alpine3.23

WORKDIR /app

ENV NODE_ENV=production \
    SOCKET_PORT=3003

# Lockfile do serviço: `npm ci` reproduzível com a árvore mínima.
COPY socket-service/package.json socket-service/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY socket-service ./socket-service

# Revisão I-b: executa como o usuário `node` (já existe na imagem), não
# como root — npm ci roda antes (instalação como root é só de build).
USER node

EXPOSE 3003

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3003/health || exit 1

CMD ["./node_modules/.bin/tsx", "socket-service/index.ts"]
