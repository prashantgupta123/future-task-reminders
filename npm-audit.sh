#!/bin/bash

# Run npm audit and save the output to npm-audit.json
docker run --rm -v "$(pwd):/app" -w /app node:24-alpine sh -c "npm install -g npm@latest && npm audit --json >> npm-audit.json"
