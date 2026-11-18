/**
 * two-phase-commit.test.ts - Exhaustive decision check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./two-phase-commit";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(1);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.has("coordinator")).toBe(true);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** All 2^n vote patterns for n participants, generated independently. */
function* votePatterns(n: number): Generator<boolean[]> {
    for (let mask = 0; mask < 2 ** n; mask += 1) {
        const pattern = new Array<boolean>(n).fill(false);
        for (let i = 0; i < n; i += 1) {
            pattern[i] = ((mask >> i) & 1) === 1;
        }
        yield pattern;
    }
}

describe("TwoPhaseCommit", () => {
    it("commits if and only if every vote is yes, for all vote patterns", () => {
        for (let n = 1; n <= 4; n += 1) {
            for (const votes of votePatterns(n)) {
                const frames = [...mod.run({ votes })];
                checkFrames(frames);
                const expected = votes.every(Boolean) ? "commit" : "abort";
                const final = frames[frames.length - 1]?.meta;
                expect(final?.["decision"]).toBe(expected);
                expect(final?.["committed"]).toBe(expected === "commit" ? n : 0);
                expect((final?.["votes"] as string[]).length).toBe(n);
            }
        }
    });

    it("records the prepare votes before deciding", () => {
        const frames = [...mod.run({ votes: [true, false, true] })];
        checkFrames(frames);
        const prepare = frames.filter((f) => f.meta["phase"] === "prepare");
        expect(prepare.length).toBe(3);
        expect(prepare[1]?.meta["decision"]).toBe("pending");
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
