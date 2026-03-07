import { mkdirSync, readdirSync, copyFileSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const src = resolve(__dirname, 'node_modules/speech-rule-engine/lib/mathmaps');
const dest = resolve(__dirname, 'dist/speech-rule-engine/lib/mathmaps');

function copyJsonFiles(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = join(srcDir, entry.name);
    const destPath = join(destDir, entry.name);

    if (entry.isDirectory()) {
      copyJsonFiles(srcPath, destPath);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      copyFileSync(srcPath, destPath);
      console.log(`Copied: ${relative(src, srcPath)}`);
    }
  }
}

copyJsonFiles(src, dest);
console.log('Done.');
