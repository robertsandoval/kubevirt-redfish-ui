# syntax=docker/dockerfile:1
FROM registry.access.redhat.com/ubi9/nodejs-22:latest AS build
USER root

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    SKIP_TS_CHECKER=1 \
    YARN_CACHE_FOLDER=/var/cache/yarn

WORKDIR /usr/src/app

# Dependency metadata only — cached until lockfile/package.json change
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn/releases ./.yarn/releases

RUN --mount=type=cache,target=/var/cache/yarn,sharing=locked \
    LOCAL_YARN="node $(awk '/yarnPath:/{print $2}' .yarnrc.yml)" && \
    $LOCAL_YARN install --immutable

# App sources — only webpack rebuilds when these change
COPY . .
RUN LOCAL_YARN="node $(awk '/yarnPath:/{print $2}' .yarnrc.yml)" && \
    $LOCAL_YARN build

FROM registry.access.redhat.com/ubi9/nginx-120:latest

COPY --from=build /usr/src/app/dist /usr/share/nginx/html
USER 1001

ENTRYPOINT ["nginx", "-g", "daemon off;"]
