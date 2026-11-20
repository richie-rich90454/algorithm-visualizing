/**
 * casper-ffg.test.ts - Justification/finalization property checks, frames, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { simulateCasper } from "./casper-ffg";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], checkpoints: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(checkpoints);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Independent reference implementation of justification and finalization. */
function reference(epochs: number, votes: Array<[number, number]>, validators: number) {
    const C = epochs + 1;
    const threshold = Math.floor(validators * 2 / 3) + 1;
    const counts = Array<number>(C).fill(0);
    votes.forEach(([s, t]) => { if (t >= 0 && t < C && s >= 0 && s < C) counts[t] += 1; });
    const justified = new Set<number>([0]);
    for (let pass = 0; pass < C; pass += 1) {
        votes.forEach(([s, t]) => {
            if (counts[t] >= threshold && justified.has(s)) justified.add(t);
        });
    }
    const finalized = new Set<number>();
    votes.forEach(([s, t]) => {
        if (t === s + 1 && counts[t] >= threshold && justified.has(s) && justified.has(t)) finalized.add(t);
    });
    return {
        justified: [...justified].sort((a, b) => a - b),
        finalized: [...finalized].sort((a, b) => a - b),
    };
}

describe("Casper FFG", () => {
    it("matches an independent reference over random vote multisets", () => {
        for (let epochs = 1; epochs <= 5; epochs += 1) {
            for (let validators = 1; validators <= 6; validators += 1) {
                for (let trial = 0; trial < 40; trial += 1) {
                    const votes: Array<[number, number]> = Array.from({ length: 12 }, (_, i) => [
                        (trial + i) % (epochs + 1),
                        (trial + i + 1) % (epochs + 1),
                    ]);
                    const expected = reference(epochs, votes, validators);
                    const data = simulateCasper(epochs, votes, validators);
                    expect(data.justified).toEqual(expected.justified);
                    expect(data.finalized).toEqual(expected.finalized);
                    for (const t of data.finalized) {
                        expect(data.justified).toContain(t);
                        expect(data.justified).toContain(t - 1);
                    }
                }
            }
        }
    });

    it("finalizes a direct justified link but not a short of quorum link", () => {
        const enough = simulateCasper(2, [[0, 1], [0, 1], [0, 1], [1, 2], [1, 2]], 3);
        expect(enough.finalized).toEqual([1]);
        const short = simulateCasper(2, [[0, 1], [0, 1]], 3);
        expect(short.justified).toEqual([0]);
        expect(short.finalized).toEqual([]);
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        expect(frames[frames.length - 1]?.meta["finalized"]).toEqual([1]);
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 3);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
