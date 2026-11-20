/**
 * leveled-compaction.ts - Leveled LSM Compaction
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A log-structured store appends each write to a small sorted table. Leveled
 * compaction keeps at most a fixed number of tables per level: when a level
 * overflows, its tables are merged with the overlapping tables in the next
 * level. Duplicate keys are resolved by sequence number so the newest write
 * wins, and the merged result is split into disjoint sorted tables. Reads stay
 * cheap because each level covers a distinct key range.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 *   Time:  O(w log w) merges over w writes (each key is rewritten per level)
 *   Space: O(w) for the tables
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 *   - One bar per live key; height is the value and the label shows its level.
 *   - Bars most recently merged are green, older bars are idle.
 *   - meta carries the key list, values, levels, and file count per level.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

export interface Entry {
    key: number;
    value: number;
    seq: number;
}

export interface SFile {
    entries: Entry[];
    lo: number;
    hi: number;
}

export type Levels = SFile[][];

/** Build a sorted table, keeping only the newest entry for each key. */
export function makeFile(entries: Entry[]): SFile {
    const byKey = new Map<number, Entry>();
    for (const entry of entries) {
        const existing = byKey.get(entry.key);
        if (!existing || entry.seq > existing.seq) byKey.set(entry.key, entry);
    }
    const sorted = [...byKey.values()].sort((a, b) => a.key - b.key);
    return {
        entries: sorted,
        lo: sorted[0]?.key ?? 0,
        hi: sorted[sorted.length - 1]?.key ?? 0,
    };
}

/** Merge several tables into one, resolving duplicate keys by sequence number. */
export function mergeFiles(files: SFile[]): SFile {
    return makeFile(files.flatMap((file) => file.entries));
}

/** Split a table into consecutive tables with at most fileSize keys each. */
export function splitFile(file: SFile, fileSize: number): SFile[] {
    const size = Math.max(1, Math.floor(fileSize));
    const result: SFile[] = [];
    for (let i = 0; i < file.entries.length; i += size) {
        result.push(makeFile(file.entries.slice(i, i + size)));
    }
    return result;
}

function overlaps(a: SFile, lo: number, hi: number): boolean {
    return a.lo <= hi && a.hi >= lo;
}

/** Compact one overflowing level, then recurse into the level above it. */
export function compactLevel(levels: Levels, index: number, threshold: number, fileSize: number): Levels {
    const next: Levels = levels.map((level) => level.slice());
    if (index >= next.length) return next;
    const files = next[index] ?? [];
    if (files.length <= threshold) {
        return index < next.length - 1 ? compactLevel(next, index + 1, threshold, fileSize) : next;
    }
    const isLast = index === next.length - 1;
    const lo = Math.min(...files.map((f) => f.lo));
    const hi = Math.max(...files.map((f) => f.hi));
    const above = isLast ? [] : (next[index + 1] ?? []);
    const selected = above.filter((f) => overlaps(f, lo, hi));
    let rangeLo = lo;
    let rangeHi = hi;
    for (const file of selected) {
        rangeLo = Math.min(rangeLo, file.lo);
        rangeHi = Math.max(rangeHi, file.hi);
    }
    let expanded = true;
    while (expanded) {
        expanded = false;
        for (const file of above) {
            if (!selected.includes(file) && overlaps(file, rangeLo, rangeHi)) {
                selected.push(file);
                rangeLo = Math.min(rangeLo, file.lo);
                rangeHi = Math.max(rangeHi, file.hi);
                expanded = true;
            }
        }
    }
    const kept = above.filter((f) => !selected.includes(f));
    const merged = mergeFiles([...files, ...selected]);
    if (isLast) {
        next[index] = merged.entries.length > 0 ? [merged] : [];
        return next;
    }
    next[index] = [];
    next[index + 1] = [...kept, ...splitFile(merged, fileSize)].sort((a, b) => a.lo - b.lo);
    return compactLevel(next, index + 1, threshold, fileSize);
}

/** Build the level structure from a write stream. */
export function buildLevels(writes: { key: number; value: number }[], threshold: number, fileSize: number): Levels {
    let levels: Levels = [[]];
    writes.forEach((write, seq) => {
        const withSeq = levels.map((level) => level.slice());
        withSeq[0] = [...(withSeq[0] ?? []), makeFile([{ key: write.key, value: write.value, seq }])];
        levels = compactLevel(withSeq, 0, threshold, fileSize);
    });
    return levels;
}

