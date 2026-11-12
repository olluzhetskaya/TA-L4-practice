#!/usr/bin/env bash
# Run ast-grep rules under tools/ast-grep/rules/.
# Error-severity rules fail the check; warning/info do not.
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v ast-grep &>/dev/null; then
  echo "ast-grep is not installed."
  echo "macOS: brew install ast-grep   |   any OS: npm i -g @ast-grep/cli"
  exit 127
fi

ast-grep scan --report-style=short "$@"
