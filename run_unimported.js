const { execSync } = require('child_process');
const fs = require('fs');

try {
    const output = execSync('npx --yes unimported', { encoding: 'utf8', env: process.env });
    fs.writeFileSync('unimported-output.txt', output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''), 'utf8');
} catch (error) {
    const output = error.stdout ? error.stdout.toString() : error.message;
    fs.writeFileSync('unimported-output.txt', output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, ''), 'utf8');
}
console.log('Done!');
