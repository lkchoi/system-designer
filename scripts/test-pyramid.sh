#!/usr/bin/env bash
# Print test pyramid breakdown
#
# Convention:
#   Unit:        src/**/*.test.ts        (excludes *.integ.test.ts)
#   Integration: src/**/*.integ.test.ts
#   E2E:         e2e/**/*.spec.ts

integration=$(grep -r 'it(\|test(' --include='*.integ.test.ts' src 2>/dev/null | wc -l | tr -d ' ')
unit=$(grep -r 'it(\|test(' --include='*.test.ts' src | grep -v '\.integration\.test\.ts' | wc -l | tr -d ' ')
e2e=$(grep -r 'test(' --include='*.spec.ts' e2e 2>/dev/null | grep -v 'test.describe' | wc -l | tr -d ' ')
total=$((unit + integration + e2e))

if [ "$total" -eq 0 ]; then
  echo "No tests found."
  exit 0
fi

echo "Test Pyramid"
echo "────────────────────────────────────"
printf "  Unit:         %4d  (%d%%)\n" "$unit" "$((unit * 100 / total))"
printf "  Integration:  %4d  (%d%%)\n" "$integration" "$((integration * 100 / total))"
printf "  E2E:          %4d  (%d%%)\n" "$e2e" "$((e2e * 100 / total))"
echo "────────────────────────────────────"
printf "  Total:        %4d\n" "$total"
echo ""

# Visual bar (50 chars wide)
bar() {
  local n=$(( $1 * 50 / total ))
  [ "$1" -gt 0 ] && [ "$n" -eq 0 ] && n=1
  [ "$n" -gt 0 ] && printf '█%.0s' $(seq 1 $n)
}

printf "  Unit   %s\n" "$(bar $unit)"
printf "  Integ  %s\n" "$(bar $integration)"
printf "  E2E    %s\n" "$(bar $e2e)"
