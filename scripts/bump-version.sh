#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_FILE="$ROOT_DIR/SpamSniper/SpamSniper.xcodeproj/project.pbxproj"
TAG_PREFIX="v"
RELEASE_KIND=""
CREATE_COMMIT=1
CREATE_TAG=1
DRY_RUN=0

usage() {
  cat <<'EOF'
Usage: scripts/bump-version.sh [--major | --minor | --patch] [options]

Release options:
  --major              Increment major and reset minor/patch to 0
  --minor              Increment minor and reset patch to 0
  --patch              Increment patch

Behavior options:
  --no-commit          Only update the project file
  --no-tag             Skip tag creation
  --tag-prefix PREFIX  Tag prefix to use (default: v)
  --dry-run            Print the planned changes without modifying git state
  -h, --help           Show this help text

Default behavior:
  1. Bump MARKETING_VERSION in the Xcode project.
  2. Set CURRENT_PROJECT_VERSION to the git revision count of the release commit.
  3. Commit the project file change.
  4. Create an annotated git tag like v1.2.3.

Notes:
  - The default release flow requires a clean git working tree.
  - If you use --no-commit, the build number is set to the current HEAD revision count.
  - Tags are only created when a release commit is created in the same run.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --major|--minor|--patch)
      if [[ -n "$RELEASE_KIND" ]]; then
        echo "Only one of --major, --minor, or --patch may be used." >&2
        exit 1
      fi
      RELEASE_KIND="${1#--}"
      ;;
    --no-commit)
      CREATE_COMMIT=0
      ;;
    --no-tag)
      CREATE_TAG=0
      ;;
    --tag-prefix)
      shift
      if [[ $# -eq 0 ]]; then
        echo "--tag-prefix requires a value." >&2
        exit 1
      fi
      TAG_PREFIX="$1"
      ;;
    --dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
  shift
done

if [[ -z "$RELEASE_KIND" ]]; then
  echo "Choose one of --major, --minor, or --patch." >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$PROJECT_FILE" ]]; then
  echo "Missing Xcode project file: $PROJECT_FILE" >&2
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  echo "git is required." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required." >&2
  exit 1
fi

if [[ $CREATE_COMMIT -eq 0 && $CREATE_TAG -eq 1 ]]; then
  echo "Tag creation requires the default release commit. Remove --no-commit or add --no-tag." >&2
  exit 1
fi

if [[ $CREATE_COMMIT -eq 1 ]] && [[ -n "$(git -C "$ROOT_DIR" status --short)" ]]; then
  echo "Working tree must be clean for the default release flow." >&2
  echo "Commit or stash existing changes first, or rerun with --no-commit --no-tag." >&2
  exit 1
fi

CURRENT_VERSION="$(python3 - <<'PY' "$PROJECT_FILE"
from pathlib import Path
import re
import sys

text = Path(sys.argv[1]).read_text(encoding="utf-8")
match = re.search(r"MARKETING_VERSION = ([0-9]+\.[0-9]+\.[0-9]+);", text)
if not match:
    raise SystemExit("Could not find MARKETING_VERSION in project.pbxproj")
print(match.group(1))
PY
)"

if [[ $CREATE_COMMIT -eq 1 ]]; then
  NEXT_BUILD_NUMBER="$(( $(git -C "$ROOT_DIR" rev-list --count HEAD) + 1 ))"
else
  NEXT_BUILD_NUMBER="$(git -C "$ROOT_DIR" rev-list --count HEAD)"
fi

NEXT_VERSION="$(python3 - <<'PY' "$CURRENT_VERSION" "$RELEASE_KIND"
import sys

current_version = sys.argv[1]
release_kind = sys.argv[2]
major, minor, patch = map(int, current_version.split("."))

if release_kind == "major":
    major += 1
    minor = 0
    patch = 0
elif release_kind == "minor":
    minor += 1
    patch = 0
elif release_kind == "patch":
    patch += 1
else:
    raise SystemExit(f"Unsupported release kind: {release_kind}")

print(f"{major}.{minor}.{patch}")
PY
)"

TAG_NAME="${TAG_PREFIX}${NEXT_VERSION}"

if git -C "$ROOT_DIR" rev-parse -q --verify "refs/tags/$TAG_NAME" >/dev/null 2>&1; then
  echo "Tag already exists: $TAG_NAME" >&2
  exit 1
fi

if [[ $DRY_RUN -eq 1 ]]; then
  echo "Project file: $PROJECT_FILE"
  echo "Current version: $CURRENT_VERSION"
  echo "Next version: $NEXT_VERSION"
  echo "Next build number: $NEXT_BUILD_NUMBER"
  if [[ $CREATE_COMMIT -eq 1 ]]; then
    echo "Commit message: Bump version to $NEXT_VERSION ($NEXT_BUILD_NUMBER)"
  else
    echo "Commit: skipped"
  fi
  if [[ $CREATE_TAG -eq 1 ]]; then
    echo "Tag to create: $TAG_NAME"
  else
    echo "Tag: skipped"
  fi
  exit 0
fi

TMP_FILE="$(mktemp)"
cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

python3 - <<'PY' "$PROJECT_FILE" "$TMP_FILE" "$CURRENT_VERSION" "$NEXT_VERSION" "$NEXT_BUILD_NUMBER"
from pathlib import Path
import re
import sys

project_path = Path(sys.argv[1])
tmp_path = Path(sys.argv[2])
current_version = sys.argv[3]
next_version = sys.argv[4]
next_build = sys.argv[5]

text = project_path.read_text(encoding="utf-8")

version_pattern = re.compile(rf"(MARKETING_VERSION = ){re.escape(current_version)}(;)")
build_pattern = re.compile(r"(CURRENT_PROJECT_VERSION = )\d+(;)")

updated_text, version_count = version_pattern.subn(rf"\g<1>{next_version}\2", text)
updated_text, build_count = build_pattern.subn(rf"\g<1>{next_build}\2", updated_text)

if version_count == 0:
    raise SystemExit("Failed to update MARKETING_VERSION entries.")
if build_count == 0:
    raise SystemExit("Failed to update CURRENT_PROJECT_VERSION entries.")

tmp_path.write_text(updated_text, encoding="utf-8")
PY

mv "$TMP_FILE" "$PROJECT_FILE"

echo "Updated $PROJECT_FILE"
echo "Version: $CURRENT_VERSION -> $NEXT_VERSION"
echo "Build:   -> $NEXT_BUILD_NUMBER"

if [[ $CREATE_COMMIT -eq 0 ]]; then
  echo "Skipped git commit and tag creation."
  exit 0
fi

git -C "$ROOT_DIR" add "$PROJECT_FILE"
git -C "$ROOT_DIR" commit -m "Bump version to $NEXT_VERSION ($NEXT_BUILD_NUMBER)"

if [[ $CREATE_TAG -eq 1 ]]; then
  git -C "$ROOT_DIR" tag -a "$TAG_NAME" -m "Release $NEXT_VERSION"
  echo "Created tag: $TAG_NAME"
fi

echo "Release bump complete."
