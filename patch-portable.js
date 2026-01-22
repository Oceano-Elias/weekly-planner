import fs from 'fs';
import path from 'path';

const distPath = path.resolve('dist', 'index.html');
let html = fs.readFileSync(distPath, 'utf8');

console.log('Patching dist/index.html for 100% portability...');

// 1. Remove type="module" to enable file:// execution in Safari
html = html.replace(/<script type="module" crossorigin/g, '<script');
html = html.replace(/type="module" crossorigin/g, '');

// 2. Extract and move <style> tag to <head>
const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/);
if (styleMatch) {
    console.log('Found inlined styles, moving to <head>...');
    const styleTag = styleMatch[0];
    html = html.replace(styleTag, '');
    html = html.replace('</head>', `${styleTag}\n</head>`);
}

// 3. Ensure icon is using Base64 in manifest-like tags (Optional but safer)
// We already inlined it in main.js, so browsers should see it once JS runs.
// But for "unstyled" initial load, let's keep it simple.

// 4. Clean up any remaining absolute paths or service worker references
// that might fail on file://
html = html.replace(/href="\/manifest\.json"/g, 'href="manifest.json"');
html = html.replace(/href="\/icon\.png"/g, 'href="icon.png"');

fs.writeFileSync(distPath, html);
console.log('Portable build patched successfully!');
