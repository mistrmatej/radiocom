export const pmrChannels = Array.from({ length: 16 }, (_, index) => ({
  name: String(index + 1),
  frequency: 446.00625 + index * 0.0125
}));

export const uhfChannels = [
  ['UHF1', '448,490000', '5 W'],
  ['UHF2', '448,570000', '5 W'],
  ['UHF3', '448,610000', '5 W'],
  ['UHF4', '449,770000', '1 W'],
  ['UHF5', '449,810000', '1 W'],
  ['UHF6', '442,200000', '5 W'],
  ['UHF7', '442,225000', '5 W'],
  ['UHF8', '442,250000', '5 W'],
  ['UHF9', '442,275000', '5 W']
];

export const vhfChannels = [
  ['VHF1', '172,650000', '5 W'],
  ['VHF2', '172,725000', '1 W'],
  ['VHF3', '172,950000', '5 W'],
  ['VHF4', '172,975000', '5 W'],
  ['VHF5', '173,050000', '1 W']
];

export function formatMHz(value) {
  return value.toFixed(6).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
}
