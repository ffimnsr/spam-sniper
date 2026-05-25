#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: $(basename "$0") [output_dir] [template_file]

Convert docs/*.md into HTML files.

Arguments:
  output_dir    Optional output directory (default: docs/html)
  template_file Optional HTML template containing {{content}}.
                Defaults to docs/template.html.

Example:
  ./scripts/convert-docs-to-html.sh
EOF
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${SCRIPT_DIR}/.."
SRC_DIR="${REPO_ROOT}/docs"
OUT_DIR="${1:-${SRC_DIR}/html}"
TEMPLATE_FILE="${2:-${SRC_DIR}/template.html}"

if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

if [ -n "$TEMPLATE_FILE" ] && [ ! -f "$TEMPLATE_FILE" ]; then
  echo "Error: template file does not exist: $TEMPLATE_FILE" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

if ! python3 -c 'import markdown' >/dev/null 2>&1; then
  cat <<'EOF' >&2
Error: python markdown module not found.
Install it and rerun:
  python3 -m pip install markdown
EOF
  exit 1
fi

printf 'Converting markdown files from %s to %s\n' "$SRC_DIR" "$OUT_DIR"

shopt -s nullglob
index_entries=""
for src in "$SRC_DIR"/*.md; do
  filename="$(basename "$src" .md)"
  output_file="$OUT_DIR/${filename}.html"
  title="${filename//[-_]/ }"

  page_title="$title"
  page_eyebrow="Documentation"
  page_lede="Straightforward reference for how SpamSniper works, what it stores locally, and where to get help."
  card_description="Reference page for SpamSniper."

  case "$filename" in
    privacy_policy)
      page_title="Privacy Policy"
      page_eyebrow="Privacy"
      page_lede="What SpamSniper processes on-device, what it does not collect, and how privacy boundaries are enforced."
      card_description="What the app stores locally, what stays on-device, and what is never collected."
      ;;
    support)
      page_title="Support"
      page_eyebrow="Help"
      page_lede="How to report issues, what details to include, and the first checks to make when call blocking is not behaving as expected."
      card_description="Where to ask for help, report bugs, and troubleshoot common setup issues."
      ;;
    terms)
      page_title="Terms of Use"
      page_eyebrow="Terms"
      page_lede="The practical terms for using SpamSniper, including limitations, third-party components, and responsibility boundaries."
      card_description="Usage terms, disclaimers, and third-party component notice."
      ;;
  esac

  if [ -z "$index_entries" ]; then
    index_entries="<div class=\"doc-list\">"
  fi

  index_entries+="<a class=\"doc-card\" href=\"${filename}.html\"><span class=\"doc-card__label\">$(printf '%s' "$page_title")</span><span class=\"doc-card__description\">${card_description}</span><span class=\"doc-card__meta\">Open document</span></a>"

  if [ -n "$TEMPLATE_FILE" ]; then
    python3 - <<PY
import pathlib
import markdown
import sys

src = pathlib.Path(r"$src")
body = markdown.markdown(src.read_text(encoding='utf-8'))

template = pathlib.Path(r"$TEMPLATE_FILE").read_text(encoding='utf-8')
if "{{content}}" not in template:
    sys.exit("Template file must contain {{content}} placeholder.")

output = template.replace("{{content}}", body)
output = output.replace("{{title}}", r"$page_title")
output = output.replace("{{filename}}", r"$filename")
output = output.replace("{{eyebrow}}", r"$page_eyebrow")
output = output.replace("{{lede}}", r"$page_lede")
pathlib.Path(r"$output_file").write_text(output, encoding='utf-8')
PY
  else
    python3 - <<PY
import pathlib
import markdown

src = pathlib.Path(r"$src")
body = markdown.markdown(src.read_text(encoding='utf-8'))
title = r"$title"
html = f"<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <title>{title}</title>\n</head>\n<body>\n{body}\n</body>\n</html>"
pathlib.Path(r"$output_file").write_text(html, encoding='utf-8')
PY
  fi

  printf '  %s -> %s\n' "$src" "$output_file"
done

if [ -n "$index_entries" ]; then
  index_entries+="</div>"

  python3 - <<PY
import pathlib

template = pathlib.Path(r"$TEMPLATE_FILE").read_text(encoding='utf-8')
if "{{content}}" not in template:
    raise SystemExit("Template file must contain {{content}} placeholder.")

index_body = """
<div class="index-intro">
  <strong>Essential project pages</strong>
  <p>These pages cover the parts people usually need before installing, using, or reviewing SpamSniper: privacy expectations, support channels, and the basic terms of use.</p>
</div>
<div class="index-grid">
  $index_entries
</div>
"""

output = template.replace("{{content}}", index_body)
output = output.replace("{{title}}", "Documentation")
output = output.replace("{{filename}}", "index")
output = output.replace("{{eyebrow}}", "Docs")
output = output.replace("{{lede}}", "The policy, support, and usage pages for SpamSniper in one place.")
pathlib.Path(r"$OUT_DIR/index.html").write_text(output, encoding='utf-8')
PY

  printf '  generated index -> %s\n' "$OUT_DIR/index.html"
fi

printf 'Conversion complete. HTML files are in %s\n' "$OUT_DIR"
