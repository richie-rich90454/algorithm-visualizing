/**
 * snapshot-isolation.test.ts - Independent first-committer-wins reference,
 * conflict invariants, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./snapshot-isolation";
import type { VisualFrame } from "@/types";

interface Transaction {
    id: string;
    start: number;
    commit: number;
    writes: Record<string, number>;
    reads?: string[];
}

function checkFrames(frames: VisualFrame[], keys: number): void {
    expect(frames.length).toBeGreaterThan(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(keys);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

interface Result {
    values: Record<string, number>;
    committed: string[];
    aborted: string[];
}

function reference(txns: Transaction[], initial: Record<string, number>): Result {
    const ordered = [...txns].sort((a, b) => a.commit - b.commit);
    const values = { ...initial };
    const committed: string[] = [];
    const aborted: string[] = [];
    for (const txn of ordered) {
        const conflict = committed.some((id) => {
            const other = ordered.find((t) => t.id === id)!;
            return (
                other.commit > txn.start &&
                other.commit < txn.commit &&
                Object.keys(txn.writes).some((k) => Object.prototype.hasOwnProperty.call(other.writes, k))
            );
        });
        if (conflict) {
            aborted.push(txn.id);
        } else {
            for (const k of Object.keys(txn.writes)) {
                values[k] = txn.writes[k]!;
            }
            committed.push(txn.id);
        }
    }
    return { values, committed, aborted };
}

function result(frames: VisualFrame[]): Result {
    const last = frames[frames.length - 1]?.meta;
    const keys = last?.["keys"] as string[];
    const vals = last?.["values"] as number[];
    return {
        values: Object.fromEntries(keys.map((k, i) => [k, vals[i]!])),
        committed: last?.["committed"] as string[],
        aborted: last?.["aborted"] as string[],
    };
}

describe("snapshot isolation", () => {
    const cases: Array<{ initial: Record<string, number>; transactions: Transaction[] }> = [
        {
            initial: { X: 0, Y: 0 },
            transactions: [
                { id: "T1", start: 1, commit: 2, writes: { X: 10 } },
                { id: "T2", start: 1, commit: 3, writes: { X: 20 } },
                { id: "T3", start: 4, commit: 5, writes: { Y: 5 } },
            ],
        },
        {
            initial: { A: 0, B: 0, C: 0 },
            transactions: [
                { id: "A", start: 1, commit: 2, writes: { A: 1, B: 2 } },
                { id: "B", start: 3, commit: 4, writes: { B: 9 } },
                { id: "C", start: 3, commit: 5, writes: { C: 7 } },
                { id: "D", start: 2, commit: 6, writes: { A: 8, C: 8 } },
            ],
        },
        {
            initial: { K: 0 },
            transactions: [
                { id: "S1", start: 1, commit: 2, writes: { K: 1 } },
                { id: "S2", start: 3, commit: 4, writes: { K: 2 } },
            ],
        },
    ];

    it("matches an independent first-committer-wins reference", () => {
        for (const c of cases) {
            const frames = [...mod.run(c)];
            checkFrames(frames, Object.keys(c.initial).length);
            expect(result(frames)).toEqual(reference(c.transactions, c.initial));
        }
    });

    it("prevents two overlapping writers of the same key from both committing", () => {
        const frames = [...mod.run(cases[0])];
        const r = result(frames);
        expect(r.aborted).toContain("T2");
        expect(r.committed).toEqual(["T1", "T3"]);
        expect(r.values).toEqual({ X: 10, Y: 5 });
    });

    it("allows disjoint writers in the same snapshot window to commit", () => {
        const frames = [...mod.run(cases[1])];
        const r = result(frames);
        // B starts at 3, after A committed at 2, so it sees no overlapping later commit.
        // C writes a disjoint key and commits. D overlaps C on key C after D's start, so D aborts.
        expect(r.aborted).toContain("D");
        expect(r.committed).toContain("B");
        expect(r.committed).toContain("C");
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
