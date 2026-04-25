FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
ENV PORT=4444
ENV PERSIST_DIR=/data
EXPOSE 4444
VOLUME ["/data"]
CMD ["node", "dist/index.js"]
