FROM node:lts-alpine as builder

# Install dependencies
RUN apk add --no-cache git

# Initialize the working directory
WORKDIR /app

# Copy package.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the source code
COPY . .

# Prune to production dependencies
RUN npm prune --production


# Final image
FROM node:lts-alpine as server

WORKDIR /app

COPY --from=builder /app ./

# Expose the port and start the application
EXPOSE 8080
CMD ["npm", "start"]
