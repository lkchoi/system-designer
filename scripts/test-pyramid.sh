#!/usr/bin/env bash
# Print test pyramid breakdown

unit=$(grep -r 'it(\|test(' --include='*.test.ts' src | wc -l | tr -d ' ')
e2e=$(grep -r 'test(' --include='*.spec.ts' e2e | grep -v 'test.describe' | wc -l | tr -d ' ')
total=$((unit + e2e))

echo "Test Pyramid"
echo "────────────────────────────────"
printf "  Unit (vitest):       %4d  (%d%%)\n" "$unit" "$((unit * 100 / total))"
printf "  E2E  (playwright):   %4d  (%d%%)\n" "$e2e" "$((e2e * 100 / total))"
echo "────────────────────────────────"
printf "  Total:               %4d\n" "$total"
echo ""

# Visual bar (50 chars wide)
unit_bar=$((unit * 50 / total))
e2e_bar=$((e2e * 50 / total))
[ "$e2e_bar" -eq 0 ] && e2e_bar=1

printf "  Unit  %s\n" "$(printf '█%.0s' $(seq 1 $unit_bar))"
printf "  E2E   %s\n" "$(printf '█%.0s' $(seq 1 $e2e_bar))"
