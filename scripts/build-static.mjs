import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const parts = [];
for (let i = 0; i < 8; i++) {
  const name = `static-parts/world-${String(i).padStart(2,'0')}.b64`;
  parts.push((await readFile(name, 'utf8')).trim());
}
const html = gunzipSync(Buffer.from(parts.join(''), 'base64'));
await mkdir('netlify', { recursive: true });
await writeFile('netlify/index.html', html);
console.log(`Built Bellweather frontend: ${html.length} bytes`);
