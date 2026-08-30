import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);

async function text(path) {
  return readFile(new URL(path, root), 'utf8');
}

test('static workbench references local assets that exist', async () => {
  const index = await text('index.html');

  assert.match(index, /href="\.\/styles\.css"/);
  assert.match(index, /src="\.\/src\/app\.mjs"/);
  await access(new URL('styles.css', root), constants.R_OK);
  await access(new URL('src/app.mjs', root), constants.R_OK);
  await access(new URL('src/engine.mjs', root), constants.R_OK);
  await access(new URL('src/catalog.mjs', root), constants.R_OK);
});

test('public workbench remains zero-backend and avoids remote runtime dependencies', async () => {
  const index = await text('index.html');
  const app = await text('src/app.mjs');
  const engine = await text('src/engine.mjs');

  assert.doesNotMatch(index, /https?:\/\/[^"']+\.(?:js|css)(?:[?"'])/i);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(engine, /\bfetch\s*\(/);
  assert.doesNotMatch(engine, /Math\.random|Date\.now|new Date\s*\(/);
});

test('core product views are present in the first static document', async () => {
  const index = await text('index.html');
  for (const view of ['Blueprint', 'Integrations', 'Data', 'Roadmap']) {
    assert.match(index, new RegExp(`>${view}<`));
  }
  assert.match(index, /Architecture synthesis workbench/);
  assert.match(index, /Why this design\?/);
});
