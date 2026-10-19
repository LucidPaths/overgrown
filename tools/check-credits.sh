#!/usr/bin/env bash
# Checks the third-party asset credits (OQ-038, D8).
#   tools/check-credits.sh
# Compares game/assets/third_party/ with the table in game/assets/third_party/CREDITS.md and exits 1, with one
# message per problem, if:
#   - a file under third_party/ (CREDITS.md, *.import and *.uid excluded) has no table row;
#   - a row names a file that does not exist, or names a file twice;
#   - a row has an empty Path, Source URL, Licence or Author cell, or the wrong number of cells;
#   - a licence is not on the allow-list; the share-alike ones (CC-BY-SA-3.0, CC-BY-SA-4.0) also need
#     "share-alike kept" in the Changes column.
# An empty third_party/ with an empty table passes. Needs only bash and find.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/game/assets/third_party"
CREDITS="$DIR/CREDITS.md"

ALLOWED=" CC0-1.0 Public-Domain MIT Apache-2.0 BSD-2-Clause BSD-3-Clause CC-BY-3.0 CC-BY-4.0 OFL-1.1 "
SHARE_ALIKE=" CC-BY-SA-3.0 CC-BY-SA-4.0 "

errors=0
fail() {
  echo "check-credits: $*" >&2
  errors=$((errors + 1))
}

if [ ! -f "$CREDITS" ]; then
  echo "check-credits: $CREDITS is missing" >&2
  exit 1
fi

trim() {
  local v="$1"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}

listed="" # newline-separated paths from the table
lineno=0
while IFS= read -r line || [ -n "$line" ]; do
  lineno=$((lineno + 1))
  line="$(trim "$line")"
  case "$line" in
    '|'*) ;;
    *) continue ;;
  esac
  line="${line#|}"
  line="${line%|}"
  IFS='|' read -r path url licence author changes extra <<<"$line"
  path="$(trim "$path")"
  # The header row and the separator row are not entries.
  if [ "$path" = "Path" ] || [[ "$path" =~ ^[-:[:space:]]+$ ]]; then
    continue
  fi
  url="$(trim "$url")"
  licence="$(trim "$licence")"
  author="$(trim "$author")"
  changes="$(trim "$changes")"
  where="CREDITS.md line $lineno ($path)"
  path="${path#\`}"
  path="${path%\`}"
  if [ -n "${extra:-}" ] || [ -z "$path" ] || [ -z "$url" ] || [ -z "$licence" ] || [ -z "$author" ]; then
    fail "$where: a row needs the five cells Path | Source URL | Licence | Author | Changes, with all but Changes filled in"
    continue
  fi
  if [ "$(printf '%s\n' "$listed" | grep -cxF -- "$path")" -gt 0 ]; then
    fail "$where: $path is listed twice"
  fi
  listed+="$path"$'\n'
  if [ ! -f "$DIR/$path" ]; then
    fail "$where: the file game/assets/third_party/$path does not exist"
  fi
  if [[ "$ALLOWED" == *" $licence "* ]]; then
    :
  elif [[ "$SHARE_ALIKE" == *" $licence "* ]]; then
    if [[ "$changes" != *"share-alike kept"* ]]; then
      fail "$where: $licence is share-alike; the Changes column must say \"share-alike kept\" (the file keeps and is marked with its licence)"
    fi
  else
    fail "$where: licence \"$licence\" is not allowed (allowed:${ALLOWED}and, with \"share-alike kept\",${SHARE_ALIKE})"
  fi
done <"$CREDITS"

while IFS= read -r -d '' file; do
  rel="${file#"$DIR"/}"
  if [ "$(printf '%s\n' "$listed" | grep -cxF -- "$rel")" -eq 0 ]; then
    fail "game/assets/third_party/$rel has no row in CREDITS.md (add Path | Source URL | Licence | Author | Changes)"
  fi
done < <(find "$DIR" -type f ! -path "$CREDITS" ! -name '*.import' ! -name '*.uid' -print0 | sort -z)

if [ "$errors" -ne 0 ]; then
  echo "check-credits: $errors problem(s)" >&2
  exit 1
fi
echo "check-credits: ok"
