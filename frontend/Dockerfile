FROM node:18-alpine

WORKDIR /app

# Copy package requirements
COPY package*.json ./

# Install packages
RUN npm install

# Copy application source
COPY . .

# Expose Vite dev server port
EXPOSE 5173

# Run development server with host configuration
CMD ["npm", "run", "dev"]
