import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import vm from "node:vm"

// The CUDA figures port two course labs (lr00rl/cuda-cpp-course at 5d2777f).
// Their widget files are plain browser scripts; evaluating each in a context of
// { WIDGETS: {} } proves they touch no DOM at load and exposes the pure model
// and geometry functions checked here.
function load(file, names) {
  const context = vm.createContext({ WIDGETS: {} })
  const source = readFileSync(new URL(`../components/widgets/${file}`, import.meta.url), "utf8")
  vm.runInContext(source, context, { filename: file })
  const out = { widgets: Object.keys(context.WIDGETS) }
  for (const name of names) out[name] = vm.runInContext(name, context)
  return out
}

// Objects from the vm realm carry its prototypes; compare them as plain data.
const plain = (value) => JSON.parse(JSON.stringify(value))
const range = (n) => Array.from({ length: n }, (_, i) => i)
const close = (actual, expected, eps, message) =>
  assert.ok(Math.abs(actual - expected) <= eps, `${message}: ${actual} vs ${expected}`)

const sector = load("sector-stride.js", ["sectorStrideModel", "sectorStrideGeometry"])
const bank = load("bank-map.js", ["bankMapModel", "bankMapGeometry"])

/* ---------- course references, transcribed from the lab sources ---------- */

// coalescing-lab.tsx L45-68 (TypeScript types dropped).
function courseCoalescing(stride, offset, elem) {
  const SECTOR_BYTES = 32
  const WARP = 32
  const accesses = Array.from({ length: WARP }, (_, lane) => {
    const byteAddr = (offset + lane * stride) * elem
    return {
      lane,
      byteAddr,
      firstSector: Math.floor(byteAddr / SECTOR_BYTES),
      lastSector: Math.floor((byteAddr + elem - 1) / SECTOR_BYTES),
    }
  })
  const sectorMap = new Map()
  for (const a of accesses) {
    for (let s = a.firstSector; s <= a.lastSector; s++) {
      const list = sectorMap.get(s) ?? []
      list.push(a.lane)
      sectorMap.set(s, list)
    }
  }
  const sectors = [...sectorMap.keys()].sort((x, y) => x - y)
  const bytesMoved = sectors.length * SECTOR_BYTES
  const bytesUsed = WARP * elem
  const efficiency = bytesUsed / bytesMoved
  return { sectors, bytesMoved, bytesUsed, text: `${(efficiency * 100).toFixed(1)}%` }
}

// bank-conflict-lab.tsx L24-58 (TypeScript types dropped).
function courseBankConflict(pattern, stride, tileCols, pad) {
  const BANKS = 32
  const WARP = 32
  const rowWidth = tileCols + pad
  const wordIndex = (lane) => {
    switch (pattern) {
      case "linear":
        return lane * stride
      case "column":
        return lane * rowWidth
      case "swizzle":
        return lane * tileCols + (0 ^ (lane & (BANKS - 1)))
      case "broadcast":
        return 0
    }
  }
  const lanes = Array.from({ length: WARP }, (_, lane) => {
    const idx = wordIndex(lane)
    return { lane, word: idx, bank: ((idx % BANKS) + BANKS) % BANKS }
  })
  const byBank = new Map()
  for (const l of lanes) {
    const list = byBank.get(l.bank) ?? []
    list.push({ lane: l.lane, word: l.word })
    byBank.set(l.bank, list)
  }
  let worst = 1
  for (const entries of byBank.values()) {
    worst = Math.max(worst, new Set(entries.map((e) => e.word)).size)
  }
  return { lanes, worst, usedBanks: byBank.size }
}

/* ---------- sector-stride ---------- */

test("sector-stride: the widget file registers sector-stride in node:vm", () => {
  assert.deepEqual(sector.widgets, ["sector-stride"])
})

test("sector-stride: stride 8 moves 1024 B for 128 B used, 12.5%, one read per sector in slot 0", () => {
  const m = plain(sector.sectorStrideModel(8))
  assert.equal(m.transactions, 32)
  assert.equal(m.bytesMoved, 1024)
  assert.equal(m.bytesUsed, 128)
  assert.equal(m.efficiencyText, "12.5%")
  assert.deepEqual(m.sectors, range(32))
  assert.deepEqual(
    m.lanes.map((lane) => lane.slot),
    Array(32).fill(0),
  )
  assert.deepEqual(
    m.lanes.map((lane) => lane.firstSector),
    range(32),
  )
  assert.deepEqual(m.reads, Array(32).fill(1))
})

