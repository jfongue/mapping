#!/bin/bash
# Watch les fichiers du projet et push un EAS Update à chaque modif.
# À lancer une fois : ./auto-update.sh
# Le script tourne en continu en arrière-plan.

set -e

PROJECT_DIR="/Users/jeremyfongue/Documents/Claude/Projects/Mapping"
LOG_FILE="$PROJECT_DIR/.auto-update.log"
DEBOUNCE=10  # secondes : attend que les modifs se calment avant de push

cd "$PROJECT_DIR"

# Vérifie fswatch (à installer une fois : brew install fswatch)
if ! command -v fswatch &> /dev/null; then
  echo "fswatch manquant. Installe avec : brew install fswatch" | tee -a "$LOG_FILE"
  exit 1
fi

echo "[$(date)] Auto-update démarré, surveille $PROJECT_DIR" | tee -a "$LOG_FILE"

push_update() {
  echo "[$(date)] Modif détectée, push EAS Update..." | tee -a "$LOG_FILE"
  cd "$PROJECT_DIR"
  npx eas-cli update --branch preview --message "Auto-update $(date '+%Y-%m-%d %H:%M:%S')" --non-interactive >> "$LOG_FILE" 2>&1
  if [ $? -eq 0 ]; then
    echo "[$(date)] ✓ Update poussé" | tee -a "$LOG_FILE"
  else
    echo "[$(date)] ✗ Échec, voir $LOG_FILE" | tee -a "$LOG_FILE"
  fi
}

# Watch les fichiers JS/JSON, ignore node_modules/.expo/.git
LAST_RUN=0
fswatch -r --event=Updated --event=Created --event=Removed \
  --exclude='node_modules' --exclude='\.expo' --exclude='\.git' --exclude='\.auto-update\.log' \
  "$PROJECT_DIR" | while read -r EVENT; do
  NOW=$(date +%s)
  if (( NOW - LAST_RUN < DEBOUNCE )); then
    continue
  fi
  LAST_RUN=$NOW
  sleep "$DEBOUNCE"
  push_update
done
