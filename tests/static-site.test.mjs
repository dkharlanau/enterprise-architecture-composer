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
  assert.match(index, /href="\.\/styles-v2\.css"/);
  assert.match(index, /src="\.\/src\/app\.mjs"/);
  await access(new URL('styles.css', root), constants.R_OK);
  await access(new URL('styles-v2.css', root), constants.R_OK);
  await access(new URL('src/app.mjs', root), constants.R_OK);
  await access(new URL('src/engine.mjs', root), constants.R_OK);
  await access(new URL('src/composer.mjs', root), constants.R_OK);
  await access(new URL('src/catalog.mjs', root), constants.R_OK);
});

test('public workbench remains zero-backend and avoids remote runtime dependencies', async () => {
  const index = await text('index.html');
  const app = await text('src/app.mjs');
  const engine = await text('src/engine.mjs');
  const composer = await text('src/composer.mjs');

  assert.doesNotMatch(index, /https?:\/\/[^"']+\.(?:js|css)(?:[?"'])/i);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(engine, /\bfetch\s*\(/);
  assert.doesNotMatch(composer, /\bfetch\s*\(/);
  assert.doesNotMatch(engine, /Math\.random|Date\.now|new Date\s*\(/);
  assert.doesNotMatch(composer, /Math\.random|Date\.now|new Date\s*\(/);
});

test('v0.2 product views are present in the first static document', async () => {
  const index = await text('index.html');
  for (const view of ['Blueprint', 'Integrations', 'Data', 'Transition', 'Roadmap', 'Delta']) {
    assert.match(index, new RegExp(`>${view}<`));
  }
  assert.match(index, /Architecture synthesis workbench/);
  assert.match(index, /Why this design\?/);
  assert.match(index, /Composer v0\.2/);
});

test('browser exposes NFR, migration and portable export controls', async () => {
  const index = await text('index.html');
  const app = await text('src/app.mjs');

  assert.match(index, /Integration NFR override/);
  assert.match(index, /Load WMS replacement/);
  assert.match(index, /id="export-bundle"/);
  assert.match(index, /id="export-report"/);
  assert.match(app, /createPortableBundle/);
  assert.match(app, /buildDeliveryRoadmap/);
  assert.match(app, /decisionAnalysis/);
});
