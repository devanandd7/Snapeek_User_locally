const fs = require('fs');
const path = require('path');

function saveDescription(filename, description, folderPath) {
  const descPath = path.join(folderPath, filename + '.txt');
  fs.writeFileSync(descPath, description, 'utf8');
}

module.exports = { saveDescription };
