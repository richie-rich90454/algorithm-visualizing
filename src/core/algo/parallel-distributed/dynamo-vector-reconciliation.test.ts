/**
 * dynamo-vector-reconciliation.test.ts - Brute-force dominance check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./dynamo-vector-reconciliation";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent dominance test and last-writer-wins resolution. */
function reference(a: number[], b: number[], aTime: number, bTime: number, aValue: string, bValue: string) {
    let aWins = false;
    let bWins = false;
    for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
        if ((a[i] ?? 0) > (b[i] ?? 0)) {
            aWins = true;
        }
        if ((b[i] ?? 0) > (a[i] ?? 0)) {
            bWins = true;
        }
    }
    let winner: string;
    let relationship: string;
    if (aWins && !bWins) {
        winner = aValue;
        relationship = "a-dominates";
    } else if (bWins && !aWins) {
        winner = bValue;
        relationship = "b-dominates";
    } else {
        winner = aTime >= bTime ? aValue : bValue;
        relationship = a.every((v, i) => v === (b[i] ?? 0)) ? "equal" : "concurrent";
    }
    const resolved = a.map((v, i) => Math.max(v, b[i] ?? 0));
    return { winner, relationship, resolved };
}

describe("DynamoVectorReconciliation", () => {
    it("matches a brute-force dominance and tie-break over many vector pairs", () => {
        const vectors = [
            [0, 0],
            [1, 0],
            [0, 1],
            [2, 1],
            [1, 2],
            [2, 2],
            [3, 1],
        ];
        for (const a of vectors) {
            for (const b of vectors) {
                for (const [aTime, bTime] of [[10, 20], [30, 5]]) {
                    const frames = [...mod.run({
                        aVector: a,
                        bVector: b,
                        aValue: "red",
                        bValue: "blue",
                        aTime,
                        bTime,
                    })];
                    checkFrames(frames);
                    const final = frames[frames.length - 1]?.meta;
                    const expected = reference(a, b, aTime, bTime, "red", "blue");
                    expect(final?.["winner"]).toBe(expected.winner);
                    expect(final?.["relationship"]).toBe(expected.relationship);
                    expect(final?.["resolvedVector"]).toEqual(expected.resolved);
                }
            }
        }
    });

    it("keeps the componentwise maximum clock", () => {
        const frames = [...mod.run({ aVector: [5, 1], bVector: [2, 4] })];
        checkFrames(frames);
        expect(frames[frames.length - 1]?.meta["resolvedVector"]).toEqual([5, 4]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBe(4);
        expect(generator.next().done).toBe(true);
    });
});
