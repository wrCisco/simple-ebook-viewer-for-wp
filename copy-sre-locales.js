import { mkdirSync, readdirSync, copyFileSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const sreSrc = resolve(__dirname, 'node_modules/speech-rule-engine/lib/mathmaps');
const sreDest = resolve(__dirname, 'dist/speech-rule-engine/lib/mathmaps');

function copyFiles(srcDir, destDir, ext) {
  const root = srcDir
  copyHelper(srcDir, destDir, ext, root)

  function copyHelper(srcDir, destDir, ext, root) {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);

      if (entry.isDirectory()) {
        copyHelper(srcPath, destPath, ext, root);
      } else if (entry.isFile() && entry.name.endsWith(ext)) {
        mkdirSync(destDir, { recursive: true });
        copyFileSync(srcPath, destPath);
        console.log(`Copied: ${relative(root, srcPath)}`);
      }
    }
  }
}

copyFiles(sreSrc, sreDest, '.json');
console.log('SRE locales copied.\n');
