#!/bin/bash
set -e

echo "Installing dependencies in backend..."
cd backend
npm install

echo "Building backend..."
npm run build

echo "Build completed successfully!"
