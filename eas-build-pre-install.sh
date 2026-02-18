#!/usr/bin/env bash

set -euo pipefail

echo "🔧 EAS Build Pre-Install Hook Started"
echo "📂 Current directory: $(pwd)"

# Create google-services.json from EAS secret
if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "❌ ERROR: GOOGLE_SERVICES_JSON environment variable is not set"
  echo "Please ensure the secret is configured in EAS"
  exit 1
fi

echo "📦 Creating google-services.json from EAS secret..."
echo "🔍 Environment variable length: ${#GOOGLE_SERVICES_JSON}"

# Try to decode base64 content (try Linux syntax first, then Mac syntax)
if echo "$GOOGLE_SERVICES_JSON" | base64 -d > ./google-services.json 2>/dev/null; then
  echo "✅ Decoded with 'base64 -d' (Linux/GNU)"
elif echo "$GOOGLE_SERVICES_JSON" | base64 --decode > ./google-services.json 2>/dev/null; then
  echo "✅ Decoded with 'base64 --decode'"
elif echo "$GOOGLE_SERVICES_JSON" | base64 -D > ./google-services.json 2>/dev/null; then
  echo "✅ Decoded with 'base64 -D' (Mac)"
else
  echo "❌ ERROR: Failed to decode base64 content with any known syntax"
  exit 1
fi

# Verify the file was created
if [ ! -f "./google-services.json" ]; then
  echo "❌ ERROR: google-services.json was not created"
  exit 1
fi

FILE_SIZE=$(wc -c < "./google-services.json" | tr -d ' ')
echo "✅ google-services.json created successfully"
echo "📊 File size: ${FILE_SIZE} bytes"

# Validate it's not empty
if [ "$FILE_SIZE" -eq 0 ]; then
  echo "❌ ERROR: google-services.json is empty"
  exit 1
fi

# Check if it looks like JSON
if head -c 1 "./google-services.json" | grep -q '{'; then
  echo "✅ File appears to be valid JSON"
else
  echo "⚠️  Warning: File doesn't start with '{', may not be valid JSON"
  echo "First 100 bytes:"
  head -c 100 "./google-services.json"
fi

echo "🎉 Pre-install hook completed successfully"
