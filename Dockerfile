# Use Node.js LTS version
FROM node:18-bullseye-slim

# Install Chrome dependencies and Chrome
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm install

# Bundle app source
COPY . .

# Create directories for WhatsApp sessions and logs
RUN mkdir -p whatsapp-sessions logs

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Expose the port the app runs on
EXPOSE 3000

# Create a non-root user
RUN groupadd -r whatsapp && useradd -r -g whatsapp -G audio,video whatsapp \
    && chown -R whatsapp:whatsapp /usr/src/app

# Switch to non-root user
USER whatsapp

# Start the application
CMD ["npm", "start"] 