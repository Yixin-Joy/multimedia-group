FROM nodered/node-red:4.1.0

RUN npm install --omit=dev --no-audit --no-fund node-red-contrib-mongodb4@3.4.0

COPY --chown=node-red:node-red node-red-data/flows.json /data/flows.json

