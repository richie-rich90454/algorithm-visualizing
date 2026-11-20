/**
 * ranked-choice-voting.test.ts - Runoff correctness against an independent
 * elimination replay, plus majority/conservation properties, frame shape,
 * and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./ranked-choice-voting";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < frames.length; index += 1) {
        const frame = frames[index];
        if (!frame) {
            continue;
        }
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
    }
}

/** Independent replay that rewrites each ballot to a single first choice. */
function reference(ballots: number[][], m: number): { winner: number; eliminated: number[] } {
    let remaining = Array.from({ length: m }, (_, i) => i);
    const eliminated: number[] = [];
    for (let round = 0; round <= m; round += 1) {
        const firsts = ballots
            .map((ballot) => ballot.find((c) => remaining.includes(c)))
            .filter((c): c is number => c !== undefined);
        const counts = new Array<number>(m).fill(0);
        for (const c of firsts) {
            counts[c] = (counts[c] ?? 0) + 1;
        }
        const majority = Math.floor(firsts.length / 2) + 1;
        const leader = remaining.reduce((best, c) => ((counts[c] ?? 0) > (counts[best] ?? 0) ? c : best), remaining[0] ?? 0);
        if (firsts.length > 0 && (counts[leader] ?? 0) >= majority) {
            return { winner: leader, eliminated };
        }
        if (remaining.length === 1) {
            return { winner: remaining[0] ?? 0, eliminated };
        }
        const lowest = remaining.reduce((worst, c) => ((counts[c] ?? 0) < (counts[worst] ?? 0) ? c : worst), remaining[0] ?? 0);
        remaining = remaining.filter((c) => c !== lowest);
        eliminated.push(lowest);
    }
    return { winner: eliminated[eliminated.length - 1] ?? 0, eliminated };
}

describe("Ranked Choice Voting", () => {
    it("matches the independent runoff on the default and random elections", () => {
        let seed = 31;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        const cases: Array<{ ballots: number[][]; candidates: number }> = [
            mod.defaultInput as { ballots: number[][]; candidates: number },
            { ballots: [[0, 1, 2], [0, 2, 1], [0, 1, 2]], candidates: 3 },
            { ballots: [[1, 0, 2], [1, 2, 0], [0, 1, 2]], candidates: 3 },
        ];
        for (let trial = 0; trial < 30; trial += 1) {
            const m = 2 + Math.floor(rand() * 4);
            const ballots = Array.from({ length: 1 + Math.floor(rand() * 9) }, () =>
                Array.from({ length: m }, (_, k) => k).sort(() => rand() - 0.5),
            );
            cases.push({ ballots, candidates: m });
        }
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(input.ballots, input.candidates);
            expect(final?.["winner"]).toBe(expected.winner);
            expect(final?.["eliminated"]).toEqual(expected.eliminated);
        }
    });

    it("elects a first-round majority winner immediately and conserves votes each round", () => {
        const ballots = [[0, 1, 2], [0, 2, 1], [0, 1, 2], [1, 2, 0], [2, 0, 1]];
        const frames = [...mod.run({ ballots, candidates: 3 })];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["winner"]).toBe(0);
        expect(final?.["eliminated"]).toEqual([]);
        expect(final?.["rounds"]).toBe(1);
        for (const frame of frames) {
            const counts = frame.meta["counts"] as number[] | undefined;
            if (!counts) {
                continue;
            }
            const threshold = frame.meta["threshold"] as number | undefined;
            if (threshold && counts.some((c) => c >= threshold)) {
                expect(counts.reduce((a, b) => a + b, 0)).toBe(ballots.length);
            }
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
