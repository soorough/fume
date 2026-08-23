#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../lambda"
[ -d node_modules ] || npm install --omit=dev
mkdir -p ../../dist
rm -f ../../dist/skill-lambda.zip
zip -qr ../../dist/skill-lambda.zip . -x "*.json.dc" "*package-lock.json"
echo "wrote ../../dist/skill-lambda.zip"
