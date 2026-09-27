#!/bin/bash
# הרצת קובץ .iv ב-macOS/Linux: לחיצה כפולה (ואז בוחרים קובץ), או גרירת קובץ,
# או:  ./run-mac.command myfile.iv   —   דורש Node.js מותקן (https://nodejs.org)
cd "$(dirname "$0")" || exit 1

FILE="$1"
if [ -z "$FILE" ]; then
  # אין קובץ שהועבר — פותחים בורר קבצים (macOS)
  FILE=$(osascript -e 'try
  POSIX path of (choose file with prompt "בחר קובץ .iv להרצה")
end try' 2>/dev/null)
fi
[ -z "$FILE" ] && exit 0

if ! command -v node >/dev/null 2>&1; then
  echo "צריך להתקין Node.js מהאתר https://nodejs.org ואז לנסות שוב."
  read -r -n1 -p "לחצו על מקש כלשהו כדי לסגור..."
  exit 1
fi

OUT="${FILE%.*}.html"
if node bin/ivrit.js build "$FILE" -o "$OUT"; then
  open "$OUT" 2>/dev/null || xdg-open "$OUT" 2>/dev/null
else
  echo "נמצאו שגיאות בקובץ. תקנו אותן ונסו שוב."
  read -r -n1 -p "לחצו על מקש כלשהו כדי לסגור..."
  exit 1
fi
