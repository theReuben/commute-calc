#!/usr/bin/env bash
# One-click launcher for Commute Calculator
set -e

cd "$(dirname "$0")"

if ! command -v node &> /dev/null; then
  echo "Error: Node.js is not installed. Download it from https://nodejs.org/"
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installing dependencies..."
  npm install
fi

echo "Starting Commute Calculator..."
npm start
