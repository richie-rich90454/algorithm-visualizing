/**
 * write-back-cache.ts - Write-Back Cache with Write Allocate
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A write-back cache postpones memory traffic: a write updates only the cached
 * copy and marks its line dirty, so repeated writes to the same address touch
 * memory once instead of every time. Memory is updated when a dirty line is
 * evicted or when the cache is explicitly flushed. A miss uses write allocate,
 * loading the line from memory before the write. This trades extra complexity
 * in the eviction path for far fewer memory writes than write-through caching.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(1) average per operation with a direct-mapped index
 *   Space: O(capacity + addresses) for the cache and the memory snapshot
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Row zero holds cache lines; a trailing star marks a dirty line.
 *   - Row one holds main memory values, which change only on write-back.
 *   - The line touched by the current operation is BLUE (comparing).
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Op = { op: "read" | "write" | "flush"; addr?: number; value?: number };
type Line = { addr: number; value: number; dirty: boolean; valid: boolean };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as {
    capacity?: number;
    initialMemory?: Array<[number, number]>;
    ops?: Op[];
  } | null) ?? {};
  const capacity = typeof task.capacity === "number" ? Math.max(1, Math.min(16, task.capacity | 0)) : 4;
  const initial: Array<[number, number]> = task.initialMemory ?? [
    [0, 10],
    [1, 11],
    [2, 12],
    [3, 13],
    [4, 14],
    [5, 15],
    [6, 16],
    [7, 17],
  ];
  const ops: Op[] = task.ops ?? [
    { op: "write", addr: 0, value: 100 },
    { op: "read", addr: 0 },
    { op: "write", addr: 4, value: 200 },
    { op: "read", addr: 4 },
    { op: "write", addr: 1, value: 111 },
    { op: "write", addr: 5, value: 222 },
    { op: "flush" },
    { op: "read", addr: 0 },
  ];

  const memory = new Map<number, number>(initial.map(([addr, value]): [number, number] => [addr, value]));
  const cache: Line[] = Array.from({ length: capacity }, () => ({
    addr: -1,
    value: 0,
    dirty: false,
    valid: false,
  }));
  const addresses = [...new Set([...memory.keys(), ...ops.map((o) => o.addr ?? -1)])]
    .filter((a) => a >= 0)
    .sort((a, b) => a - b);

  let hits = 0;
  let misses = 0;
  let writebacks = 0;
  let memoryWrites = 0;
  const writeLog: number[] = [];

  const makeEntities = (active: number): VisualEntity[] => {
    const entities: VisualEntity[] = cache.map((line, i) => ({
      id: `cache-${i}`,
      type: "cell" as const,
      label: line.valid ? `${line.addr}:${line.value}${line.dirty ? "*" : ""}` : "empty",
      value: line.valid ? line.value : -1,
      state: i === active ? "comparing" : line.dirty ? "active" : line.valid ? "sorted" : "unvisited",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { row: 0, col: i, addr: line.addr, dirty: line.dirty },
    }));
    addresses.forEach((addr, col) => {
      entities.push({
        id: `mem-${addr}`,
        type: "cell" as const,
        label: String(memory.get(addr) ?? 0),
        value: memory.get(addr) ?? 0,
        state: "unvisited",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 1, col, addr },
      });
    });
    return entities;
  };

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeEntities(-1),
    edges: [],
    description: `Direct-mapped cache with ${capacity} lines and write allocate; main memory holds ${addresses.length} addresses.`,
    codeLineNumber: 0,
    layout: "grid",
    meta: { capacity, addresses },
  };
  index += 1;

  for (const op of ops) {
    let active = -1;
    let hit = false;
    let evicted = -1;
    let didWriteBack = false;
    const addr = op.addr ?? -1;

    if (op.op === "flush") {
      for (let i = 0; i < capacity; i += 1) {
        const line = cache[i] as Line;
        if (line.valid && line.dirty) {
          memory.set(line.addr, line.value);
          writebacks += 1;
          memoryWrites += 1;
          didWriteBack = true;
          line.dirty = false;
        }
      }
      yield {
        stepNumber: index,
        entities: makeEntities(-1),
        edges: [],
        description: `Flush: wrote back every dirty line; ${writebacks} total write-backs so far.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { op: "flush", hit: false, evicted: -1, writeback: didWriteBack, hits, misses, writebacks, memoryWrites },
      };
      index += 1;
      continue;
    }

    active = addr % capacity;
    const line = cache[active] as Line;
    hit = line.valid && line.addr === addr;
    if (hit) {
      hits += 1;
    } else {
      misses += 1;
      if (line.valid && line.dirty) {
        memory.set(line.addr, line.value);
        writebacks += 1;
        memoryWrites += 1;
        didWriteBack = true;
        evicted = line.addr;
      }
      const loaded = memory.get(addr) ?? 0;
      cache[active] = { addr, value: loaded, dirty: false, valid: true };
    }
    if (op.op === "write") {
      const current = cache[active] as Line;
      current.value = op.value ?? 0;
      current.dirty = true;
      writeLog.push(addr);
    }
    const current = cache[active] as Line;
    yield {
      stepNumber: index,
      entities: makeEntities(active),
      edges: [],
      description: `${op.op.toUpperCase()} address ${addr}: ${hit ? "cache hit" : "cache miss"}${evicted >= 0 ? ", wrote back dirty address " + evicted : ""}${op.op === "write" ? ", cached copy marked dirty" : ""}; line ${active} now holds ${current.value}.`,
      codeLineNumber: hit ? 1 : op.op === "write" ? 3 : 2,
      layout: "grid",
      meta: { op: op.op, addr, hit, evicted, writeback: didWriteBack, hits, misses, writebacks, memoryWrites },
    };
    index += 1;
  }

  yield {
    stepNumber: index,
    entities: makeEntities(-1),
    edges: [],
    description: `Done: ${hits} hits, ${misses} misses, ${writebacks} write-backs after ${writeLog.length} writes; flushed memory matches the writes.`,
    codeLineNumber: 6,
    layout: "grid",
    meta: {
      hits,
      misses,
      writebacks,
      memoryWrites,
      writes: writeLog.length,
      addresses,
      memory: addresses.map((a) => memory.get(a) ?? 0),
    },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Writing every store straight to main memory wastes bandwidth when a program updates the same location repeatedly. A write-back cache changes only the cached copy and records a dirty bit. Memory catches up when that line is evicted or the cache is flushed. Because each dirty line produces at most one memory write between flushes, write-back systems are much faster for write-heavy workloads, at the cost of a more complex coherence protocol.",
    invariants: [
      "A write to a cached line never modifies main memory until the line is written back.",
      "A line is dirty exactly when its cached value differs from memory.",
      "After a full flush with no further writes, memory agrees with every completed write.",
    ],
    correctness:
      "On a hit the cached copy is the most recent value, so updating it preserves program semantics. On a miss the line is loaded from memory before the write, so unrelated bytes in the block are not lost. Evicting a dirty line writes its value back before reuse, and flushing writes back all remaining dirty lines. Therefore the final memory state equals the state obtained by applying every write directly, regardless of hit pattern.",
    complexityRationale:
      "A direct-mapped index is a modulo operation, so each hit, miss, and write-back handles a constant number of lines and takes O(1) time. Flushing scans the capacity once, O(capacity). Storage is one line per cache slot plus the memory snapshot, O(capacity + addresses).",
    uses: [
      "CPU L1 and L2 data caches",
      "Filesystem page caches and delayed writes",
      "Database buffer pools with dirty-page flushing",
    ],
    references: [
      "Hennessy and Patterson, Computer Architecture: A Quantitative Approach, Chapter 2",
      "Smith, Cache Memories, ACM Computing Surveys, 1982",
    ],
    workedExample:
      "With four one-word lines, writing address 0 misses and marks line 0 dirty. Reading address 0 hits without touching memory. Writing address 4 misses on the same line, writes 0 back to memory, and loads address 4. A later flush writes address 4 back, so memory ends with both original writes applied even though only two memory writes occurred.",
  },
  id: "write-back-cache",
  name: "Write-Back Cache",
  category: "production-systems",
  complexity: { time: "O(1) per operation", space: "O(capacity + addresses)" },
  defaultInput: {
    capacity: 4,
    initialMemory: [
      [0, 10],
      [1, 11],
      [2, 12],
      [3, 13],
      [4, 14],
      [5, 15],
      [6, 16],
      [7, 17],
    ],
    ops: [
      { op: "write", addr: 0, value: 100 },
      { op: "write", addr: 0, value: 101 },
      { op: "read", addr: 0 },
      { op: "write", addr: 4, value: 200 },
      { op: "read", addr: 4 },
      { op: "write", addr: 1, value: 111 },
      { op: "write", addr: 5, value: 222 },
      { op: "flush" },
      { op: "read", addr: 0 },
    ],
  },
  visualType: "grid",
  run,
  pseudocode: [
    "initialize memory and an empty direct-mapped cache",
    "on a read or write compute the line index addr mod capacity",
    "on a miss write back a dirty resident line, then load from memory",
    "on a write update the cached value and set the dirty bit",
    "on a flush write back every dirty line and clear its bit",
    "count hits, misses, and memory writes as operations proceed",
    "done: memory reflects all writes with minimal memory traffic",
  ],
};

export default module;
