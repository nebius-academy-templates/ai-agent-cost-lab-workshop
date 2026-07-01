FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

# MCP_SERVER (jira|github|confluence|sentry|testrail) and PORT are provided per-service in compose.
CMD ["npm", "start"]
