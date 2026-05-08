#!/usr/bin/env node

import sha3 from "js-sha3";
const keccak256 = sha3.keccak256;
import fs from "node:fs/promises";
import path from "node:path";

const { readFile, readdir, stat, writeFile } = fs;

const CONTRACTS_DIR = path.join(process.cwd(), "references", "contracts");

const STRUCT_TYPE_MAP = {
  "TradingLimits.Config": "(uint32,uint32,int48,int48,int48,int48,int48,uint8)",
  "TradingLimits.State": "(uint32,uint32,int48,int48,int48)",
};

function isTopLevelKeyLine(line) {
  if (!line) return false;
  if (line.startsWith("#")) return false;
  if (!line.endsWith(":")) return false;
  if (line[0] !== " ") return true;
  return false;
}

function stripQuotes(s) {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

function sanitizeType(t) {
  const x = t.replace(/\r/g, "").trim();
  if (!x) return null;
  if (x in STRUCT_TYPE_MAP) return STRUCT_TYPE_MAP[x];
  return x;
}

function typeLooksUnknown(t) {
  const x = t.replace(/\r/g, "").trim();
  if (!x) return true;
  if (x in STRUCT_TYPE_MAP) return false;
  const c = x[0];
  if (c >= "A" && c <= "Z") return true;
  return false;
}

function fnBaseName(keyName) {
  const k = stripQuotes(keyName);
  const i = k.indexOf("(");
  if (i === -1) return k;
  return k.slice(0, i).trim();
}

function parseInputTypes(blockLines) {
  let i = 0;
  while (i < blockLines.length) {
    const line = blockLines[i].replace(/\r/g, "");
    const trimmed = line.trim();
    if (trimmed.startsWith("inputs:")) {
      const sameLine = trimmed === "inputs: []" || trimmed === "inputs:[]";
      if (sameLine) return [];
      const res = [];
      i += 1;
      while (i < blockLines.length) {
        const l = blockLines[i].replace(/\r/g, "");
        const t = l.trim();
        if (!l.startsWith("    -")) break;
        const mNamed = l.match(/^\s*-\s*[^:]+:\s*([^\s]+)\s*$/);
        const mAnon = l.match(/^\s*-\s*([^\s]+)\s*$/);
        if (mNamed) res.push(sanitizeType(mNamed[1]));
        else if (mAnon) res.push(sanitizeType(mAnon[1]));
        else break;
        i += 1;
      }
      return res.filter(Boolean);
    }
    i += 1;
  }
  return null;
}

function parseEvents(contractText) {
  const lines = contractText.split("\n").map((l) => l.replace(/\r/g, ""));
  let idx = 0;
  while (idx < lines.length) {
    const line = lines[idx];
    if (line.startsWith("events:")) break;
    idx += 1;
  }
  if (idx >= lines.length) return [];
  idx += 1;
  const events = [];
  while (idx < lines.length) {
    const line = lines[idx];
    if (line.length === 0) {
      idx += 1;
      continue;
    }
    if (line[0] !== " " && line.endsWith(":")) break;
    const eventLine = line.match(/^ {2}([^\s].+?):\s*$/);
    if (eventLine) {
      const eventName = stripQuotes(eventLine[1]);
      const blockStart = idx;
      idx += 1;
      const indexedTypes = [];
      const dataTypes = [];
      let mode = null;
      while (idx < lines.length) {
        const l = lines[idx];
        if (l.length === 0) {
          idx += 1;
          continue;
        }
        if (/^\S/.test(l) && l.endsWith(":")) break;
        const nextEventLine = l.match(/^ {2}([^\s].+?):\s*$/);
        if (nextEventLine) break;
        const trimmed = l.trim();
        if (trimmed.startsWith("indexed:")) {
          mode = "indexed";
          const same = trimmed === "indexed: []" || trimmed === "indexed:[]";
          if (same) {
            mode = null;
            idx += 1;
            continue;
          }
          idx += 1;
          continue;
        }
        if (trimmed.startsWith("data:")) {
          mode = "data";
          const same = trimmed === "data: []" || trimmed === "data:[]";
          if (same) {
            mode = null;
            idx += 1;
            continue;
          }
          idx += 1;
          continue;
        }
        const mItem = l.match(/^\s*-\s*[^:]+:\s*([^\s]+)\s*$/);
        const mItemAnon = l.match(/^\s*-\s*([^\s]+)\s*$/);
        if (mode === "indexed") {
          if (mItem) indexedTypes.push(sanitizeType(mItem[1]));
          else if (mItemAnon) indexedTypes.push(sanitizeType(mItemAnon[1]));
          else if (l.trim().startsWith("-")) {}
        } else if (mode === "data") {
          if (mItem) dataTypes.push(sanitizeType(mItem[1]));
          else if (mItemAnon) dataTypes.push(sanitizeType(mItemAnon[1]));
          else if (l.trim().startsWith("-")) {}
        }
        idx += 1;
      }
      const sigTypes = [...indexedTypes, ...dataTypes].filter(Boolean);
      if (sigTypes.length) {
        events.push({ sig: `${eventName}(${sigTypes.join(",")})` });
      } else {
        events.push({ sig: `${eventName}()` });
      }
      continue;
    }
    idx += 1;
  }
  return events;
}

function parseInherits(contractText) {
  const lines = contractText.split("\n").map((l) => l.replace(/\r/g, ""));
  let idx = 0;
  while (idx < lines.length) {
    const t = lines[idx].trim();
    if (t === "inherits:") break;
    idx += 1;
  }
  if (idx >= lines.length) return [];
  idx += 1;

  const inherits = [];
  while (idx < lines.length) {
    const t = lines[idx].trim();
    if (!t) {
      idx += 1;
      continue;
    }
    const m = t.match(/^-\s*([^\s#]+)\s*$/);
    if (!m) break;
    inherits.push(stripQuotes(m[1]));
    idx += 1;
  }
  return inherits.filter(Boolean);
}

async function collectEventsForAbi(abiPath, abiText, visited) {
  if (visited.has(abiPath)) return [];
  visited.add(abiPath);

  let events = parseEvents(abiText);
  const inherits = parseInherits(abiText);

  for (const parentName of inherits) {
    const parentPath = path.join(CONTRACTS_DIR, `${parentName}.abi.yaml`);
    let parentText;
    try {
      await stat(parentPath);
      parentText = await readFile(parentPath, "utf8");
    } catch (_) {
      continue;
    }
    const parentEvents = await collectEventsForAbi(
      parentPath,
      parentText,
      visited,
    );
    events = events.concat(parentEvents);
  }

  const dedup = new Map();
  for (const e of events) {
    if (!e || !e.sig) continue;
    if (dedup.has(e.sig)) continue;
    dedup.set(e.sig, e);
  }
  return [...dedup.values()];
}

function parseFunctions(contractText) {
  const lines = contractText.split("\n").map((l) => l.replace(/\r/g, ""));
  const keys = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    if (line.startsWith("#")) continue;
    if (!line.endsWith(":")) continue;
    if (line[0] !== " ") {
      const m = line.match(/^([^:]+):\s*$/);
      if (!m) continue;
      const k = stripQuotes(m[1]);
      if (["meta", "events", "errors"].includes(k)) continue;
      keys.push({ key: k, start: i });
    }
  }
  const functions = [];
  for (let i = 0; i < keys.length; i++) {
    const cur = keys[i];
    const next = i + 1 < keys.length ? keys[i + 1].start : lines.length;
    const block = lines.slice(cur.start + 1, next);
    const mutLine = block.find((l) => l.trim().startsWith("mutability:"));
    const hasInputsHeader = block.find((l) => l.trim().startsWith("inputs:"));
    if (!mutLine && !hasInputsHeader) continue;
    const inputTypes = parseInputTypes(block);
    if (inputTypes === null) continue;
    const base = fnBaseName(cur.key);
    const types = inputTypes.map((t) => sanitizeType(t)).filter((t) => t);
    const canMakeSelector = types.every((t) => !typeLooksUnknown(t));
    if (!canMakeSelector) continue;
    const sig = `${base}(${types.join(",")})`;
    functions.push({ sig });
  }
  return functions;
}

function selectorsForSignatures(items) {
  const out = [];
  for (const it of items) {
    const h = keccak256(it.sig);
    const selector = "0x" + h.slice(0, 8);
    if (it.type === "event") out.push({ sig: it.sig, topic0: "0x" + h });
    else out.push({ sig: it.sig, selector });
  }
  return out;
}

function toYamlMap(map, indent = 2) {
  const pad = " ".repeat(indent);
  const entries = Object.entries(map);
  if (!entries.length) return "{}\n";
  let s = "";
  for (const [k, v] of entries) {
    s += `${pad}${k}: ${v}\n`;
  }
  return s;
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    const msg = [
      "GoodSkills selectors generator",
      "Requires: npm install && node scripts/selectors.mjs <cmd>",
      "Commands:",
      "list",
      "generate [contractFile]",
    ].join("\n");
    console.log(msg);
    return;
  }

  const files = (await readdir(CONTRACTS_DIR))
    .filter((f) => f.endsWith(".abi.yaml"))
    .filter((f) => !f.endsWith(".selectors.yaml"))
    .filter((f) => f !== "_rich-abi-yaml-format.md");

  if (cmd === "list") {
    console.log(files.join("\n"));
    return;
  }

  const targetFiles = arg ? files.filter((f) => f === arg) : files;

  if (!targetFiles.length) {
    console.error("No matching contract files.");
    process.exit(1);
  }

  for (const file of targetFiles) {
    const abiPath = path.join(CONTRACTS_DIR, file);
    const text = await readFile(abiPath, "utf8");
    const fnItems = parseFunctions(text);
    const eventItems = (
      await collectEventsForAbi(abiPath, text, new Set())
    ).map((e) => ({ ...e, type: "event" }));
    const fnSel = selectorsForSignatures(fnItems);
    const evSel = selectorsForSignatures(eventItems);

    const fnMap = {};
    for (const x of fnSel) fnMap[x.sig] = x.selector;
    const evMap = {};
    for (const x of evSel) evMap[x.sig] = x.topic0;

    const out = [
      toYamlLine("# Generated by scripts/selectors.mjs"),
      "functions:",
      toYamlMap(fnMap, 2).trimEnd(),
      "events:",
      toYamlMap(evMap, 2).trimEnd(),
      "errors: {}",
      "",
    ].join("\n");

    const outPath = abiPath.replace(/\.abi\.yaml$/, ".selectors.yaml");
    await writeFile(outPath, out, "utf8");
    console.log(`wrote ${path.basename(outPath)}`);
  }
}

function toYamlLine(s) {
  return s;
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e));
  process.exit(1);
});

