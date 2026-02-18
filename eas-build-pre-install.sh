#!/usr/bin/env bash

set -euo pipefail

# Copy google-services.json from EAS secret to project root
if [ -n "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "📦 Copying google-services.json from EAS secret..."
  echo "$GOOGLE_SERVICES_JSON" > google-services.json
  echo "✅ google-services.json created successfully"
else
  echo "⚠️  GOOGLE_SERVICES_JSON environment variable not found"
  exit 1
fi