test("sector-stride: stride 1 fits in 4 sectors at 100.0%", () => {
  const m = plain(sector.sectorStrideModel(1))
  assert.equal(m.transactions, 4)
  assert.equal(m.bytesMoved, 128)
  assert.equal(m.efficiencyText, "100.0%")
  assert.deepEqual(m.reads, [8, 8, 8, 8])
})

// s: transactions, bytes moved, efficiency text, reads per fetched sector.
const STRIDE_TABLE = [
  [1, 4, 128, "100.0%", (reads) => reads.every((n) => n === 8)],
  [2, 8, 256, "50.0%", (reads) => reads.every((n) => n === 4)],
  [3, 12, 384, "33.3%", (reads) => reads.join(",") === "3,3,2,3,3,2,3,3,2,3,3,2"],
  [4, 16, 512, "25.0%", (reads) => reads.every((n) => n === 2)],
  [5, 20, 640, "20.0%", (reads) => reads.every((n) => n === 1 || n === 2)],
  [6, 24, 768, "16.7%", (reads) => reads.every((n) => n === 1 || n === 2)],
  [7, 28, 896, "14.3%", (reads) => reads.every((n) => n === 1 || n === 2)],
  [8, 32, 1024, "12.5%", (reads) => reads.every((n) => n === 1)],
]

test("sector-stride: the replayed table for strides 1 to 8", () => {
  for (const [s, transactions, moved, text, readsOk] of STRIDE_TABLE) {
    const m = plain(sector.sectorStrideModel(s))
    assert.equal(m.transactions, transactions, `stride ${s} transactions`)
    assert.equal(m.bytesMoved, moved, `stride ${s} bytes moved`)
    assert.equal(m.bytesUsed, 128, `stride ${s} bytes used`)
    assert.equal(m.efficiencyText, text, `stride ${s} efficiency`)
    assert.ok(readsOk(m.reads), `stride ${s} reads per sector: ${m.reads.join(",")}`)
    assert.equal(
      m.reads.reduce((a, b) => a + b, 0),
      32,
      `stride ${s}: 32 reads`,
    )
    // The fetched set is sectors 0 to 4s - 1, so the 32-sector grid holds it.
    assert.deepEqual(m.sectors, range(4 * s), `stride ${s} fetched sectors`)
    assert.equal(m.lastSector, 4 * s - 1, `stride ${s} last sector`)
    for (const lane of m.lanes) {
      assert.equal(lane.firstSector, lane.lastSector, `stride ${s} lane ${lane.lane} spans one sector`)
      assert.equal(lane.slot, (lane.lane * s) % 8, `stride ${s} lane ${lane.lane} slot`)
    }
  }
})

test("sector-stride: the port matches coalescing-lab.tsx at elem 4, offset 0, strides 1 to 32", () => {
  for (let s = 1; s <= 32; s++) {
    const m = plain(sector.sectorStrideModel(s))
    const course = courseCoalescing(s, 0, 4)
    assert.deepEqual(m.sectors, course.sectors, `stride ${s} sectors`)
    assert.equal(m.bytesMoved, course.bytesMoved, `stride ${s} bytes moved`)
    assert.equal(m.bytesUsed, course.bytesUsed, `stride ${s} bytes used`)
    assert.equal(m.efficiencyText, course.text, `stride ${s} efficiency`)
  }
})

test("sector-stride: geometry matches the spec's worked values", () => {
  const wide665 = plain(sector.sectorStrideGeometry(665, false, {}))
  close(wide665.cw, 73.88, 0.005, "cw at 665")
  close(wide665.slot, 9.23, 0.005, "slot at 665")
  assert.equal(wide665.height, 198)
  const wide560 = plain(sector.sectorStrideGeometry(560, false, {}))
  close(wide560.cw, 60.75, 0.005, "cw at 560")
  close(wide560.slot, 7.59, 0.005, "slot at 560")
  close(plain(sector.sectorStrideGeometry(425, true, {})).cw, 93.75, 0.005, "cw at 425")
  const phone = plain(sector.sectorStrideGeometry(375, true, {}))
  close(phone.cw, 81.25, 0.005, "cw at 375")
  close(phone.slot, 10.16, 0.005, "slot at 375")
  assert.equal(phone.height, 288)
})

/* ---------- bank-map ---------- */

test("bank-map: the widget file registers bank-map in node:vm", () => {
  assert.deepEqual(bank.widgets, ["bank-map"])
})

