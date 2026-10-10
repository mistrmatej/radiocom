import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const downloadsRoot = join(projectRoot, 'assets', 'downloads');
const outputPath = join(projectRoot, 'assets', 'js', 'downloads-data.js');
const radios = [
  { id: 'uv-5rm', name: 'Baofeng UV-5RM' },
  { id: 'bf-v8a', name: 'Baofeng BF-V8A' }
];

async function getFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.img')) continue;
    const path = join(directory, entry.name);
    const details = await stat(path);
    files.push({
      name: entry.name,
      path: posix.join(...relative(projectRoot, path).split('\\')),
      extension: 'IMG',
      size: details.size
    });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

const data = [];
for (const radio of radios) {
  data.push({ ...radio, files: await getFiles(join(downloadsRoot, radio.id)) });
}

const output = `window.RADIOCOM_DOWNLOADS = ${JSON.stringify(data, null, 2)};\n`;
await writeFile(outputPath, output, 'utf8');
console.log(`Generated ${outputPath}`);
for (const radio of data) {
  console.log(`${radio.name}: ${radio.files.length} file(s)`);
}
