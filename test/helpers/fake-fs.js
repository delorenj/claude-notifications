"use strict";

/**
 * Minimal in-memory fs shim sufficient for the adapter code paths.
 * Implements only the methods the adapters actually call.
 */
function createFakeFs(initial = {}) {
  const files = new Map(Object.entries(initial));
  const dirs = new Set();

  function ensureDirFromFile(p) {
    let dir = p;
    while (dir && dir !== "/" && dir !== ".") {
      const next = dir.slice(0, dir.lastIndexOf("/")) || "/";
      if (next === dir) break;
      dir = next;
      dirs.add(dir);
    }
  }
  for (const p of files.keys()) ensureDirFromFile(p);

  return {
    existsSync(p) {
      return files.has(p) || dirs.has(p);
    },
    readFileSync(p) {
      if (!files.has(p)) {
        const err = new Error(`ENOENT: ${p}`);
        err.code = "ENOENT";
        throw err;
      }
      return files.get(p);
    },
    writeFileSync(p, data) {
      files.set(p, data);
      ensureDirFromFile(p);
    },
    mkdirSync(p) {
      dirs.add(p);
    },
    rmSync() {},
    readdirSync() { return []; },
    rmdirSync() {},
    unlinkSync(p) { files.delete(p); },
    _dump() { return Object.fromEntries(files); },
  };
}

module.exports = { createFakeFs };
