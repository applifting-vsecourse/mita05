#!/usr/bin/env bash
# Fails when a branch removes or rewrites lines in existing tests.
#
# Adding tests is always fine: new test files, new test cases, new checks in a
# test. Removing or changing a line in a test may weaken it, so a person should
# look at it. This prints every test file with removed lines and exits 1.
#
# Usage: scripts/check-test-changes.sh [base-ref]   (default: origin/main)
# Compares base...HEAD, i.e. only what this branch changed since it forked.
set -euo pipefail

base="${1:-origin/main}"

test_files=(
  ':(glob)**/*.spec.ts'
  ':(glob)**/*.int-spec.ts'
  ':(glob)**/*.test.tsx'
  'apps/frontend/e2e/'
)

echo "Comparing test files: ${base}...HEAD"
numstat="$(git diff --numstat "${base}...HEAD" -- "${test_files[@]}")"

if [ -z "${numstat}" ]; then
  echo "No test files changed."
  exit 0
fi

echo
echo "added  removed  file"
printf '%s\n' "${numstat}" | awk -F'\t' '{ printf "%5s  %7s  %s\n", $1, $2, $3 }'

# numstat: "<added>\t<removed>\t<path>"; binary files show "-" for both.
changed="$(printf '%s\n' "${numstat}" | awk -F'\t' '$2 != "0" { print $3 }')"

if [ -z "${changed}" ]; then
  echo
  echo "OK: test files only gained lines."
  exit 0
fi

echo
echo "::error::These test files have removed or rewritten lines:"
printf '  %s\n' ${changed}
echo
echo "Removed lines (- before, + after):"
# A renamed file reads "dir/{old => new}.ts" in numstat; that isn't a path git
# accepts, so fall back to showing every test file's diff.
if printf '%s\n' "${changed}" | grep -q ' => '; then
  paths=("${test_files[@]}")
else
  mapfile -t paths <<< "${changed}"
fi
git diff --unified=0 --no-color "${base}...HEAD" -- "${paths[@]}" \
  | grep -E '^(diff --git|@@|-[^-]|-$|\+[^+]|\+$)' || true
echo
echo "Removing or changing a test can hide a regression. Make sure each change"
echo "above is intended and mention why in the pull request."
exit 1
