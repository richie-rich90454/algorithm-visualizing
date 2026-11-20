/**
 * calvin-transaction.test.ts - Brute-force serial replay, ordering, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./calvin-transaction";
import type { VisualFrame } from "@/types";

interface Transaction {
    id: string;
    writes: Record<string, number>;
}

function bruteForce(transactions: Transaction[]): Record<string, number> {
    const state: Record<string, number> = {};
    for (const txn of transactions) {
        for (const [key, value] of Object.entries(txn.writes)) state[key] = value;
    }
    return state;
}

function stateFromMeta(meta: Record<string, unknown> | undefined): Record<string, number> {
    const keys = meta?.["stateKeys"] as string[];
    const values = meta?.["stateValues"] as number[];
    return Object.fromEntries(keys.map((key, i) => [key, values[i] ?? 0]));
}

function checkFrames(frames: VisualFrame[], m: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.meta["cols"]).toBe(5);
        expect(frame.meta["rows"]).toBe(m + 1);
        expect(frame.entities.length).toBeGreaterThanOrEqual(m * 5);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("CalvinTransaction", () => {
    it("matches a brute-force serial replay of the global order", () => {
        const transactions: Transaction[] = [
            { id: "A", writes: { X: 1, Y: 2 } },
            { id: "B", writes: { Y: 3 } },
            { id: "C", writes: { X: 4, Z: 5 } },
            { id: "D", writes: { Z: 6, W: 7 } },
        ];
        const frames = [...mod.run({ transactions })];
        checkFrames(frames, transactions.length);
        const final = frames[frames.length - 1]?.meta;
        expect(stateFromMeta(final)).toEqual(bruteForce(transactions));
        expect(final?.["serializable"]).toBe(true);
        expect(final?.["applied"]).toBe(4);
        expect(final?.["sequence"]).toEqual([0, 1, 2, 3]);
    });

    it("applies one sequence entry per frame in order", () => {
        const transactions: Transaction[] = [
            { id: "A", writes: { K: 1 } },
            { id: "B", writes: { K: 2 } },
            { id: "C", writes: { K: 3 } },
        ];
        const frames = [...mod.run({ transactions })];
        for (let i = 0; i < transactions.length; i += 1) {
            expect(frames[i + 1]?.meta["applied"]).toBe(i);
        }
        const final = frames[frames.length - 1]?.meta;
        expect(stateFromMeta(final)["K"]).toBe(3);
    });

    it("handles conflicting writes on the same key deterministically", () => {
        const transactions: Transaction[] = [
            { id: "A", writes: { Q: 10 } },
            { id: "B", writes: { Q: 20 } },
        ];
        const frames = [...mod.run({ transactions })];
        const final = frames[frames.length - 1]?.meta;
        expect(stateFromMeta(final)).toEqual({ Q: 20 });
        expect(stateFromMeta(final)).toEqual(bruteForce(transactions));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
