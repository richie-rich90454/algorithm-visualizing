/**
 * css-code.test.ts - GF(2) rank, Steane parameters, commutation, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { buildCssCode, gf2Rank, HAMMING_H } from "./css-code";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBeGreaterThanOrEqual(rows);
        expect(frame.meta["cols"]).toBe(cols);
    });
}

describe("CSS code construction", () => {
    it("computes GF(2) rank correctly", () => {
        expect(gf2Rank([[1, 0], [0, 1]])).toBe(2);
        expect(gf2Rank([[1, 1], [1, 1]])).toBe(1);
        expect(gf2Rank(HAMMING_H)).toBe(3);
        expect(gf2Rank([])).toBe(0);
    });

    it("produces the Steane seven-qubit code parameters", () => {
        const result = buildCssCode(HAMMING_H, HAMMING_H);
        expect(result.n).toBe(7);
        expect(result.xRank).toBe(3);
        expect(result.zRank).toBe(3);
        expect(result.k).toBe(1);
        expect(result.d).toBe(3);
        expect(result.commuting).toBe(true);
        expect(result.distanceWitness?.weight).toBe(3);
    });

    it("a distance witness commutes with every check and is not a stabilizer", () => {
        const result = buildCssCode(HAMMING_H, HAMMING_H);
        const witness = result.distanceWitness as { xPart: number; zPart: number; weight: number };
        const overlap = (a: number, b: number) => {
            let count = 0;
            for (let i = 0; i < 7; i += 1) {
                if (((a >> i) & 1) && ((b >> i) & 1)) {
                    count += 1;
                }
            }
            return count % 2;
        };
        for (const row of HAMMING_H) {
            const pattern = row.reduce((value, bit, col) => value | ((bit % 2) << col), 0);
            expect(overlap(witness.xPart, pattern)).toBe(0);
            expect(overlap(witness.zPart, pattern)).toBe(0);
        }
        const rowSpace = new Set<number>([0]);
        for (const row of HAMMING_H) {
            const pattern = row.reduce((value, bit, col) => value | ((bit % 2) << col), 0);
            for (const element of [...rowSpace]) {
                rowSpace.add(element ^ pattern);
            }
        }
        expect(rowSpace.has(witness.xPart) && rowSpace.has(witness.zPart)).toBe(false);
    });

    it("reports non-commuting matrices", () => {
        const hx = [[1, 0]];
        const hz = [[1, 0]];
        const result = buildCssCode(hx, hz);
        expect(result.commuting).toBe(false);
        expect(result.k).toBe(0);
    });

    it("encodes two logical qubits with disjoint repetition checks", () => {
        const repeats = [[1, 1, 1, 1]];
        const result = buildCssCode(repeats, repeats);
        expect(result.n).toBe(4);
        expect(result.xRank).toBe(1);
        expect(result.zRank).toBe(1);
        expect(result.k).toBe(2);
    });

    it("emits the Steane parameters in its final frame", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames, 6, 7);
        const final = frames[frames.length - 1]?.meta;
        expect(final?.["n"]).toBe(7);
        expect(final?.["k"]).toBe(1);
        expect(final?.["d"]).toBe(3);
        expect(final?.["commuting"]).toBe(true);
        expect(String(final?.["witness"])).toContain("X");
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