/** Look up the newest value of a key across all levels. */
export function lookup(levels: Levels, key: number): number | undefined {
    for (const level of levels) {
        for (let i = level.length - 1; i >= 0; i -= 1) {
            const found = level[i]!.entries.find((entry) => entry.key === key);
            if (found) return found.value;
        }
    }
    return undefined;
}

/** Check the structural invariants a leveled store must maintain. */
export function checkInvariants(levels: Levels): { sorted: boolean; disjoint: boolean; unique: boolean } {
    const seen = new Set<number>();
    let sorted = true;
    let disjoint = true;
    let unique = true;
    levels.forEach((level, levelIndex) => {
        for (let i = 0; i < level.length; i += 1) {
            const file = level[i]!;
            for (let j = 1; j < file.entries.length; j += 1) {
                if (file.entries[j - 1]!.key >= file.entries[j]!.key) sorted = false;
            }
            if (levelIndex > 0 && i > 0 && level[i - 1]!.hi >= file.lo) disjoint = false;
            if (levelIndex > 0) {
                for (const entry of file.entries) {
                    if (seen.has(entry.key)) unique = false;
                    seen.add(entry.key);
                }
            }
        }
    });
    return { sorted, disjoint, unique };
}

function makeBars(levels: Levels, lastMerged: Set<number>): VisualEntity[] {
    const all: Array<{ entry: Entry; level: number }> = [];
    levels.forEach((level, index) => {
        for (const file of level) {
            for (const entry of file.entries) all.push({ entry, level: index });
        }
    });
    all.sort((a, b) => a.entry.key - b.entry.key);
    return all.map(({ entry, level }, index) => {
        let state: EntityState = "idle";
        if (lastMerged.has(entry.key)) state = "sorted";
        else if (level > 0) state = "visited";
        return {
            id: `bar-${entry.key}`,
            type: "bar" as const,
            label: `k${entry.key}:L${level}`,
            value: entry.value,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { index, key: entry.key, value: entry.value, level },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { writes?: Array<{ key: number; value: number }>; threshold?: number; fileSize?: number } | null) ?? {};
    const writes = Array.isArray(task.writes) && task.writes.length > 0
        ? task.writes.map((w) => ({ key: Math.floor(Number(w?.key) || 0), value: Math.floor(Number(w?.value) || 0) }))
        : [
            { key: 5, value: 10 }, { key: 2, value: 20 }, { key: 9, value: 30 },
            { key: 1, value: 40 }, { key: 7, value: 50 }, { key: 3, value: 60 },
            { key: 5, value: 70 }, { key: 8, value: 80 },
        ];
    const threshold = Math.max(1, Math.floor(Number(task.threshold ?? 2)) || 2);
    const fileSize = Math.max(1, Math.floor(Number(task.fileSize ?? 2)) || 2);

    let levels: Levels = [[]];
    let stepNumber = 0;

    yield {
        stepNumber: stepNumber,
        entities: [],
        edges: [],
        description: `Leveled compaction over ${writes.length} write(s), at most ${threshold} table(s) per level.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { keys: [], values: [], levels: [], fileCounts: [0] },
    };
    stepNumber += 1;

    for (let i = 0; i < writes.length; i += 1) {
        const write = writes[i]!;
        const withWrite = levels.map((level) => level.slice());
        withWrite[0] = [...(withWrite[0] ?? []), makeFile([{ key: write.key, value: write.value, seq: i }])];
        levels = compactLevel(withWrite, 0, threshold, fileSize);
        const all: Array<{ entry: Entry; level: number }> = [];
        levels.forEach((level, index) => {
            for (const file of level) for (const entry of file.entries) all.push({ entry, level: index });
        });
        all.sort((a, b) => a.entry.key - b.entry.key);
        yield {
            stepNumber: stepNumber,
            entities: makeBars(levels, new Set([write.key])),
            edges: [],
            description: `Write ${i}: key ${write.key} value ${write.value}; levels ${levels.map((l) => l.length).join("/")} table(s).`,
            codeLineNumber: 1,
            layout: "array",
            meta: {
                keys: all.map((x) => x.entry.key),
                values: all.map((x) => x.entry.value),
                levels: all.map((x) => x.level),
                fileCounts: levels.map((level) => level.length),
            },
        };
        stepNumber += 1;
    }

    const invariants = checkInvariants(levels);
    const all: Array<{ entry: Entry; level: number }> = [];
    levels.forEach((level, index) => {
        for (const file of level) for (const entry of file.entries) all.push({ entry, level: index });
    });
    all.sort((a, b) => a.entry.key - b.entry.key);
    yield {
        stepNumber: stepNumber,
        entities: makeBars(levels, new Set()),
        edges: [],
        description: `Compaction finished with ${levels.length} level(s); sorted ${invariants.sorted}, disjoint ${invariants.disjoint}, unique ${invariants.unique}.`,
        codeLineNumber: 2,
        layout: "array",
        meta: {
            keys: all.map((x) => x.entry.key),
            values: all.map((x) => x.entry.value),
            levels: all.map((x) => x.level),
            fileCounts: levels.map((level) => level.length),
            sorted: invariants.sorted ? 1 : 0,
            disjoint: invariants.disjoint ? 1 : 0,
            unique: invariants.unique ? 1 : 0,
            done: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "New writes land in small sorted tables at the top level. As soon as a level has too many tables, all of them plus whichever tables in the next level overlap their key range are merged into a fresh sorted run and split again. Because a key is kept with its newest sequence number during every merge, old versions disappear and each level covers a different slice of the key space.",
        invariants: [
            "Within a table, keys are strictly increasing.",
            "Beyond the ingest level, tables have disjoint and ordered key ranges.",
            "Beyond the ingest level a key appears in at most one table, and reads resolve newer versions first.",
        ],
        correctness:
            "Compaction merges exactly the tables whose ranges can contain a key from the overflowing level, so no relevant version is missed. Keeping the entry with the largest sequence number preserves the most recent write for every key. Splitting the merged run into consecutive chunks keeps ranges disjoint in every level beyond the ingest level, where freshly appended tables may overlap, and because every old table is replaced by the merged run, no key is duplicated in levels beyond the ingest level, where the newest file wins on a read.",
        complexityRationale:
            "Each write creates one table and may trigger merges that rewrite keys as they move down levels, so the amortized work is logarithmic in the number of writes with a constant depending on the size ratio. Storing the live tables uses space linear in the number of distinct keys.",
        uses: [
            "Storage engines such as LevelDB and RocksDB",
            "Write-optimized databases and key-value stores",
            "Teaching the difference between tiered and leveled compaction",
        ],
        references: [
            "O'Neil, Cheng, Gawlick, and O'Neil, The Log-Structured Merge-Tree, 1996",
            "Google, LevelDB Implementation and Design, 2011",
        ],
        workedExample:
            "With a threshold of two tables per level and writes to keys 5, 2, 9, the third write overflows level zero. The three one-key tables are merged into one sorted table containing keys 2, 5, and 9 and placed in level one. Rewriting key 5 later creates a new top-level table whose range overlaps that level-one table, so both are merged and the older value of 5 is discarded.",
    },
    id: "leveled-compaction",
    name: "Leveled LSM Compaction",
    category: "production-systems",
    complexity: { time: "O(w log w)", space: "O(w)" },
    defaultInput: {
        writes: [
            { key: 5, value: 10 }, { key: 2, value: 20 }, { key: 9, value: 30 },
            { key: 1, value: 40 }, { key: 7, value: 50 }, { key: 3, value: 60 },
            { key: 5, value: 70 }, { key: 8, value: 80 },
        ],
        threshold: 2,
        fileSize: 2,
    },
    visualType: "array",
    run,
    pseudocode: [
        "start with an empty level zero",
        "append each write as a one-key sorted table in level zero",
        "if a level holds more than the threshold number of tables",
        "select overlapping tables from the next level",
        "merge all selected tables keeping the newest version of each key",
        "split the merged run into sorted tables of the configured size",
        "place them in the next level and compact that level in turn",
        "done: report the live keys and the structural invariants",
    ],
};

export default module;
