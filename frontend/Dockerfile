FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

COPY package*.json .npmrc* ./
RUN npm install --legacy-peer-deps

COPY . .

ENV PORT=5173
ENV HOST=0.0.0.0
ENV BACKEND_URL=http://backend:4000

EXPOSE 5173

CMD ["node", "scripts/run-framework.mjs", "dev", "--host", "0.0.0.0", "--port", "5173"]
