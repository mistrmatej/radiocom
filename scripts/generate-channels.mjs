import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { formatMHz, pmrChannels, uhfChannels, vhfChannels } from './channels-data.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function chirpRow(location, name, frequency, comment) {
  const normalizedFrequency = String(frequency).replace(',', '.');
  return `${location},${name},${normalizedFrequency},,0.000000,,,,,NN,FM,12.50,,${comment}`;
}

function pmrRows() {
  const frequencyCell = (frequency) => {
    const displayFrequency = formatMHz(frequency);
    return `<td><span>${displayFrequency}</span></td>`;
  };
  return Array.from({ length: 8 }, (_, index) => {
    const first = pmrChannels[index];
    const second = pmrChannels[index + 8];
    const firstCsv = chirpRow(first.name, `PMR${first.name}`, formatMHz(first.frequency), 'PMR446');
    const secondCsv = chirpRow(second.name, `PMR${second.name}`, formatMHz(second.frequency), 'PMR446');
    return `<tr class="copy-row" tabindex="0" aria-label="Kopírovat PMR${first.name} a PMR${second.name} jako CSV" data-copy-frequency="${firstCsv}" data-copy-frequency-secondary="${secondCsv}"><td>${first.name}</td>${frequencyCell(first.frequency)}<td>${second.name}</td>${frequencyCell(second.frequency)}</tr>`;
  }).join('\n          ');
}

function channelRows(channels) {
  return channels.map(([name, frequency, power], index) =>
    `<tr class="copy-row" tabindex="0" aria-label="Kopírovat ${name} jako CSV" data-copy-frequency="${chirpRow(index + 1, name, frequency, name.startsWith('UHF') ? 'UHF' : 'VHF')}"><td>${name}</td><td><span>${frequency} MHz</span></td><td>${power}</td></tr>`
  ).join('\n          ');
}

function printRows(channels) {
  return channels.map(channel => {
    const [name, frequency, power] = Array.isArray(channel)
      ? [channel[0], `${channel[1]} MHz`, channel[2]]
      : [channel.name, `${formatMHz(channel.frequency)} MHz`, '0,5 W'];
    return `<tr><td>${name}</td><td>${frequency}</td>${power ? `<td>${power}</td>` : ''}</tr>`;
  }).join('\n          ');
}

async function replaceBlock(file, marker, content) {
  const path = new URL(`../${file}`, import.meta.url);
  const source = await readFile(path, 'utf8');
  const pattern = new RegExp(`(<!-- ${marker}:start -->)[\\s\\S]*?(<!-- ${marker}:end -->)`);
  if (!pattern.test(source)) throw new Error(`Missing channel marker ${marker} in ${file}`);
  await writeFile(path, source.replace(pattern, `$1\n          ${content}\n          $2`), 'utf8');
}

await replaceBlock('index.html', 'channels-pmr', pmrRows());
await replaceBlock('index.html', 'channels-uhf', channelRows(uhfChannels));
await replaceBlock('index.html', 'channels-vhf', channelRows(vhfChannels));
await replaceBlock('print.html', 'channels-pmr', printRows(pmrChannels));
await replaceBlock('print.html', 'channels-uhf', printRows(uhfChannels));
await replaceBlock('print.html', 'channels-vhf', printRows(vhfChannels));
console.log('Generated channel tables in index.html and print.html');
