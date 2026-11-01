#!/bin/bash
# Baut index.html (eigenstaendig, ohne CDN) aus MundartAssistent.jsx.
# Braucht Node 18+. Abhaengigkeiten landen in einem Temp-Ordner, nicht im Repo.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cd "$TMP"
npm init -y >/dev/null
npm i --silent esbuild@0.24.0 react@18.3.1 react-dom@18.3.1 tailwindcss@3.4.17 >/dev/null
cat > entry.jsx <<JS
import React from "react";
import { createRoot } from "react-dom/client";
import App from "$HERE/MundartAssistent.jsx";
createRoot(document.getElementById("root")).render(<App />);
JS
echo "module.exports={content:['$HERE/MundartAssistent.jsx'],theme:{extend:{}},plugins:[]};" > tailwind.config.js
printf '@tailwind base;@tailwind components;@tailwind utilities;' > in.css
NODE_PATH="$TMP/node_modules" npx esbuild entry.jsx --bundle --minify --outfile=app.js --loader:.jsx=jsx \
  --define:process.env.NODE_ENV='"production"' --target=es2019 --log-level=warning
npx tailwindcss -c tailwind.config.js -i in.css -o app.css --minify 2>/dev/null
python3 - "$TMP" "$HERE/index.html" <<'PY'
import sys
tmp, out = sys.argv[1], sys.argv[2]
js = open(f"{tmp}/app.js").read().replace("</script", "<\\/script")
css = open(f"{tmp}/app.css").read()
html = open(out).read()
head, rest = html.split("<style>", 1)
_, rest = rest.split("</style>", 1)
before, after = rest.split("<script>", 1)
_, tail = after.rsplit("</script>", 1)
open(out, "w").write(f"{head}<style>{css}</style>{before}<script>{js}</script>{tail}")
print("built", out)
PY
