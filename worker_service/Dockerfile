FROM node:18-alpine

WORKDIR /app

# Install dependencies for pdfkit
RUN apk add --no-cache \
    cairo-dev \
    pango-dev \
    jpeg-dev \
    giflib-dev

COPY package*.json ./
RUN npm ci --only=production

COPY src/ ./src/

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

CMD ["npm", "start"]