/**
 * slasher.test.ts - Correctness, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./slasher";
import type { VisualFrame } from "@/types";

interface Vote {
    validator: string;
    source: number;
    target: number;
    hash: string;
}

/** Independent pairwise detector. */
function detect(votes: Vote[]): Array<{ type: string; a: number; b: number }> {
    const out: Array<{ type: string; a: number; b: number }> = [];
    for (let i = 0; i < votes.length; i += 1) {
        for (let j = i + 1; j < votes.length; j += 1) {
            const a = votes[i]!;
            const b = votes[j]!;
            if (a.validator !== b.validator) continue;
            if (a.target === b.target && a.hash !== b.hash) out.push({ type: "double", a: i, b: j });
            if ((a.source < b.source && b.target < a.target) || (b.source < a.source && a.target < b.target)) {
                out.push({ type: "surround", a: i, b: j });
            }
        }
    }
    return out;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Slasher", () => {
    it("reports no offences for a clean default vote set", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["violations"])).toBe(0);
        expect(final?.["slashable"]).toBe(false);
    });

    it("detects a double vote", () => {
        const votes: Vote[] = [
            { validator: "v", source: 1, target: 5, hash: "x" },
            { validator: "v", source: 2, target: 5, hash: "y" },
        ];
        const frames = [...mod.run({ votes })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["doubleVotes"])).toBe(1);
        expect(Number(final?.["surroundVotes"])).toBe(0);
        expect(final?.["slashable"]).toBe(true);
    });

    it("detects a surround vote", () => {
        const votes: Vote[] = [
            { validator: "v", source: 1, target: 5, hash: "x" },
            { validator: "v", source: 2, target: 4, hash: "y" },
        ];
        const frames = [...mod.run({ votes })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["doubleVotes"])).toBe(0);
        expect(Number(final?.["surroundVotes"])).toBe(1);
    });

    it("matches an independent detector on mixed vote sets", () => {
        const votes: Vote[] = [
            { validator: "a", source: 1, target: 3, hash: "a1" },
            { validator: "a", source: 1, target: 3, hash: "a2" },
            { validator: "a", source: 2, target: 2, hash: "a3" },
            { validator: "b", source: 4, target: 8, hash: "b1" },
            { validator: "b", source: 5, target: 7, hash: "b2" },
            { validator: "b", source: 6, target: 9, hash: "b3" },
        ];
        const expected = detect(votes);
        const frames = [...mod.run({ votes })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["violations"])).toBe(expected.length);
        expect(Number(final?.["doubleVotes"])).toBe(expected.filter((v) => v.type === "double").length);
        expect(Number(final?.["surroundVotes"])).toBe(expected.filter((v) => v.type === "surround").length);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
