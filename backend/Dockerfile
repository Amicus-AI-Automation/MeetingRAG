FROM node:20-alpine

WORKDIR /app

# Install production dependencies first (cached layer)
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Copy application source (python_api, uploads, data, model_cache excluded by .dockerignore)
COPY server.js ./
COPY config/ ./config/
COPY controllers/ ./controllers/
COPY middleware/ ./middleware/
COPY models/ ./models/
COPY routes/ ./routes/
COPY scripts/ ./scripts/
COPY services/ ./services/

# Create uploads dir placeholder (real path mounted as volume in Docker/k8s)
RUN mkdir -p uploads

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD wget -qO- http://localhost:5000/health || exit 1

CMD ["node", "server.js"]
