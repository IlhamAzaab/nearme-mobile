#!/usr/bin/env bash

set -euo pipefail

# Copy google-services.json from EAS file secret to project root
# For file-type secrets, the env var contains the PATH to the file
if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "📦 Copying google-services.json from EAS secret..."
  echo "   Source path: $GOOGLE_SERVICES_JSON"
  cp "$GOOGLE_SERVICES_JSON" ./google-services.json
  echo "✅ google-services.json copied successfully"
  ls -la google-services.json
else
  echo "⚠️  GOOGLE_SERVICES_JSON environment variable not found"
  exit 1
fi
