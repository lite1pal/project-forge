# apps/landing/Dockerfile

FROM node:22.13.1-bookworm-slim AS build

WORKDIR /app

RUN npm install -g pnpm@10

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/landing/package.json apps/landing/package.json

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm --filter landing build

FROM nginx:alpine

COPY --from=build /app/apps/landing/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]