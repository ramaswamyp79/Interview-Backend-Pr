# 1️⃣ Use Node.js base image
FROM node:20-alpine

# 2️⃣ Set working directory
WORKDIR /app

# 3️⃣ Copy package files first (better caching)
COPY package*.json ./

# 4️⃣ Install dependencies
RUN npm install

# 5️⃣ Copy all backend code
COPY . .

# 6️⃣ Copy .env file explicitly
#COPY .env /app/.env

# 7️⃣ Expose backend port
EXPOSE 5000

# 8️⃣ Start server
CMD ["npm", "start"]
