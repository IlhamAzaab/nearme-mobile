#!/usr/bin/env bash

set -euo pipefail

echo "🔧 EAS Build Pre-Install Hook Started"

# Create google-services.json from EAS secret
if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "❌ ERROR: GOOGLE_SERVICES_JSON environment variable is not set"
  echo "Please ensure the secret is configured in EAS"
  exit 1
fi

echo "📦 Creating google-services.json from EAS secret..."

# Decode base64 content (remove any whitespace/newlines first)
echo "$GOOGLE_SERVICES_JSON" | tr -d '\n' | tr -d ' ' | base64 -d > ./google-services.json

# Verify the file was created
if [ ! -f "./google-services.json" ]; then
  echo "❌ ERROR: Failed to create google-services.json"
  exit 1
fi

echo "✅ google-services.json created successfully"
echo "📊 File size: $(stat -f%z "./google-services.json" 2>/dev/null || stat -c%s "./google-services.json" 2>/dev/null || echo 'unknown') bytes"
echo "🔍 File exists at: $(pwd)/google-services.json"

# Validate it's valid JSON
if command -v jq &> /dev/null; then
  if jq empty google-services.json 2>/dev/null; then
    echo "✅ File is valid JSON"
  else
    echo "⚠️ Warning: File may not be valid JSON"
  fi
fi

echo "🎉 Pre-install hook completed successfully"
