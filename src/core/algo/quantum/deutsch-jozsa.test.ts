/**
 * deutsch-jozsa.test.ts - Brute-force oracle classification, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./deutsch-jozsa";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], size: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBe(size);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

function makeRandom(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 2531011) + 103) >>> 0;
        return state / 0x100000000;
    };
}

describe("Deutsch-Jozsa", () => {
    it("classifies every constant and balanced truth table with one query", () => {
        for (let n = 1; n <= 4; n += 1) {
            const size = 1 << n;
            const zeroTable = Array.from({ length: size }, () => 0);
            const oneTable = Array.from({ length: size }, () => 1);
            const balancedTable = Array.from({ length: size }, (_, i) => (i < size / 2 ? 0 : 1));
            const alternating = Array.from({ length: size }, (_, i) => i % 2);
            const tables = [zeroTable, oneTable, balancedTable, alternating];

            const random = makeRandom(n * 97);
            for (let trial = 0; trial < 30; trial += 1) {
                const table = Array.from({ length: size }, () => (random() < 0.5 ? 0 : 1));
                tables.push(table);
            }

            for (const truthTable of tables) {
                const ones = truthTable.reduce((sum, value) => sum + value, 0);
                if (ones !== 0 && ones !== size && ones !== size / 2) continue;
                const expected = ones === 0 || ones === size ? "constant" : "balanced";

                const frames = [...mod.run({ n, truthTable })];
                checkFrames(frames, size);
                const finalMeta = frames[frames.length - 1]!.meta;
                expect(finalMeta["verdict"]).toBe(expected);
                expect(finalMeta["oracle"]).toBe(expected);
                expect(finalMeta["queries"]).toBe(1);
                expect(Number(finalMeta["allZerosProbability"])).toBeCloseTo(
                    expected === "constant" ? 1 : 0,
                    9,
                );

                const probabilities = frames[frames.length - 1]!.entities.map((entity) => Number(entity.value));
                const sum = probabilities.reduce((total, value) => total + value, 0);
                expect(sum).toBeCloseTo(1, 9);
            }
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
