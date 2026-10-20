const fs = require('fs');
const { execSync } = require('child_process');

function getGitInfo(cmd) {
  try {
    return execSync(cmd).toString().trim();
  } catch {
    return 'N/A';
  }
}

const provenance = {
  timestamp: new Date().toISOString(),
  commitHash: getGitInfo('git rev-parse HEAD'),
  branch: getGitInfo('git rev-parse --abbrev-ref HEAD'),
  repository: getGitInfo('git config --get remote.origin.url'),
  nodeVersion: process.version,
  generatedBy: 'UI-FE-061 Provenance Generator'
};

fs.writeFileSync('provenance.json', JSON.stringify(provenance, null, 2));
console.log('Provenance evidence generated at provenance.json');
