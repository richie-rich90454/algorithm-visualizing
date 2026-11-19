/**
 * plurality-voting.test.ts - Tally correctness against an independent count.
 */

import { describe, expect, it } from "vitest";
import mod from "./plurality-voting";
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

function reference(ballots: number[][], m: number): { counts: number[]; winners: number[] } {
    const counts = new Array<number>(m).fill(0);
    for (const ballot of ballots) {
        const top = ballot[0];
        if (typeof top === "number" && top >= 0 && top < m) {
            counts[top] += 1;
        }
    }
    const best = Math.max(...counts);
    const winners = counts.map((count, i) => (count === best ? i : -1)).filter((i) => i >= 0);
    return { counts, winners };
}

describe("Plurality Voting", () => {
    it("tallies the default ballots correctly", () => {
        const input = mod.defaultInput as { ballots: number[][]; candidates: number };
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const expected = reference(input.ballots, input.candidates);
        expect(final?.["counts"]).toEqual(expected.counts);
        expect(final?.["winners"]).toEqual(expected.winners);
    });

    it("handles ties, invalid ballots, and random elections", () => {
        let seed = 53;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (let trial = 0; trial < 30; trial += 1) {
            const m = 2 + Math.floor(rand() * 5);
            const ballots: number[][] = [];
            const count = Math.floor(rand() * 12);
            for (let i = 0; i < count; i += 1) {
                if (rand() < 0.1) {
                    ballots.push([]);
                    continue;
                }
                const order = Array.from({ length: m }, (_, k) => k).sort(() => rand() - 0.5);
                ballots.push(order);
            }
            const frames = [...mod.run({ ballots, candidates: m })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(ballots, m);
            expect(final?.["counts"]).toEqual(expected.counts);
            expect(final?.["winners"]).toEqual(expected.winners);
            const sum = (final?.["counts"] as number[]).reduce((a, b) => a + b, 0);
            expect(sum).toBe(ballots.filter((b) => b.length > 0).length);
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
