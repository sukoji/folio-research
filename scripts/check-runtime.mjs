if (Number(process.versions.node.split('.')[0]) < 24) {
  console.error('Folio requires Node.js 24 or newer. Install Node.js LTS, then run again.');
  process.exit(1);
}
