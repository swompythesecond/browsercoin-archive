# browsercoin-archive

Continuously updated, fully validated backup of the [BrowserCoin](https://github.com/swompythesecond/BrowserCoin) blockchain.

A GitHub Action runs hourly, pulls new blocks from the public API helper servers, **re-validates every block with the real consensus code** (header linkage, difficulty, timestamps, transaction signatures and balances, and the Argon2id proof-of-work), and commits them here. The chain servers hold no credentials for this repository — archiving is pull-based, so a compromised server cannot rewrite archive history, and forged blocks are rejected at ingestion because forging requires real proof-of-work.

This repo exists so the chain survives even if every BrowserCoin server and every browser node disappears at once.

## Layout

```
browsercoin-pow-v5/            one folder per network version (hard forks get a new folder)
  manifest.json                archived tip height + hash, chunk index
  snapshot.json                account state AFTER the archived tip (self-verifying, see below)
  blocks/
    0000001-0002000.json       2000-block chunks, height-ascending, immutable once full
    0002001-0004000.json       …
tools/
  build-chain-json.mjs         assemble chunks into a helper-server chain file
```

Each chunk file is `{ v, chainVersion, fromHeight, toHeight, blocks: [hex…] }` with hex-encoded blocks in the same binary format the network uses. Only blocks buried at least **60 confirmations (~2.5 hours)** below the live tip are archived, so committed chunks never change — each hourly commit appends to the newest chunk only.

`snapshot.json` is a performance cache for the archiver itself, not a checkpoint: its account state is verified against the archived tip header's `stateRoot` (which the block's proof-of-work commits to) before it is ever used.

## Trust model

You don't need to trust this archive. Every consumer of it — the helper server on startup, a browser node importing blocks — re-validates the full chain itself, proof-of-work included. The worst a malicious archive could do is *withhold* blocks, and the hourly commit timestamps make staleness publicly visible. Validation at ingestion is a hygiene layer, not the security boundary.

## Restoring a helper server from this archive

This is the disaster-recovery path: it works even if every existing BrowserCoin server is gone.

```sh
git clone https://github.com/swompythesecond/browsercoin-archive
cd browsercoin-archive
node tools/build-chain-json.mjs --out chain-9000.json

git clone https://github.com/swompythesecond/BrowserCoin
cd BrowserCoin && npm ci
cp ../chain-9000.json server/
npm run server:api          # replays + re-verifies every block, then serves on :9000
```

Alternatively, grab the latest **monthly release** from this repo — a single `chain-9000.json.gz`, no chunk assembly needed.

Browsers can then be pointed at the new helper via Settings → Helper servers.

## Mirrors

GitHub is one host, not the plan. Clone this repo somewhere safe; any full clone is a complete, verifiable backup of the chain.
