#!/usr/bin/env node
/**
 * Rebuild a BrowserCoin helper-server chain file from the archived chunks.
 *
 * Concatenates <network>/blocks/*.json (height-ascending, per the manifest)
 * into the exact JSON shape `server/api.ts` reads at startup. Drop the output
 * next to the server as `chain-9000.json` and start it — the server replays
 * and re-validates every block itself, so this script needs no crypto and the
 * archive needs no trust.
 *
 * Usage:
 *   node tools/build-chain-json.mjs [--network browsercoin-pow-v5] [--out chain-9000.json]
 *
 * With a single network folder present, --network can be omitted.
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const get = (flag) => {
  const i = argv.indexOf(flag);
  return i >= 0 ? argv[i + 1] : undefined;
};

const root = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')));

async function detectNetwork() {
  const dirs = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    try {
      await fs.access(path.join(root, entry.name, 'manifest.json'));
      dirs.push(entry.name);
    } catch {
      /* not a network folder */
    }
  }
  if (dirs.length === 1) return dirs[0];
  if (dirs.length === 0) throw new Error('no network folder with a manifest.json found');
  throw new Error(`multiple network folders found (${dirs.join(', ')}) — pass --network`);
}

const network = get('--network') ?? (await detectNetwork());
const out = path.resolve(get('--out') ?? 'chain-9000.json');
const dir = path.join(root, network);

const manifest = JSON.parse(await fs.readFile(path.join(dir, 'manifest.json'), 'utf-8'));
const blocks = [];
let expectedNext = 1;
for (const ref of manifest.chunks) {
  if (ref.fromHeight !== expectedNext) {
    throw new Error(`chunk gap before ${ref.file}: expected fromHeight ${expectedNext}`);
  }
  const chunk = JSON.parse(await fs.readFile(path.join(dir, 'blocks', ref.file), 'utf-8'));
  if (chunk.chainVersion !== manifest.chainVersion) {
    throw new Error(`${ref.file}: chainVersion mismatch`);
  }
  const want = ref.toHeight - ref.fromHeight + 1;
  if (chunk.blocks.length !== want) {
    throw new Error(`${ref.file}: has ${chunk.blocks.length} blocks, manifest says ${want}`);
  }
  blocks.push(...chunk.blocks);
  expectedNext = ref.toHeight + 1;
}

if (blocks.length !== manifest.archivedHeight) {
  throw new Error(`assembled ${blocks.length} blocks, manifest tip is ${manifest.archivedHeight}`);
}

await fs.writeFile(out, JSON.stringify({ version: 1, chainVersion: manifest.chainVersion, blocks }));
console.log(
  `wrote ${out}: ${blocks.length} blocks (${manifest.chainVersion}, height ${manifest.archivedHeight}, tip ${manifest.archivedTipHash.slice(0, 16)}…)`,
);
