FROM node:24-alpine AS base

WORKDIR /usr/src/app

# Install dependencies separately to leverage Docker layer caching
COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm cache clean --force

# Copy source code
COPY src ./src
COPY public ./public

# Environment
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

CMD ["node", "src/server.js"]
