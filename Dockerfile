# Use the official Node.js image as a base
FROM node:16

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL="/root/.bun"
ENV PATH="/root/.bun/bin:${PATH}"

# Set the working directory
WORKDIR /app

# Copy the current directory contents into the container
COPY . .

# Install dependencies
RUN bun install

CMD ["sh", "-c", "for character in Git Gina Milka Bernie Gat; do CHARACTER=$character bun run src/background.ts & sleep 1; done; wait"]