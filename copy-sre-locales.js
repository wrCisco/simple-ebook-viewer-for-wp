import { mkdirSync, readdirSync, copyFileSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const sreSrc = resolve(__dirname, 'node_modules/speech-rule-engine/lib/mathmaps');
const sreDest = resolve(__dirname, 'dist/speech-rule-engine/lib/mathmaps');

const pdfjsSrc = resolve(__dirname, 'vendor/foliate-js/vendor/pdfjs');
const pdfjsDest = resolve(__dirname, 'dist/vendor/pdfjs');

function copyFiles(srcDir, destDir, { include, exclude } = {}) {
  const root = srcDir;
  let test;
  if (include && exclude) test = name => include.test(name) && !exclude.test(name);
  else if (include) test = name => include.test(name);
  else if (exclude) test = name => !exclude.test(name);
  else test = name => true;
  copyHelper(srcDir, destDir, root, test);

  function copyHelper(srcDir, destDir, root, test) {
    for (const entry of readdirSync(srcDir, { withFileTypes: true })) {
      const srcPath = join(srcDir, entry.name);
      const destPath = join(destDir, entry.name);

      if (entry.isDirectory()) {
        copyHelper(srcPath, destPath, root, test);
      } else if (entry.isFile() && test(entry.name)) {
        mkdirSync(destDir, { recursive: true });
        copyFileSync(srcPath, destPath);
        console.log(`Copied: ${relative(root, srcPath)}`);
      }
    }
  }
}

copyFiles(sreSrc, sreDest, { include: /\.json$/ });
console.log('SRE locales copied.\n');

copyFiles(pdfjsSrc, pdfjsDest, { exclude: /js\.map$/ });
console.log('Pdfjs files copied.\n');
