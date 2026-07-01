FROM node:20-alpine
WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

ENV REST_PORT=8080
EXPOSE 8080
CMD ["npm", "start"]
