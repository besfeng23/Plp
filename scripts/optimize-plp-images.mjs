import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const imageDir = path.join(root, 'public', 'images');

const conversions = [
  ['6EC53159-C897-425D-AA82-5FA8A0C6C0BC.png', 'plp-hero-sunset.webp', 2200],
  ['E189E36D-ED32-48D3-A25E-E33503655583.png', 'plp-hero-day.webp', 2200],
  ['F40304DC-06CB-42FE-A444-D2611AF79A95.png', 'plp-hero-evening.webp', 2200],
  ['5ABEDA33-793C-43B6-915C-B8B6C33C4546.png', 'plp-grand-villa-exterior.webp', 2200],
  ['1375C22C-3194-4407-98C9-328CB0D4735B.png', 'plp-villa-golden-exterior.webp', 2200],
  ['82975C82-90B9-4FC1-84C8-BA54FE9E2F02.png', 'plp-villa-exterior-alt.webp', 2200],
  ['32F47C10-1722-4299-8B4B-FA06578B61FE.png', 'plp-pool-ocean-view.webp', 2200],
  ['75F4A199-45DA-409B-9897-B3C529C6B17E.png', 'plp-master-bedroom-view.webp', 1800],
  ['755D3B48-3A45-40EF-BCF9-4B37FD22E501.png', 'plp-sunset-balcony.webp', 2200],
  ['F7C8F7C9-3DFF-42AB-8189-E7589F8CC3C8.png', 'plp-day-balcony-sea-view.webp', 2200],
  ['9D2D33E5-35ED-4DE2-B165-32C0AB61282C.png', 'plp-rooftop-evening-lounge.webp', 2200],
  ['1B72F8A3-1B90-41B0-9149-BE648B8445C8.png', 'plp-smart-room-twin-view.webp', 1800],
  ['B351D3FB-800D-49F2-9754-9DE02B22B7CA.png', 'plp-bedroom-balcony-outlook.webp', 1800],
  ['126CD191-00B2-4F4C-874B-9AF869C6FBE5.png', 'plp-bath-tub-greenery.webp', 1800],
  ['2BE826C9-F4BE-4662-A723-89743F98D24C.png', 'plp-bathroom-vanity-shower.webp', 1800],
  ['553A5CE3-46C3-4638-A869-69F2F099EFCA.png', 'plp-poolside-experience.webp', 2200],
  ['AD41677B-C11D-4A55-BDD2-C65A944ACB33.png', 'plp-wellness-bath-ritual.webp', 1800],
  ['0F0744BE-6DA0-4EB3-A735-5D87C5816187.png', 'plp-private-breakfast-pool.webp', 1800]
];

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function optimizeOne([sourceName, targetName, maxWidth]) {
  const source = path.join(imageDir, sourceName);
  const target = path.join(imageDir, targetName);

  if (!(await exists(source))) {
    throw new Error(`Missing source image: ${sourceName}`);
  }

  await sharp(source)
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 84, effort: 5 })
    .toFile(target);

  const sourceStat = await fs.stat(source);
  const targetStat = await fs.stat(target);
  const savings = ((1 - targetStat.size / sourceStat.size) * 100).toFixed(1);
  console.log(`optimized ${sourceName} -> ${targetName} (${savings}% smaller)`);
}

await fs.mkdir(imageDir, { recursive: true });
for (const conversion of conversions) {
  await optimizeOne(conversion);
}
