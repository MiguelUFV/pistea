FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server.js legal.js estaciones_geo.json ./
COPY public ./public
COPY mapas ./mapas
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data MAPS_DIR=/app/mapas TRUST_PROXY=1
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK CMD node -e "fetch('http://localhost:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--no-warnings", "server.js"]
