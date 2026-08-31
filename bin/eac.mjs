#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { composeArchitecture, serializeComposition } from '../src/composer.mjs';
import { diffCompositions } from '../src/diff.mjs';
import { decideIntegrationPattern } from '../src/integration-decision.mjs';
import { buildDeliveryRoadmap, roadmapToMarkdown } from '../src/roadmap.mjs';
import { bundleToMarkdown, createPortableBundle, serializeBundle } from '../src/export.mjs';
import { toVisualWorkbench, visualWorkbenchMarkdown } from '../src/visual-projection.mjs';
import {
  adoptInterfaceAsCodeProposal,
  createInterfaceAsCodeProposal,
  exportProcessAsCodeStarter
} from '../src/handoff.mjs';

function usage() {
  console.error(`Usage:
  node bin/eac.mjs compose <context.json> [--output blueprint.json]
  node bin/eac.mjs compare <base-context.json> <target-context.json> [--output delta.json]
  node bin/eac.mjs integration <drivers.json> [--output decision.json]
  node bin/eac.mjs roadmap <context.json> [--markdown] [--output roadmap.json|roadmap.md]
  node bin/eac.mjs bundle <context.json> [--private] [--output architecture.bundle.json]
  node bin/eac.mjs report <context.json> [--output architecture-report.md]
  node bin/eac.mjs visual <context.json> [--markdown] [--output visual.json|visual.md]
  node bin/eac.mjs process-starter <context.json> <process-key-or-id> [--output process.json]
  node bin/eac.mjs interface-proposal <context.json> <integration-id> [--output proposal.json]
  node bin/eac.mjs interface-adopt <proposal.json> <decisions.json> [--output interface.json]`);
}

function outputPath(rest) {
  const index = rest.indexOf('--output');
  if (index < 0) return null;
  return rest[index + 1] ?? null;
}

function validateOutput(rest) {
  const path = outputPath(rest);
  if (rest.includes('--output') && !path) return { ok: false, path: null };
  return { ok: true, path };
}

async function readJson(path) {
  return JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8'));
}

async function emitJson(value, path = null) {
  const serialized = `${JSON.stringify(value, null, 2)}\n`;
  if (path) await writeFile(resolve(process.cwd(), path), serialized, 'utf8');
  else process.stdout.write(serialized);
}

async function emitText(value, path = null) {
  if (path) await writeFile(resolve(process.cwd(), path), value, 'utf8');
  else process.stdout.write(value);
}

async function main(argv) {
  const [command, first, second, ...rest] = argv;

  if (command === 'compose' && first) {
    const composeRest = [second, ...rest].filter(Boolean);
    const output = validateOutput(composeRest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }

    const result = composeArchitecture(await readJson(first));
    if (output.path) await writeFile(resolve(process.cwd(), output.path), serializeComposition(result), 'utf8');
    else process.stdout.write(serializeComposition(result));
    return;
  }

  if (command === 'compare' && first && second) {
    const output = validateOutput(rest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }

    const base = composeArchitecture(await readJson(first));
    const target = composeArchitecture(await readJson(second));
    await emitJson(diffCompositions(base, target), output.path);
    return;
  }

  if (command === 'integration' && first) {
    const integrationRest = [second, ...rest].filter(Boolean);
    const output = validateOutput(integrationRest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    await emitJson(decideIntegrationPattern(await readJson(first)), output.path);
    return;
  }

  if (command === 'roadmap' && first) {
    const roadmapRest = [second, ...rest].filter(Boolean);
    const output = validateOutput(roadmapRest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    const roadmap = buildDeliveryRoadmap(composeArchitecture(await readJson(first)));
    if (roadmapRest.includes('--markdown')) await emitText(roadmapToMarkdown(roadmap), output.path);
    else await emitJson(roadmap, output.path);
    return;
  }

  if (command === 'bundle' && first) {
    const bundleRest = [second, ...rest].filter(Boolean);
    const output = validateOutput(bundleRest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    const bundle = createPortableBundle(composeArchitecture(await readJson(first)), {
      shareable: !bundleRest.includes('--private')
    });
    if (output.path) await writeFile(resolve(process.cwd(), output.path), serializeBundle(bundle), 'utf8');
    else process.stdout.write(serializeBundle(bundle));
    return;
  }

  if (command === 'report' && first) {
    const reportRest = [second, ...rest].filter(Boolean);
    const output = validateOutput(reportRest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    const bundle = createPortableBundle(composeArchitecture(await readJson(first)));
    await emitText(bundleToMarkdown(bundle), output.path);
    return;
  }

  if (command === 'visual' && first) {
    const visualRest = [second, ...rest].filter(Boolean);
    const output = validateOutput(visualRest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    const projection = toVisualWorkbench(composeArchitecture(await readJson(first)));
    if (visualRest.includes('--markdown')) await emitText(visualWorkbenchMarkdown(projection), output.path);
    else await emitJson(projection, output.path);
    return;
  }

  if (command === 'process-starter' && first && second) {
    const output = validateOutput(rest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    const result = composeArchitecture(await readJson(first));
    await emitJson(exportProcessAsCodeStarter(result, second), output.path);
    return;
  }

  if (command === 'interface-proposal' && first && second) {
    const output = validateOutput(rest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    const result = composeArchitecture(await readJson(first));
    await emitJson(createInterfaceAsCodeProposal(result, second), output.path);
    return;
  }

  if (command === 'interface-adopt' && first && second) {
    const output = validateOutput(rest);
    if (!output.ok) {
      usage();
      process.exitCode = 2;
      return;
    }
    const proposal = await readJson(first);
    const decisions = await readJson(second);
    const adoption = adoptInterfaceAsCodeProposal(proposal, decisions);
    if (!adoption.ready) {
      console.error(`eac: interface proposal is not ready for adoption:\n- ${adoption.errors.join('\n- ')}`);
      process.exitCode = 3;
      return;
    }
    await emitJson(adoption.document, output.path);
    return;
  }

  usage();
  process.exitCode = 2;
}

main(process.argv.slice(2)).catch((error) => {
  console.error(`eac: ${error.message}`);
  process.exitCode = 1;
});
