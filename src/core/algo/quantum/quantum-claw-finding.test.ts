/**
 * quantum-claw-finding.test.ts - Claw correctness and frame checks.
 */

import { describe, expect, it } from "vitest";
import mod, { amplify, clawPairs } from "./quantum-claw-finding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

/** Independent exhaustive enumeration of matching pairs. */
function bruteClaws(f: number[], g: number[]): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    f.forEach((x, i) => g.forEach((y, j) => {
        if (x === y) {
            out.push([i, j]);
        }
    }));
    return out;
}

describe("Quantum Claw Finding", () => {
    it("marks exactly the pairs found by exhaustive enumeration", () => {
        const f = [2, 0, 3, 1, 2];
        const g = [1, 2, 0, 2];
        expect(clawPairs(f, g)).toEqual(bruteClaws(f, g));
    });

    it("concentrates probability on marked pairs after amplification", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]?.meta;
        const pairs = final?.["pairs"] as Array<[number, number]>;
        const marked = final?.["markedIndices"] as number[];
        const success = Number(final?.["success"]);
        const found = final?.["found"] as [number, number] | null;
        expect(pairs).toEqual(bruteClaws([0, 1, 2, 3], [3, 2, 1, 0]));
        expect(success).toBeGreaterThan(0.9);
        expect(found).not.toBeNull();
        expect(pairs).toContainEqual(found as [number, number]);
        const probabilities = final?.["probabilities"] as number[];
        expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        marked.forEach((index) => expect(probabilities[index]).toBeGreaterThan(0));
    });

    it("reports no claw for disjoint value tables", () => {
        const frames = [...mod.run({ f: [0, 1, 2, 3], g: [4, 5, 6, 7] })];
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["found"]).toBeNull();
        expect(Number(final?.["success"])).toBe(0);
        expect(final?.["correct"]).toBe(false);
    });

    it("keeps the state normalized for any iteration count", () => {
        for (const k of [0, 1, 3, 7]) {
            const probabilities = amplify(16, [0, 5, 11], k);
            expect(probabilities.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
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
