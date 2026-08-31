#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { composeArchitecture } from '../src/composer.mjs';
import {
  architectureReviewHtml,
  architectureReviewMarkdown,
  createArchitectureReview
} from '../src/review-report.mjs';

function usage() {
  console.error('Usage: node bin/eac-review.mjs <context.json> [--format markdown|html|json] [--output report.md|report.html|report.json]');
}

function optionValue(args, name) {
  const index = args.indexOf(name);
  return index < 0 ? null : args[index + 1] ?? null;
}

async function main(argv) {
  const [contextPath, ...rest] = argv;
  if (!contextPath) {
    usage();
    process.exitCode = 2;
    return;
  }
  const format = optionValue(rest, '--format') ?? 'markdown';
  const output = optionValue(rest, '--output');
  if (!['markdown', 'html', 'json'].includes(format)) throw new Error(`Unsupported format: ${format}`);
  if (rest.includes('--output') && !output) throw new Error('--output requires a path');

  const context = JSON.parse(await readFile(resolve(process.cwd(), contextPath), 'utf8'));
  const review = createArchitectureReview(composeArchitecture(context));
  const content = format === 'html'
    ? architectureReviewHtml(review)
    : format === 'json'
      ? `${JSON.stringify(review, null, 2)}\n`
      : architectureReviewMarkdown(review);

  if (output) await writeFile(resolve(process.cwd(), output), content, 'utf8');
  else process.stdout.write(content);
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac-review: ${error.message}`);
  process.exitCode = 1;
});
