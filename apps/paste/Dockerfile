FROM node:20-alpine
WORKDIR /app
COPY package.json server.js ./
COPY lib ./lib
ENV PORT=3000 DATA_DIR=/data NODE_ENV=production
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "server.js"]
