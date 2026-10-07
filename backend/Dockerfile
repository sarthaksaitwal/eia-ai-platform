# Development image for the Express backend.
#
# Node 24 matches the version this project is developed against, so the
# container does not quietly run a different runtime from the host.
# bookworm-slim rather than alpine: bcrypt ships prebuilt binaries for glibc,
# and on musl it would have to compile every time.
FROM node:24-bookworm-slim

# bcrypt publishes prebuilds per Node ABI, and there is not always one for the
# newest release. When the prebuild is missing, node-gyp compiles from source
# and needs these three. Cheap insurance against a confusing `npm ci` failure.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# nodemon is installed here instead of being added to package.json, so the
# host project is unchanged.
#
# `node --watch` (what `npm run dev` uses) listens for filesystem events. A
# bind mount from a Windows host does not deliver them to the container, so
# --watch would sit there and never restart. nodemon's --legacy-watch polls
# instead. See the command in compose.yaml.
RUN npm install -g nodemon@3

# Owned by the unprivileged user the node image already provides, so the
# named volume that shadows node_modules inherits that ownership and stays
# writable.
RUN mkdir -p /app && chown node:node /app
WORKDIR /app
USER node

# Dependencies first: this layer is rebuilt only when the manifests change,
# not on every source edit.
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

# The source is bind-mounted over this at runtime. It is copied anyway so the
# image can run on its own, which is what makes `docker compose run --rm init`
# work before any volume exists.
COPY --chown=node:node . .

ENV NODE_ENV=development
EXPOSE 5000

# Overridden in compose.yaml. Present so the image is runnable by itself.
CMD ["npm", "run", "dev"]
