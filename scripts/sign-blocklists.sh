#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GNUPG_HOME="${GNUPGHOME:-$ROOT_DIR/blocklist/.gnupg}"
KEYS_DIR="$ROOT_DIR/blocklist/keys"
SEED_DIR="$ROOT_DIR/SpamSniper/Shared/SeedData"

if [[ ! -d "$GNUPG_HOME" ]]; then
  echo "Missing GPG home: $GNUPG_HOME" >&2
  exit 1
fi

if ! command -v gpg >/dev/null 2>&1; then
  echo "gpg is required" >&2
  exit 1
fi

KEY_FINGERPRINT="${BLOCKLIST_SIGNING_KEY:-$(GNUPGHOME="$GNUPG_HOME" gpg --list-secret-keys --with-colons | awk -F: '/^fpr:/ { print $10; exit }')}"
if [[ -z "$KEY_FINGERPRINT" ]]; then
  echo "No signing key found in $GNUPG_HOME" >&2
  exit 1
fi

sign_detached() {
  local input_file="$1"
  GNUPGHOME="$GNUPG_HOME" gpg \
    --armor \
    --local-user "$KEY_FINGERPRINT" \
    --yes \
    --output "${input_file}.asc" \
    --detach-sign \
    "$input_file"
}

mkdir -p "$KEYS_DIR" "$SEED_DIR"

GNUPGHOME="$GNUPG_HOME" gpg --armor --export "$KEY_FINGERPRINT" > "$KEYS_DIR/community-signing-key.asc"
cp "$KEYS_DIR/community-signing-key.asc" "$SEED_DIR/spam-blocklist-trusted-public-key.asc"

sign_detached "$ROOT_DIR/blocklist/repo.json"
sign_detached "$ROOT_DIR/blocklist/PH/community-core.json"
sign_detached "$ROOT_DIR/blocklist/US/community-core.json"
sign_detached "$ROOT_DIR/blocklist/UK/community-core.json"
sign_detached "$SEED_DIR/spam-blocklist-repo-seed.json"

echo "Signed blocklist repo with key: $KEY_FINGERPRINT"
