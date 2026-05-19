# Build context must be the monorepo root:
#   docker build -f apps/api/Dockerfile -t salestrack-api .
FROM node:24-alpine
WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/types/package*.json ./packages/types/
COPY packages/utils/package*.json ./packages/utils/

RUN npm ci --workspace=@salestrack/api --workspace=@salestrack/types --workspace=@salestrack/utils

COPY . .

RUN npm run build --workspace=@salestrack/api

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace=@salestrack/api"]
