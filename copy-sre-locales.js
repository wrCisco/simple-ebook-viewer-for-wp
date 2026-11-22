import { mkdirSync, readdirSync, copyFileSync } from 'fs';
import { resolve, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const sreSrcBase = resolve(__dirname, 'node_modules/speech-rule-engine');
const sreSrc = join(sreSrcBase, 'lib/mathmaps');
const sreDestBase = resolve(__dirname, 'dist/speech-rule-engine');
const sreDest = join(sreDestBase, 'lib/mathmaps');

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
copyFileSync(join(sreSrcBase, 'LICENSE'), join(sreDestBase, 'LICENSE'));
console.log('SRE locales copied.\n');

// pdf(.min).mjs is directly imported: don't ship as separate file
// quickjs is used for pdf scripting, which is not supported
// js.map's are only useful for debugging purposes with unminified pdfjs files
copyFiles(pdfjsSrc, pdfjsDest, { exclude: /(?:pdf\.min\.mjs$|LICENSE_.*QUICKJS|quickjs-eval\.|js\.map$)/ });
console.log('Pdfjs files copied.\n');


const fontsSrcBase = resolve(__dirname, 'resources/fonts');
const fontsDestBase = resolve(__dirname, 'dist/assets');
copyFileSync(
  join(fontsSrcBase, 'latinmodern/GUST-FONT-LICENSE.txt'),
  join(fontsDestBase, 'LICENSE_LATINMODERN.txt'),
);
copyFileSync(
  join(fontsSrcBase, 'manrope/OFL.txt'),
  join(fontsDestBase, 'LICENSE_MANROPE.txt'),
);
copyFileSync(
  join(fontsSrcBase, 'opendyslexic/OFL.txt'),
  join(fontsDestBase, 'LICENSE_OPENDYSLEXIC.txt'),
);
console.log('Fonts licenses copied.\n');
