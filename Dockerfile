# Builds the single-file app, then serves just dist/index.html from nginx.

# The full image, not -slim or -alpine: it ships git, which stamps the family
# commit under the tree, and glibc for the native build tools.
FROM node:22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Leave unset for data/ (or sample/ without it); `sample` for the sample.
ARG FAMILY_DIR
RUN npm run build:single

FROM nginx:alpine
COPY --from=build /app/dist/index.html /usr/share/nginx/html/index.html
