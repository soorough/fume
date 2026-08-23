FROM node:24-slim AS base
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
RUN npm install --omit=dev

FROM base
COPY . .
WORKDIR /app/apps/api
EXPOSE 3000
CMD ["npm", "run", "start"]
