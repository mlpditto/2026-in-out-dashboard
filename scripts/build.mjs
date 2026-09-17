/**
 * Copies the site into dist/ for the GitHub Pages mirror.
 *
 * This used to be a one-line cmd script, but "if not exist dist mkdir dist && xcopy ..."
 * puts every xcopy inside the if, so a second build into an existing dist copied nothing
 * and gh-pages published whatever was left over from the first one. Node behaves the
 * same whichever shell npm happens to pick.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const FILE_TYPES = ['.html', '.css', '.js'];
const DIRS = ['images'];

// Start clean so a renamed or deleted page cannot linger in the published mirror.
if (existsSync(DIST)) rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST);

const copied = [];

for (const name of readdirSync('.', { withFileTypes: true })) {
    if (!name.isFile()) continue;
    if (!FILE_TYPES.some((ext) => name.name.endsWith(ext))) continue;
    cpSync(name.name, join(DIST, name.name));
    copied.push(name.name);
}

for (const dir of DIRS) {
    if (!existsSync(dir)) continue;
    cpSync(dir, join(DIST, dir), { recursive: true });
    copied.push(dir + '/');
}

if (copied.length === 0) {
    console.error('build: nothing was copied - is this running in the project root?');
    process.exit(1);
}

console.log(`build: ${copied.length} item(s) -> ${DIST}/`);
console.log('  ' + copied.join('\n  '));
