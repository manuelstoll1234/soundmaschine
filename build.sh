#!/bin/bash
cd ~/Development/soundmaschine
node --check app.js || { echo "SYNTAXFEHLER - Abbruch"; exit 1; }
python3 - <<'PY'
import re
html=open('index.html').read(); js=open('app.js').read()
html=re.sub(r'<script>\n.*?\n</script>\n</body>','</body>',html,flags=re.S)
full=html.replace('</body>','<script>\n'+js+'\n</script>\n</body>')
open('index.html','w').write(full)
print("built", len(full))
PY
