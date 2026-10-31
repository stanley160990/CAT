# Dockerfile untuk Aplikasi Computer Assisted Test (CAT)
FROM node:20-alpine AS base

WORKDIR /app

# 1. Pasang dependensi
COPY package*.json ./
RUN npm install

# 2. Salin kode aplikasi
COPY . .

# 3. Build bundle frontend Vite
RUN npm run build

# 4. Port server aplikasi
EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

# 5. Jalankan server aplikasi fullstack
CMD ["npm", "start"]
