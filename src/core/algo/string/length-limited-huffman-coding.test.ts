/** length-limited-huffman-coding.test.ts - Optimality vs brute force, frames, termination. */

import { describe, expect, it } from "vitest";
import mod from "./length-limited-huffman-coding";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThanOrEqual(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(typeof frame.meta["rows"]).toBe("number");
        expect(typeof frame.meta["cols"]).toBe("number");
    });
}

/** Exhaustive minimum weighted path length over all length vectors. */
function bruteMinCost(weights: number[], limit: number): number {
    let best = Infinity;
    const n = weights.length;
    const lengths = new Array<number>(n).fill(1);
    const search = (index: number, kraft: number, cost: number): void => {
        if (index === n) {
            if (kraft <= 1 + 1e-12) {
                best = Math.min(best, cost);
            }
            return;
        }
        for (let length = 1; length <= limit; length += 1) {
            lengths[index] = length;
            search(index + 1, kraft + Math.pow(2, -length), cost + weights[index] * length);
        }
    };
    search(0, 0, 0);
    return best;
}

function isPrefixFree(codes: string[]): boolean {
    const present = codes.filter((code) => code.length > 0);
    for (let i = 0; i < present.length; i += 1) {
        for (let j = 0; j < present.length; j += 1) {
            if (i !== j && present[j].startsWith(present[i])) {
                return false;
            }
        }
    }
    return true;
}

describe("Length-Limited Huffman Coding", () => {
    it("finds the optimal length-limited cost on random small inputs", () => {
        let seed = 19;
        const rand = (limit: number): number => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed % limit;
        };
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 2 + rand(5);
            const weights = Array.from({ length: n }, () => 1 + rand(40));
            const requestedLimit = 2 + rand(4);
            const limit = Math.max(requestedLimit, Math.ceil(Math.log2(n)));
            const frames = [...mod.run({ weights, maxLength: requestedLimit })];
            checkFrames(frames);
            const final = frames[frames.length - 1]?.meta;
            const lengths = final?.["lengths"] as number[];
            const codes = final?.["codes"] as string[];
            expect(lengths).toHaveLength(n);
            expect(Math.max(...lengths)).toBeLessThanOrEqual(limit);
            const kraft = lengths.reduce((sum, length) => sum + Math.pow(2, -length), 0);
            expect(kraft).toBeLessThanOrEqual(1 + 1e-9);
            const cost = weights.reduce((sum, weight, index) => sum + weight * lengths[index], 0);
            expect(cost).toBeCloseTo(bruteMinCost(weights, limit), 6);
            expect(isPrefixFree(codes)).toBe(true);

            const bits = weights.map((_weight, index) => codes[index]).join("");
            let cursor = 0;
            let decoded = "";
            while (cursor < bits.length) {
                const match = codes.find((code) => code.length > 0 && bits.startsWith(code, cursor));
                expect(match).toBeDefined();
                decoded += String.fromCharCode(65 + codes.indexOf(match as string));
                cursor += (match as string).length;
            }
            expect(decoded).toBe(weights.map((_weight, index) => String.fromCharCode(65 + index)).join(""));
        }
    });

    it("handles empty and single-symbol inputs", () => {
        const empty = [...mod.run({ weights: [] })];
        checkFrames(empty);
        expect(empty[empty.length - 1]?.meta["lengths"]).toEqual([]);

        const single = [...mod.run({ weights: [5], maxLength: 3 })];
        checkFrames(single);
        expect(single[single.length - 1]?.meta["lengths"]).toEqual([1]);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
