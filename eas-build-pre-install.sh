#!/usr/bin/env bash

set -euo pipefail

# Copy google-services.json from EAS secret to project root
# For FILE_BASE64 type secrets, the env var contains base64-encoded content
if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "📦 Decoding google-services.json from EAS secret..."
  echo "$GOOGLE_SERVICES_JSON" | base64 --decode > ./google-services.json
  echo "✅ google-services.json created successfully"
  ls -la google-services.json
  echo "📋 File content preview:"
  head -c 200 google-services.json
else
  echo "⚠️  GOOGLE_SERVICES_JSON environment variable not found"
  exit 1
fi
