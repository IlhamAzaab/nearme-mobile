#!/usr/bin/env bash

set -euo pipefail

echo "🔧 EAS Build Post-Install Hook Started"
echo "📂 Current directory: $(pwd)"

# Create google-services.json from EAS environment variable
if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "❌ ERROR: GOOGLE_SERVICES_JSON environment variable is not set"
  echo "Please ensure it is configured in EAS environment variables"
  exit 1
fi

echo "📦 Creating google-services.json from EAS environment variable..."
echo "🔍 Environment variable length: ${#GOOGLE_SERVICES_JSON}"

# EAS file-type secrets store a FILE PATH in the env var.
# String-type secrets store the raw content (possibly base64).
# Handle both cases:
if [ -f "$GOOGLE_SERVICES_JSON" ]; then
  # File-type secret: env var contains a path to the file
  echo "📂 Detected file-type secret, copying from: $GOOGLE_SERVICES_JSON"
  cp "$GOOGLE_SERVICES_JSON" ./google-services.json
  echo "✅ Copied google-services.json from file-type secret"
elif echo "$GOOGLE_SERVICES_JSON" | grep -q '^{'; then
  # Raw JSON string
  echo "📄 Detected raw JSON content"
  echo "$GOOGLE_SERVICES_JSON" > ./google-services.json
  echo "✅ Wrote raw JSON to google-services.json"
elif echo "$GOOGLE_SERVICES_JSON" | base64 -d > ./google-services.json 2>/dev/null; then
  echo "✅ Decoded with 'base64 -d' (Linux/GNU)"
elif echo "$GOOGLE_SERVICES_JSON" | base64 --decode > ./google-services.json 2>/dev/null; then
  echo "✅ Decoded with 'base64 --decode'"
elif echo "$GOOGLE_SERVICES_JSON" | base64 -D > ./google-services.json 2>/dev/null; then
  echo "✅ Decoded with 'base64 -D' (Mac)"
else
  echo "❌ ERROR: Could not process GOOGLE_SERVICES_JSON (not a file path, JSON, or base64)"
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
