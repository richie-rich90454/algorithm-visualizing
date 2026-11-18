/**
 * self-consistency-decoding.test.ts - Tally correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./self-consistency-decoding";
import type { VisualFrame } from "@/types";

function reference(samples: string[]) {
    const distinct = [...new Set(samples)];
    const counts = new Map<string, number>();
    for (const answer of samples) {
        counts.set(answer, (counts.get(answer) ?? 0) + 1);
    }
    let winner = distinct[0] ?? "";
    for (const answer of distinct) {
        if ((counts.get(answer) ?? 0) > (counts.get(winner) ?? 0)) {
            winner = answer;
        }
    }
    return { distinct, counts, winner };
}

function checkFrames(frames: VisualFrame[], samples: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(4 * Math.max(samples, 1));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("SelfConsistencyDecoding", () => {
    it("matches an independent tally on varied samples", () => {
        const cases = [
            ["A", "B", "A", "A", "C", "B", "A"],
            ["X", "Y", "X", "Y"],
            ["7", "7", "7"],
            ["slow", "fast", "fast", "slow", "fast"],
        ];
        for (const samples of cases) {
            const frames = [...mod.run({ samples })];
            checkFrames(frames, samples.length);
            const expected = reference(samples);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["answers"]).toEqual(expected.distinct);
            expect(meta?.["counts"]).toEqual(
                expected.distinct.map((answer) => expected.counts.get(answer)),
            );
            expect(meta?.["winner"]).toBe(expected.winner);
            expect(meta?.["winnerVotes"]).toBe(expected.counts.get(expected.winner));
        }
    });

    it("breaks ties by first appearance and counts every sample once", () => {
        const samples = ["B", "A", "B", "A", "C"];
        const frames = [...mod.run({ samples })];
        checkFrames(frames, samples.length);
        const meta = frames[frames.length - 1]?.meta;
        expect(meta?.["winner"]).toBe("B");
        const counts = meta?.["counts"] as number[];
        expect(counts.reduce((sum, value) => sum + value, 0)).toBe(samples.length);
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
