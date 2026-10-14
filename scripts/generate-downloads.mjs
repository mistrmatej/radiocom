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

function describeFile(name) {
  const normalized = name.toLowerCase();
  if (normalized.includes('air_marine')) return 'Licencovaná TX konfigurace plus letecké a námořní RX-only kanály.';
  if (normalized.includes('licensed')) return 'TX konfigurace pro oprávněný radioamatérský provoz; ověřte místní podmínky.';
  if (normalized.includes('praha_rx')) return 'Pražské RX-only kanály; vysílání je zakázané.';
  if (normalized.includes('skip_licensed')) return 'PMR446 + licencované kanály; ověřte nastavení před nahráním.';
  if (normalized.includes('tobi_test')) return 'Testovací konfigurace; nepoužívat bez ověření.';
  if (normalized.includes('fullpmr446')) return 'Plná konfigurace PMR446.';
  if (normalized.includes('partpmr446')) return 'Částečná konfigurace PMR446 a UHF.';
  if (normalized.includes('stock')) return 'Původní tovární konfigurace.';
  return 'Konfigurační obraz pro radiostanici.';
}

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
      size: details.size,
      description: describeFile(entry.name)
    });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

const data = [];
for (const radio of radios) {
  data.push({
    ...radio,
    notes: 'Před nahráním si zálohujte původní konfiguraci radiostanice.',
    files: await getFiles(join(downloadsRoot, radio.id))
  });
}

const output = `window.RADIOCOM_DOWNLOADS = ${JSON.stringify(data, null, 2)};\n`;
await writeFile(outputPath, output, 'utf8');
console.log(`Generated ${outputPath}`);
for (const radio of data) {
  console.log(`${radio.name}: ${radio.files.length} file(s)`);
}
