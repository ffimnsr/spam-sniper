#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

ENV_NAME=""
SKIP_MIGRATIONS=0

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-cloudflare.sh [--env <name>] [--skip-migrations]

Build Vite app, apply remote D1 migrations, deploy Cloudflare Worker with static assets.

Options:
  --env <name>         Wrangler environment name.
  --skip-migrations    Skip remote D1 migrations apply.
  -h, --help           Show help.
EOF
}

while (($# > 0)); do
  case "$1" in
    --env)
      if (($# < 2)); then
        echo "Missing value for --env." >&2
        usage
        exit 1
      fi
      ENV_NAME="$2"
      shift 2
      ;;
    --skip-migrations)
      SKIP_MIGRATIONS=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

cd "${PROJECT_DIR}"

WRANGLER_ARGS=()
if [[ -n "${ENV_NAME}" ]]; then
  WRANGLER_ARGS+=(--env "${ENV_NAME}")
fi

echo "Building frontend + Worker types..."
npm run build

if [[ "${SKIP_MIGRATIONS}" -eq 0 ]]; then
  echo "Applying remote D1 migrations..."
  npx wrangler d1 migrations apply DB --remote "${WRANGLER_ARGS[@]}"
fi

echo "Deploying Worker..."
npx wrangler deploy "${WRANGLER_ARGS[@]}"
