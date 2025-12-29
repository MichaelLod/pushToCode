#!/usr/bin/env node
/**
 * Generate PWA icons from SVG source
 * Run: node scripts/generate-icons.js
 * Requires: npm install sharp
 */

const fs = require('fs');
const path = require('path');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const APPLE_TOUCH_SIZE = 180;
const SVG_PATH = path.join(__dirname, '../public/icons/icon.svg');
const OUTPUT_DIR = path.join(__dirname, '../public/icons');

async function generateIcons() {
  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.error('sharp not installed. Run: npm install sharp --save-dev');
    console.log('\nAlternatively, manually convert the SVG to PNG at these sizes:');
    SIZES.forEach(size => console.log(`  - icon-${size}.png (${size}x${size})`));
    process.exit(1);
  }

  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: icon-${size}.png`);
  }

  // Generate apple-touch-icon
  const appleOutputPath = path.join(OUTPUT_DIR, 'apple-touch-icon.png');
  await sharp(svgBuffer)
    .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE)
    .png()
    .toFile(appleOutputPath);
  console.log(`Generated: apple-touch-icon.png`);

  console.log('\nDone! All icons generated.');
}

generateIcons().catch(console.error);
