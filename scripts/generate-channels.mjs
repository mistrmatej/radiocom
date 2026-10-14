import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { formatMHz, pmrChannels, uhfChannels, vhfChannels } from './channels-data.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));

function pmrRows() {
  const frequencyCell = (name, frequency) =>
    `<td><span>${formatMHz(frequency)}</span><button class="copy-frequency" type="button" data-copy-band="pmr" data-copy-channel="${name}" data-copy-frequency="${formatMHz(frequency)} MHz">Kopírovat</button></td>`;
  return Array.from({ length: 8 }, (_, index) => {
    const first = pmrChannels[index];
    const second = pmrChannels[index + 8];
    return `<tr><td>${first.name}</td>${frequencyCell(first.name, first.frequency)}<td>${second.name}</td>${frequencyCell(second.name, second.frequency)}</tr>`;
  }).join('\n          ');
}

function channelRows(channels, band) {
  return channels.map(([name, frequency, power]) =>
    `<tr><td>${name}</td><td><span>${frequency} MHz</span><button class="copy-frequency" type="button" data-copy-band="${band}" data-copy-channel="${name}" data-copy-frequency="${frequency} MHz">Kopírovat</button></td><td>${power}</td></tr>`
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
await replaceBlock('index.html', 'channels-uhf', channelRows(uhfChannels, 'uhf'));
await replaceBlock('index.html', 'channels-vhf', channelRows(vhfChannels, 'vhf'));
await replaceBlock('print.html', 'channels-pmr', printRows(pmrChannels));
await replaceBlock('print.html', 'channels-uhf', printRows(uhfChannels));
await replaceBlock('print.html', 'channels-vhf', printRows(vhfChannels));
console.log('Generated channel tables in index.html and print.html');
