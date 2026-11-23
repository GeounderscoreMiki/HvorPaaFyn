// Kommuner med navn og et punkt inde i kommunen (bruges til placering af navnet på kortet).
const dm = (d, m) => d + m / 60;

const municipalities = [
  { id: 'langeland', name: 'Langeland', lat: dm(54, 56.94), lng: dm(10, 47.7) },
  { id: 'kerteminde', name: 'Kerteminde', lat: dm(55, 27.18), lng: dm(10, 36.24) },
  { id: 'assens', name: 'Assens', lat: dm(55, 19.14), lng: dm(10, 2.28) },
  { id: 'svendborg', name: 'Svendborg', lat: dm(55, 6.18), lng: dm(10, 36.66) },
  { id: 'nordfyns', name: 'Nordfyns', lat: dm(55, 31.86), lng: dm(10, 14.82) },
  { id: 'aeroe', name: 'Ærø', lat: dm(54, 53.46), lng: dm(10, 24.42) },
  { id: 'middelfart', name: 'Middelfart', lat: dm(55, 27.36), lng: dm(9, 56.7) },
  { id: 'faaborg', name: 'Faaborg-Midtfyn', lat: dm(55, 13.62), lng: dm(10, 24.42) },
  { id: 'nyborg', name: 'Nyborg', lat: dm(55, 19.14), lng: dm(10, 41.4) },
  { id: 'odense', name: 'Odense', lat: dm(55, 23.34), lng: dm(10, 21.42) },
];

export { municipalities };
