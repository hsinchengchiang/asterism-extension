#!/bin/bash
# 打包 Chrome 插件，用于提交 Chrome Web Store
# 用法：bash build-zip.sh

VERSION=$(node -e "const m=require('./manifest.json'); console.log(m.version)")
OUTPUT="asterism-extension-v${VERSION}.zip"

zip -r "$OUTPUT" \
  manifest.json \
  background.js \
  content.js \
  popup.html \
  popup.js \
  icon16.png \
  icon48.png \
  icon128.png

echo "✓ Built: $OUTPUT"
