#!/usr/bin/env bash
# ============================================================================
#  Optional convenience launcher.
#  You can also just run directly:
#      php -S 0.0.0.0:1234
# ----------------------------------------------------------------------------
set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PORT="${1:-1234}"

if [ ! -f config.php ]; then
  echo "ERROR: config.php not found in: $DIR"
  echo "       The project ships with config.php — edit it with your ES credentials."
  exit 1
fi

echo "============================================"
echo "  Zeportic — Zammad Reporting Tool"
echo "  Pure PHP · GPL-3.0 · https://github.com/TadavomnisT/Zeportic"
echo "============================================"
echo "  Listening:  http://0.0.0.0:${PORT}"
echo "  Folder:     ${DIR}"
echo "  Config:     ${DIR}/config.php  (+ config.local.php if the wizard ran)"
echo ""
echo "  First run?  Open http://<this-host>:${PORT} in a browser —"
echo "              the graphical setup wizard will guide you."
echo ""
echo "  Press Ctrl+C to stop."
echo "============================================"

exec php -S "0.0.0.0:${PORT}"
