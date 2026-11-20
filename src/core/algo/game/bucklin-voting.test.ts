/**
 * bucklin-voting.test.ts - Independent tally, properties, frames, termination.
 */
import { describe, expect, it } from "vitest";
import mod from "./bucklin-voting";
import type { VisualFrame } from "@/types";

/** Reference: build top-k supporter sets by explicit ballot positions. */
function reference(ballots: number[][], m: number) {
    const majority = Math.floor(ballots.length / 2) + 1;
    for (let level = 0; level < m; level += 1) {
        const counts = new Array<number>(m).fill(0);
        for (const ballot of ballots) {
            for (let c = 0; c < m; c += 1) {
                if (ballot.slice(0, level + 1).includes(c)) counts[c] = (counts[c] ?? 0) + 1;
            }
        }
        const qualified = counts.map((n, c) => (n >= majority ? c : -1)).filter((c) => c >= 0);
        if (qualified.length > 0) {
            const top = Math.max(...qualified.map((c) => counts[c] ?? 0));
            return { winners: qualified.filter((c) => (counts[c] ?? 0) === top), level, majority, counts };
        }
    }
    const firsts = new Array<number>(m).fill(0);
    for (const ballot of ballots) if (ballot[0] !== undefined) firsts[ballot[0]] = (firsts[ballot[0]] ?? 0) + 1;
    const top = Math.max(...firsts);
    return { winners: firsts.map((n, c) => (n === top ? c : -1)).filter((c) => c >= 0), level: -1, majority, counts: firsts };
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Bucklin Voting", () => {
    it("matches an independent tally on varied elections", () => {
        const cases: number[][][] = [
            [[0, 1, 2], [0, 2, 1], [1, 0, 2], [2, 1, 0], [1, 2, 0]],
            [[0, 1, 2], [0, 1, 2], [1, 0, 2], [2, 1, 0]],
            [[0, 1], [1, 0], [0, 1], [1, 0], [0, 1]],
            [[2, 1, 0], [2, 0, 1], [1, 2, 0]],
        ];
        for (const ballots of cases) {
            const frames = [...mod.run({ ballots, candidates: 3 })];
            checkFrames(frames, ballots.length + 1, 3);
            const final = frames[frames.length - 1]?.meta;
            const expected = reference(ballots, 3);
            expect(final?.["winners"]).toEqual(expected.winners);
            expect(final?.["level"]).toBe(expected.level);
            expect(final?.["majority"]).toBe(expected.majority);
        }
    });

    it("has its winner reach a majority at the reported level", () => {
        const input = mod.defaultInput as { ballots: number[][]; candidates: number };
        const frames = [...mod.run(input)];
        const final = frames[frames.length - 1]?.meta;
        const count = final?.["cumulative"] as number[];
        const winner = (final?.["winners"] as number[])[0];
        expect(count[winner]).toBeGreaterThanOrEqual(Number(final?.["majority"]));
    });

    it("terminates cleanly", () => {
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of gen) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(gen.next().done).toBe(true);
    });
});
