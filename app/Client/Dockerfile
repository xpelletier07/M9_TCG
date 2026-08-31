FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

# --host 0.0.0.0 est ESSENTIEL : sans ça, Vite n'écoute
# que localhost à l'intérieur du conteneur et tu n'y auras pas accès
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]