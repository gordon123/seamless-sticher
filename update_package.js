const fs = require('fs');
const path = require('path');

const pkgPath = path.resolve(__dirname, 'package.json');
let data = {};
try {
  const raw = fs.readFileSync(pkgPath, 'utf8');
  data = JSON.parse(raw);
} catch (e) {
  console.error('Failed to read or parse package.json:', e.message);
  process.exit(1);
}

data.scripts = data.scripts || {};
data.scripts.start = "node dev.js";
data.scripts.dev = "node dev.js";

try {
  fs.writeFileSync(pkgPath, JSON.stringify(data, null, 2) + "\n", 'utf8');
  console.log('package.json updated: start and dev scripts set to "node dev.js"');
} catch (e) {
  console.error('Failed to write package.json:', e.message);
  process.exit(1);
}
