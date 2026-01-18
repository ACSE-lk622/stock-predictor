# 產生 PWA 圖示

## 方法 1: 使用線上工具（最簡單）

1. 前往 https://realfavicongenerator.net/
2. 上傳 `icon.svg` 檔案
3. 下載產生的圖示包
4. 將圖示放到此目錄

## 方法 2: 使用指令產生

需要安裝 ImageMagick:

```bash
# macOS
brew install imagemagick

# 產生所有尺寸
convert icon.svg -resize 72x72 icon-72x72.png
convert icon.svg -resize 96x96 icon-96x96.png
convert icon.svg -resize 128x128 icon-128x128.png
convert icon.svg -resize 144x144 icon-144x144.png
convert icon.svg -resize 152x152 icon-152x152.png
convert icon.svg -resize 192x192 icon-192x192.png
convert icon.svg -resize 384x384 icon-384x384.png
convert icon.svg -resize 512x512 icon-512x512.png
convert icon.svg -resize 180x180 apple-touch-icon.png
```

## 方法 3: 使用 PWA Asset Generator

```bash
npx pwa-asset-generator icon.svg ./icons --index ./index.html
```

## 需要的圖示檔案

- icon-72x72.png
- icon-96x96.png
- icon-128x128.png
- icon-144x144.png
- icon-152x152.png
- icon-192x192.png
- icon-384x384.png
- icon-512x512.png
- apple-touch-icon.png (180x180)
