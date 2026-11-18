/**
 * quadratic-probing.ts - Hash Table with Quadratic Probing
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Quadratic probing is an open-addressing collision scheme whose k-th probe is
 * home + k^2 modulo the table size, rather than home + k for linear probing.
 * The widening jumps scatter colliding keys away from their home slot, which
 * removes the primary clustering that slows linear probing. With a prime table
 * kept below half full, the sequence is guaranteed to reach a free slot.
 * Lookups follow the same sequence and stop at the first empty cell.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Insert / lookup: O(1) average, O(m) worst case for a table of m slots
 *   Space:           O(m) for the single slot array
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Cells are the slots of the hash table, labeled with their key.
 *   - The slot currently probed is BLUE (comparing); filled slots end GREEN.
 *   - An empty slot reached during lookup ends the search.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Polynomial rolling hash reduced modulo the table size. */
export function hashKey(key: string, size: number): number {
  let hash = 0;
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) % size;
  return hash;
}

/** The k-th quadratic probe position for a home slot. */
export function probeSlot(home: number, k: number, size: number): number {
  return (home + k * k) % size;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
  const task = (input as { keys?: string[]; size?: number; probe?: string } | null) ?? {};
  const keys = task.keys ?? ["cat", "car", "dog", "cow", "bat"];
  const size = typeof task.size === "number" && task.size >= 4 ? task.size : 11;
  const probe = task.probe ?? "dog";

  const table: Array<string | null> = new Array<string | null>(size).fill(null);

  const makeCells = (active: number): VisualEntity[] =>
    table.map((value, i) => ({
      id: `cell-${i}`,
      type: "cell" as const,
      label: value ?? "·",
      value: value ?? "",
      state:
        i === active
          ? ("comparing" as EntityState)
          : value !== null
            ? ("sorted" as EntityState)
            : ("unvisited" as EntityState),
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      metadata: { row: 0, col: i },
    }));

  let index = 0;
  yield {
    stepNumber: index,
    entities: makeCells(-1),
    edges: [],
    description: `Empty table of ${size} slots; insert ${keys.length} keys with quadratic probing before looking up "${probe}".`,
    codeLineNumber: 0,
    layout: "grid",
    meta: { size, keys: keys.length, probe },
  };
  index += 1;

  for (const key of keys) {
    const home = hashKey(key, size);
    let placed = -1;
    for (let k = 0; k < size; k += 1) {
      const slot = probeSlot(home, k, size);
      const taken = table[slot] !== null;
      yield {
        stepNumber: index,
        entities: makeCells(slot),
        edges: [],
        description: `Inserting "${key}": home ${home}, probe ${k} checks slot ${slot}, which is ${taken ? "occupied" : "free"}.`,
        codeLineNumber: taken ? 2 : 3,
        layout: "grid",
        meta: { phase: "insert", key, home, k, slot, occupied: taken },
      };
      index += 1;
      if (!taken) {
        table[slot] = key;
        placed = slot;
        break;
      }
    }
    if (placed < 0) {
      yield {
        stepNumber: index,
        entities: makeCells(-1),
        edges: [],
        description: `Inserting "${key}" failed: every slot was visited before a free one was found.`,
        codeLineNumber: 4,
        layout: "grid",
        meta: { phase: "insert", key, home, placed: false },
      };
      index += 1;
    }
  }

  const home = hashKey(probe, size);
  let found = false;
  let probes = 0;
  let endedAt = -1;
  for (let k = 0; k < size; k += 1) {
    const slot = probeSlot(home, k, size);
    probes += 1;
    const value = table[slot];
    yield {
      stepNumber: index,
      entities: makeCells(slot),
      edges: [],
      description: `Lookup "${probe}": probe ${k} checks slot ${slot}, holding ${value === null || value === undefined ? "an empty slot" : '"' + value + '"'}.`,
      codeLineNumber: 6,
      layout: "grid",
      meta: { phase: "lookup", key: probe, home, k, slot, value: value ?? "", found: value === probe },
    };
    index += 1;
    if (value === probe) {
      found = true;
      endedAt = slot;
      break;
    }
    if (value === null || value === undefined) {
      endedAt = slot;
      break;
    }
  }

  yield {
    stepNumber: index,
    entities: makeCells(-1),
    edges: [],
    description: `"${probe}" ${found ? "found in slot " + endedAt : "not found"} after ${probes} probe(s) in a ${size}-slot table.`,
    codeLineNumber: 6,
    layout: "grid",
    meta: { found, probes, size, table: table.map((v) => v ?? ""), loadFactor: keys.length / size },
  };
}

const module: AlgorithmModule = {
  education: {
    intuition:
      "Open addressing keeps every key inside the table itself. Linear probing walks to the next slot after a collision, which builds long runs of occupied cells. Quadratic probing jumps by one, then four, then nine slots from the home position, so colliding keys spread out instead of piling up. The search for a key walks the very same sequence and stops as soon as it meets an empty slot.",
    invariants: [
      "Every key is stored on its own quadratic probe sequence starting at its home slot.",
      "The k-th probe of a home slot h is (h + k squared) modulo the table size.",
      "A lookup terminates at the first empty slot because no later probe would have been chosen on insertion.",
    ],
    correctness:
      "Insertion places a key in the first free slot of its probe sequence, and lookup replays that exact sequence, so an inserted key is always found. If an empty slot is reached first, the key cannot appear later on the sequence because insertion would have stopped there too. For a prime table kept below half full, the quadratic sequence visits at least half of all slots, guaranteeing that a free slot exists.",
    complexityRationale:
      "Computing a home slot depends on key length, and each probe does constant work, so an operation is O(key length + probes), which is O(1) expected when the load factor is low and O(m) in the worst case. Only the slot array of size m is stored, giving O(m) space.",
    uses: [
      "Compiler symbol tables with cache-friendly storage",
      "Language runtime dictionaries that avoid pointer chasing",
      "Embedded hash maps where separate chains are too costly",
    ],
    references: [
      "Donald Knuth, The Art of Computer Programming, Volume 3, Section 6.4",
      "Cormen, Leiserson, Rivest, and Stein, Introduction to Algorithms, Chapter 11",
    ],
    workedExample:
      "With eleven slots, the key cat hashes to home 3. Its probe sequence is 3, 4, 7, 1 and so on because each step adds the next odd number. If slot 3 is taken, cat goes to slot 4. Looking up cat checks 3, finds it occupied by another key, checks 4, and stops on a match.",
  },
  id: "quadratic-probing",
  name: "Quadratic Probing",
  category: "searching",
  complexity: { time: "O(1) average", space: "O(m)" },
  defaultInput: { keys: ["cat", "car", "dog", "cow", "bat"], size: 11, probe: "dog" },
  visualType: "grid",
  run,
  pseudocode: [
    "start with an empty table of prime size m",
    "for each key compute home = hash(key) modulo m",
    "probe slot (home + k*k) modulo m for k = 0, 1, 2, ...",
    "place the key in the first empty slot on that sequence",
    "to look up a key replay the same probe sequence",
    "stop on a matching key or on the first empty slot",
    "done: report whether the key was found and the probe count",
  ],
};

export default module;
