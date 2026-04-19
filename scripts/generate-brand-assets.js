const fs = require("node:fs/promises");
const path = require("node:path");
const sharp = require("sharp");

const projectRoot = path.resolve(__dirname, "..");
const svgRoot = path.join(projectRoot, "assets", "images", "1x", "SVG");
const outputRoot = path.join(projectRoot, "assets", "branding");

const assets = [
  {
    source: "SvgArtboard 6.svg",
    output: "app-icon.png",
    size: 1024,
  },
  {
    source: "SvgArtboard 6.svg",
    output: "ios-icon.png",
    size: 1024,
  },
  {
    source: "SvgArtboard 6.svg",
    output: "android-adaptive-foreground.png",
    size: 1024,
  },
  {
    source: "SvgArtboard 1.svg",
    output: "android-adaptive-monochrome.png",
    size: 1024,
  },
  {
    source: "SvgArtboard 5.svg",
    output: "splash-logo.png",
    size: 1024,
  },
  {
    source: "SvgArtboard 2.svg",
    output: "favicon.png",
    size: 256,
  },
];

async function generateAsset({ source, output, size }) {
  const sourcePath = path.join(svgRoot, source);
  const outputPath = path.join(outputRoot, output);

  await sharp(sourcePath)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function main() {
  await fs.mkdir(outputRoot, { recursive: true });

  const createdFiles = [];
  for (const asset of assets) {
    const createdPath = await generateAsset(asset);
    createdFiles.push(path.relative(projectRoot, createdPath));
  }

  console.log("Generated branded assets:");
  for (const file of createdFiles) {
    console.log(`- ${file}`);
  }
}

main().catch((error) => {
  console.error("Failed to generate branded assets.");
  console.error(error);
  process.exit(1);
});
