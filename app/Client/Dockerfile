FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

HEALTHCHECK --interval=10s --timeout=5s --retries=5 --start-period=10s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5173 || exit 1

# --host 0.0.0.0 est ESSENTIEL : sans ça, Vite n'écoute
# que localhost à l'intérieur du conteneur et tu n'y auras pas accès
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]