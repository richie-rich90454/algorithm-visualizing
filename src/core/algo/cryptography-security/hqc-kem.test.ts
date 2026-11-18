/**
 * hqc-kem.test.ts - Exhaustive syndrome decode, uniqueness property, frame
 * shape, and termination checks. This tests a toy model, not production HQC.
 */

import { describe, expect, it } from "vitest";
import mod from "./hqc-kem";
import type { VisualFrame } from "@/types";

const COLUMNS = [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 0, 1],
    [1, 1, 1, 1, 1],
];
const M = 5;
const N = 6;

function syndromeFor(p: number, q: number): number[] {
    return Array.from({ length: M }, (_u, row) => {
        let bit = 0;
        for (const pos of [p, q]) bit ^= COLUMNS[pos]?.[row] ?? 0;
        return bit;
    });
}

function decodeBrute(s: number[]): number[] {
    const sums = new Map<string, number[]>();
    for (let i = 0; i < N; i += 1) {
        for (let j = i + 1; j < N; j += 1) {
            const key = Array.from({ length: M }, (_u, row) => (COLUMNS[i]?.[row] ?? 0) ^ (COLUMNS[j]?.[row] ?? 0)).join("");
            sums.set(key, [i, j]);
        }
    }
    return sums.get(s.join("")) ?? [];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe((M + 1) * (N + 1));
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(M + 1);
        expect(frame.meta["cols"]).toBe(N + 1);
    });
}

describe("HqcKemToy", () => {
    it("decodes every distinct pair of error positions", () => {
        for (let p = 0; p < N; p += 1) {
            for (let q = p + 1; q < N; q += 1) {
                const frames = [...mod.run({ p, q })];
                checkFrames(frames);
                const final = frames[frames.length - 1];
                const expected = decodeBrute(syndromeFor(p, q));
                expect(final?.meta["decoded"]).toEqual(expected);
                expect(final?.meta["valid"]).toBe(true);
                expect(final?.meta["syndrome"]).toEqual(syndromeFor(p, q));
                const err = final?.meta["error"] as number[];
                expect(err.filter((v) => v === 1).length).toBe(2);
                expect(err[p]).toBe(1);
                expect(err[q]).toBe(1);
            }
        }
    });

    it("has a distinct pairwise column sum for all column pairs", () => {
        const seen = new Set<string>();
        for (let i = 0; i < N; i += 1) {
            for (let j = i + 1; j < N; j += 1) {
                const key = Array.from({ length: M }, (_u, row) => (COLUMNS[i]?.[row] ?? 0) ^ (COLUMNS[j]?.[row] ?? 0)).join("");
                expect(seen.has(key)).toBe(false);
                seen.add(key);
            }
        }
        expect(seen.size).toBe((N * (N - 1)) / 2);
    });

    it("re-encoding the decoded pair reproduces the syndrome", () => {
        for (const [p, q] of [[0, 5], [1, 3], [2, 4]]) {
            const frames = [...mod.run({ p, q })];
            const final = frames[frames.length - 1];
            const decoded = final?.meta["decoded"] as number[];
            expect(decoded.length).toBe(2);
            expect(syndromeFor(decoded[0] ?? 0, decoded[1] ?? 0)).toEqual(final?.meta["syndrome"]);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
