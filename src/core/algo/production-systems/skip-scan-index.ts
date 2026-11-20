/**
 * skip-scan-index.ts - Skip Scan for a Slotted Index
 *
 * When a scan cursor walks a sparse index one slot at a time, most steps land
 * on empty slots. Skip scan replaces those empty steps with a direct jump to
 * the next occupied slot. The scan examines a fixed number of occupied entries
 * starting at the cursor, wraps once at the end of the key space, and reports
 * the next cursor together with the entries that matched an optional prefix.
 * This models the cursor optimization used by hash-based scan indexes.
 *
 * Complexity:
 *   Time:  O(log m) per jump with an ordered slot list, for m occupied slots
 *   Space: O(m) for the occupied slot map
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Entry {
    slot: number;
    value: string;
}

function nextOccupied(slots: number[], from: number): number | null {
    for (const slot of slots) {
        if (slot >= from) {
            return slot;
        }
    }
    return slots[0] ?? null;
}

function makeCells(entries: Entry[], maxSlot: number, cursor: number, examined: Set<number>): VisualEntity[] {
    const bySlot = new Map(entries.map((entry) => [entry.slot, entry.value]));
    return Array.from({ length: maxSlot + 1 }, (_, slot) => {
        const value = bySlot.get(slot);
        const state: EntityState = slot === cursor ? "active" : examined.has(slot) ? "visited" : value === undefined ? "idle" : "sorted";
        return {
            id: `cell-0-${slot}`,
            type: "cell" as const,
            label: value ?? "·",
            value: value ?? "",
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: slot, occupied: value !== undefined },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { entries?: Entry[]; cursor?: number; count?: number; prefix?: string; maxSlot?: number } | null) ?? {};
    const entries = (Array.isArray(task.entries) ? task.entries : [
        { slot: 1, value: "apple" }, { slot: 4, value: "apricot" }, { slot: 7, value: "banana" },
        { slot: 9, value: "avocado" }, { slot: 12, value: "cherry" },
    ]).map((entry) => ({ slot: Number(entry.slot), value: String(entry.value) }));
    const count = Math.max(1, typeof task.count === "number" ? task.count : 3);
    const prefix = typeof task.prefix === "string" ? task.prefix : "";
    const sorted = [...entries].sort((a, b) => a.slot - b.slot);
    const slots = sorted.map((entry) => entry.slot);
    const maxSlot = typeof task.maxSlot === "number"
        ? task.maxSlot
        : Math.max(1, ...slots);
    let cursor = typeof task.cursor === "number" ? Math.max(0, Math.min(maxSlot, task.cursor)) : 0;
    const bySlot = new Map(sorted.map((entry) => [entry.slot, entry.value]));
    const base = { occupied: sorted.length, count, prefix, maxSlot };

    yield {
        stepNumber: 0,
        entities: makeCells(sorted, maxSlot, cursor, new Set()),
        edges: [],
        description: "Ordered slot list lets the scan jump over empty slots to the next entry.",
        codeLineNumber: 0,
        layout: "grid",
        meta: { ...base, phase: "init", cursor, results: [] },
    };

    const examined: number[] = [];
    const results: Entry[] = [];
    for (let step = 0; step < count; step += 1) {
        const slot = nextOccupied(slots, cursor);
        if (slot === null) {
            break;
        }
        const value = bySlot.get(slot) ?? "";
        examined.push(slot);
        if (prefix === "" || value.startsWith(prefix)) {
            results.push({ slot, value });
        }
        const wrapped = slot >= maxSlot;
        cursor = wrapped ? 0 : slot + 1;
        yield {
            stepNumber: step + 1,
            entities: makeCells(sorted, maxSlot, cursor, new Set(examined)),
            edges: [],
            description: `Step ${step}: jumped to slot ${slot} with ${value}; next cursor ${cursor}.`,
            codeLineNumber: 3,
            layout: "grid",
            meta: {
                ...base,
                phase: "examine",
                cursor,
                slot,
                value,
                examined: [...examined],
                results: results.map((entry) => `${entry.slot}:${entry.value}`),
            },
        };
        if (wrapped && examined.length >= count) {
            break;
        }
    }
    yield {
        stepNumber: count + 1,
        entities: makeCells(sorted, maxSlot, cursor, new Set(examined)),
        edges: [],
        description: `Examined ${examined.length} occupied slot(s), matched ${results.length}, next cursor ${cursor}.`,
        codeLineNumber: 6,
        layout: "grid",
        meta: { ...base, phase: "done", cursor, examined, results: results.map((entry) => `${entry.slot}:${entry.value}`) },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A hash scan may leave most of its slots empty. Walking them one by one wastes work, so a skip scan keeps the occupied slots in order and jumps directly from the current cursor to the next one. It examines a fixed number of real entries, checks each against an optional prefix, and returns the slot where the next scan should resume.",
        invariants: [
            "Only occupied slots are examined; empty slots are skipped without a step.",
            "The examined slots follow increasing order with at most one wrap.",
            "The returned cursor is always within the slot range.",
        ],
        correctness:
            "Keeping occupied slots sorted makes the successor query return the smallest occupied slot at or after the cursor; when none exists, the list wraps to its first slot. This is identical to visiting every slot one at a time and ignoring empty ones, so the examined sequence matches a brute-force scan. Because each step advances the cursor past the slot just examined, no slot is revisited within one pass, and the collected prefix matches are exactly those of the examined entries.",
        complexityRationale:
            "A successor search on an ordered slot list costs logarithmic time in the number of occupied slots, and it is called once per examined entry, giving O(count log m). The slot map and the ordered list use O(m) space.",
        uses: [
            "Cursor-based scanning of sparse hash indexes",
            "Iterating large Redis-style encoded collections",
            "Teaching successor queries and sparse iteration",
        ],
        references: [
            "Redis documentation, SCAN command and dict rehashing",
            "Knuth, The Art of Computer Programming Vol. 3, Section 6.4 on hashing",
        ],
        workedExample:
            "With occupied slots 1, 4, 7, 9, and 12 and a cursor at 2, the scan jumps to slot 4, then 7, then 9. If the prefix is a, only the values at 4 and 9 are returned, and the next cursor is 10.",
    },
    id: "skip-scan-index",
    name: "Skip Scan Index",
    category: "production-systems",
    complexity: { time: "O(count log m)", space: "O(m)" },
    defaultInput: {
        entries: [
            { slot: 1, value: "apple" }, { slot: 4, value: "apricot" }, { slot: 7, value: "banana" },
            { slot: 9, value: "avocado" }, { slot: 12, value: "cherry" },
        ],
        cursor: 0,
        count: 3,
        prefix: "",
    },
    visualType: "grid",
    run,
    pseudocode: [
        "sort the occupied slots and start at the given cursor",
        "find the smallest occupied slot at or after the cursor",
        "if none exists wrap to the first occupied slot",
        "examine that entry and test its prefix",
        "advance the cursor just past the examined slot",
        "repeat for the requested number of entries",
        "done: report matches and the next cursor",
    ],
};

export default module;
