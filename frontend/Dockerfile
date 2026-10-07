# Development image for the Vite dev server.
#
# There is no build or nginx stage here: this compose setup is for working on
# the code, and the dev server compiles in memory and serves HMR. A production
# image would add `npm run build` and a static server.
FROM node:24-bookworm-slim

RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# Bind-mounted over at runtime; copied so the image stands alone.
COPY --chown=node:node . .

EXPOSE 5173

# --host binds 0.0.0.0. Without it Vite listens on localhost inside the
# container only, and the published port answers nothing.
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