// W: worst, banks used, bank of lane t, level of lane t.
const WIDTH_TABLE = [
  [32, 32, 1, () => 0, (t) => t],
  [33, 1, 32, (t) => t, () => 0],
  [34, 2, 16, (t) => (2 * t) % 32, (t) => Math.floor(t / 16)],
  [35, 1, 32, (t) => (3 * t) % 32, () => 0],
  [36, 4, 8, (t) => (4 * t) % 32, (t) => Math.floor(t / 8)],
]

test("bank-map: [32][32] is a 32-way conflict on bank 0 and [32][33] has none", () => {
  const before = plain(bank.bankMapModel("column", 32))
  assert.equal(before.worst, 32)
  assert.equal(before.banksUsed, 1)
  assert.equal(before.conflictBank, 0)
  const after = plain(bank.bankMapModel("column", 33))
  assert.equal(after.worst, 1)
  assert.equal(after.banksUsed, 32)
  assert.equal(after.conflictBank, -1)
})

test("bank-map: the replayed table for column reads at row widths 32 to 36", () => {
  for (const [w, worst, used, bankOf, levelOf] of WIDTH_TABLE) {
    const m = plain(bank.bankMapModel("column", w))
    assert.equal(m.worst, worst, `row width ${w} worst`)
    assert.equal(m.banksUsed, used, `row width ${w} banks used`)
    assert.deepEqual(m.banks, range(32).map(bankOf), `row width ${w} banks`)
    assert.deepEqual(m.levels, range(32).map(levelOf), `row width ${w} levels`)
    assert.equal(m.conflictBank, worst > 1 ? 0 : -1, `row width ${w} conflict bank`)
  }
})

test("bank-map: XOR swizzle lands like [32][33]; a same-address read is one broadcast", () => {
  const swizzle = plain(bank.bankMapModel("swizzle", 32))
  assert.equal(swizzle.worst, 1)
  assert.equal(swizzle.banksUsed, 32)
  assert.deepEqual(swizzle.banks, plain(bank.bankMapModel("column", 33)).banks)
  assert.deepEqual(swizzle.words, range(32).map((t) => 33 * t))

  const same = plain(bank.bankMapModel("same", 32))
  assert.equal(same.worst, 1)
  assert.equal(same.banksUsed, 1)
  assert.equal(new Set(same.words).size, 1)
  assert.deepEqual(same.banks, Array(32).fill(0))
  assert.deepEqual(same.levels, Array(32).fill(0))
  assert.deepEqual(same.multiplicity, Array(32).fill(32))
  assert.equal(same.conflictBank, -1)
})

test("bank-map: the port matches bank-conflict-lab.tsx for tile columns 32", () => {
  const cases = [
    ...[0, 1, 2, 3, 4].map((pad) => [["column", 32 + pad], ["column", 2, 32, pad]]),
    [["swizzle", 32], ["swizzle", 2, 32, 0]],
    [["same", 32], ["broadcast", 2, 32, 0]],
  ]
  for (const [[pattern, width], [coursePattern, stride, tileCols, pad]] of cases) {
    const m = plain(bank.bankMapModel(pattern, width))
    const course = courseBankConflict(coursePattern, stride, tileCols, pad)
    assert.equal(m.worst, course.worst, `${pattern} ${width} worst`)
    assert.equal(m.banksUsed, course.usedBanks, `${pattern} ${width} banks used`)
    assert.deepEqual(
      m.banks,
      course.lanes.map((lane) => lane.bank),
      `${pattern} ${width} banks`,
    )
    assert.deepEqual(
      m.words,
      course.lanes.map((lane) => lane.word),
      `${pattern} ${width} words`,
    )
  }
})

test("bank-map: geometry matches the spec's worked values", () => {
  const wide665 = plain(bank.bankMapGeometry(665, false, {}))
  close(wide665.p, 19.78, 0.005, "pitch at 665")
  close(wide665.bw, 17.78, 0.005, "brick width at 665")
  assert.equal(wide665.height, 294)
  close(plain(bank.bankMapGeometry(560, false, {})).p, 16.5, 0.005, "pitch at 560")
  close(plain(bank.bankMapGeometry(425, true, {})).p, 12.28, 0.005, "pitch at 425")
  const phone = plain(bank.bankMapGeometry(375, true, {}))
  close(phone.p, 10.72, 0.005, "pitch at 375")
  close(phone.bw, 8.72, 0.005, "brick width at 375")
  assert.equal(phone.height, 262)
})
