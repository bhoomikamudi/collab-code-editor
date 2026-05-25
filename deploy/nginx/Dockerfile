FROM node:20-alpine AS client-build

WORKDIR /client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./

# Empty values use same-origin API + /ws WebSocket defaults baked into the client.
ARG VITE_API_BASE_URL=
ARG VITE_WS_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_WS_URL=$VITE_WS_URL

RUN npm run build

FROM nginx:1.27-alpine

COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=client-build /client/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
