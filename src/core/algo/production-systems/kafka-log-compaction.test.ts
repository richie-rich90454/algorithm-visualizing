/**
 * kafka-log-compaction.test.ts - Independent compaction reference, replay
 * equivalence, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./kafka-log-compaction";
import type { VisualFrame } from "@/types";

interface RecordEntry {
    offset: number;
    key: string;
    value: number | null;
}

function checkFrames(frames: VisualFrame[], count: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(count);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function reference(records: RecordEntry[]): Array<[string, number]> {
    const ordered = [...records].sort((a, b) => a.offset - b.offset);
    const lastIndex = new Map<string, number>();
    ordered.forEach((r, i) => lastIndex.set(r.key, i));
    const out: Array<[string, number]> = [];
    ordered.forEach((r, i) => {
        if (r.value !== null && lastIndex.get(r.key) === i) {
            out.push([r.key, r.value]);
        }
    });
    return out;
}

function replay(records: Array<[string, number]>): Record<string, number> {
    const state: Record<string, number> = {};
    for (const [key, value] of records) {
        state[key] = value;
    }
    return state;
}

function compacted(frames: VisualFrame[]): Array<[string, number]> {
    const last = frames[frames.length - 1]?.meta;
    const keys = last?.["compactedKeys"] as string[];
    const values = last?.["compactedValues"] as number[];
    return keys.map((key, i) => [key, values[i]!]);
}

describe("Kafka log compaction", () => {
    const cases: RecordEntry[][] = [
        [
            { offset: 1, key: "k1", value: 10 },
            { offset: 2, key: "k2", value: 20 },
            { offset: 3, key: "k1", value: 30 },
            { offset: 4, key: "k3", value: 5 },
            { offset: 5, key: "k2", value: null },
        ],
        [
            { offset: 1, key: "a", value: 1 },
            { offset: 2, key: "a", value: 2 },
            { offset: 3, key: "a", value: 3 },
        ],
        [
            { offset: 1, key: "x", value: 7 },
            { offset: 2, key: "y", value: 8 },
            { offset: 3, key: "x", value: null },
        ],
        [
            { offset: 1, key: "m", value: 4 },
            { offset: 2, key: "n", value: 5 },
        ],
    ];

    it("matches an independent compaction reference", () => {
        for (const records of cases) {
            const frames = [...mod.run({ records })];
            checkFrames(frames, records.length);
            expect(compacted(frames)).toEqual(reference(records));
        }
    });

    it("preserves the final state of a full replay", () => {
        for (const records of cases) {
            const frames = [...mod.run({ records })];
            const full: Record<string, number> = {};
            for (const r of [...records].sort((a, b) => a.offset - b.offset)) {
                if (r.value === null) {
                    delete full[r.key];
                } else {
                    full[r.key] = r.value;
                }
            }
            expect(replay(compacted(frames))).toEqual(full);
        }
    });

    it("removes tombstoned keys and keeps the newest duplicate", () => {
        const frames = [...mod.run({ records: cases[0] })];
        expect(compacted(frames)).toEqual([
            ["k1", 30],
            ["k3", 5],
        ]);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["keptOffsets"]).toEqual([3, 4]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(3);
        expect(generator.next().done).toBe(true);
    });
});
