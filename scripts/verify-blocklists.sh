#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BLOCKLIST_DIR="$ROOT_DIR/blocklist"
PUBLIC_KEY_PATH="${PUBLIC_KEY_PATH:-$BLOCKLIST_DIR/keys/community-signing-key.asc}"
REPO_JSON="$BLOCKLIST_DIR/repo.json"
REPO_SIG="$BLOCKLIST_DIR/repo.json.asc"

if ! command -v gpg >/dev/null 2>&1; then
  echo "gpg is required" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required" >&2
  exit 1
fi

for required_file in "$PUBLIC_KEY_PATH" "$REPO_JSON" "$REPO_SIG"; do
  if [[ ! -f "$required_file" ]]; then
    echo "Missing required file: $required_file" >&2
    exit 1
  fi
done

TMP_GNUPG="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_GNUPG"
}
trap cleanup EXIT

chmod 700 "$TMP_GNUPG"
GNUPGHOME="$TMP_GNUPG" gpg --batch --import "$PUBLIC_KEY_PATH" >/dev/null 2>&1

verify_file() {
  local signed_file="$1"
  local signature_file="$2"
  local label="$3"

  if [[ ! -f "$signed_file" ]]; then
    echo "Missing signed file for $label: $signed_file" >&2
    return 1
  fi

  if [[ ! -f "$signature_file" ]]; then
    echo "Missing signature for $label: $signature_file" >&2
    return 1
  fi

  GNUPGHOME="$TMP_GNUPG" gpg --batch --verify "$signature_file" "$signed_file" >/dev/null 2>&1
  echo "verified: $label"
}

verify_file "$REPO_JSON" "$REPO_SIG" "repo.json"

declared_pairs=()
while IFS= read -r line; do
  declared_pairs+=("$line")
done < <(
  python3 - <<'PY' "$REPO_JSON"
import json
import sys

repo_path = sys.argv[1]
with open(repo_path, "r", encoding="utf-8") as f:
    repo = json.load(f)

for country in repo.get("countries", []):
    for blocklist in country.get("blocklists", []):
        path = blocklist.get("path")
        sig = blocklist.get("signature_url") or country.get("signature_url")
        blocklist_id = blocklist.get("id", path or "unknown")
        if not path or not sig:
            print(f"ERROR\t{blocklist_id}\t{path or ''}\t{sig or ''}")
        else:
            print(f"OK\t{blocklist_id}\t{path}\t{sig}")
PY
)

if [[ ${#declared_pairs[@]} -eq 0 ]]; then
  echo "No blocklists declared in $REPO_JSON" >&2
  exit 1
fi

for entry in "${declared_pairs[@]}"; do
  IFS=$'\t' read -r status blocklist_id relative_path relative_sig <<< "$entry"

  if [[ "$status" != "OK" ]]; then
    echo "Invalid repo.json entry for $blocklist_id" >&2
    exit 1
  fi

  verify_file \
    "$BLOCKLIST_DIR/$relative_path" \
    "$BLOCKLIST_DIR/$relative_sig" \
    "$blocklist_id"
done

echo "All declared blocklists and repo metadata verified with: $PUBLIC_KEY_PATH"
