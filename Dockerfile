# FORKBOMB unified server: multi-stage, non-root, zero npm dependencies.
#   docker build -t forkbomb:1.0.0 .
#   docker run -p 8080:8080 -v forkbomb-data:/data forkbomb:1.0.0
ARG NODE_VERSION=22-alpine

# ---- stage 1: assemble + verify the runtime tree (tests run here, nothing from this stage ships except the files)
FROM node:${NODE_VERSION} AS build
WORKDIR /src
COPY package.json ./
COPY apps/shared ./apps/shared
COPY apps/forkbomb ./apps/forkbomb
COPY apps/paste ./apps/paste
COPY apps/shaders ./apps/shaders
COPY apps/gradients ./apps/gradients
RUN for f in $(find apps -name '*.js' -not -path '*/node_modules/*'); do node --check "$f" || exit 1; done \
 && node --test apps/*/test/*.test.js \
 && mkdir -p /out/apps \
 && cp package.json /out/ \
 && for a in shared forkbomb paste shaders gradients; do cp -r apps/$a /out/apps/$a; done \
 && rm -rf /out/apps/*/test /out/apps/paste/data /out/apps/paste/Dockerfile /out/apps/*/README.md

# ---- stage 2: runtime
FROM node:${NODE_VERSION}
ENV NODE_ENV=production PORT=8080 HOST=0.0.0.0 DATA_DIR=/data LOG_LEVEL=info
WORKDIR /app
COPY --from=build --chown=root:root /out/ ./
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/readyz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
STOPSIGNAL SIGTERM
CMD ["node", "apps/forkbomb/server.js"]
