/**
 * expert-choice-routing.test.ts - Brute-force top-k comparison, capacity and
 * load invariants, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { chooseTokens } from "./expert-choice-routing";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number, experts: number): void {
    expect(frames.length).toBe(experts + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.length).toBe(n * experts);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Expert-Choice Routing", () => {
    it("matches a brute-force top-k selection for every expert", () => {
        const input = mod.defaultInput as { affinity: number[][]; k: number };
        const frames = [...mod.run(input)];
        const n = input.affinity.length;
        const experts = input.affinity[0]?.length ?? 0;
        checkFrames(frames, n, experts);

        const loads: number[] = Array(n).fill(0);
        const expectedByExpert: number[][] = [];
        for (let expert = 0; expert < experts; expert += 1) {
            const expected = input.affinity
                .map((row, index) => ({ score: row[expert] ?? 0, index }))
                .sort((a, b) => b.score - a.score || a.index - b.index)
                .slice(0, input.k)
                .map((entry) => entry.index);
            expectedByExpert.push(expected);
            for (const token of expected) {
                loads[token] = (loads[token] ?? 0) + 1;
            }
        }
        for (let expert = 0; expert < experts; expert += 1) {
            const frame = frames[expert + 1];
            const selected = frame?.meta["selected"] as number[];
            expect(selected).toEqual(expectedByExpert[expert]);
            expect(selected.length).toBe(input.k);
            expect(chooseTokens(input.affinity, expert, input.k)).toEqual(expectedByExpert[expert]);
            expect(frame?.meta["loads"]).toEqual(loads);
        }

        const final = frames[frames.length - 1]?.meta;
        expect(final?.["loads"]).toEqual(loads);
        expect(Number(final?.["totalAssignments"])).toBe(experts * input.k);
        expect((loads as number[]).reduce((a, b) => a + b, 0)).toBe(experts * input.k);
    });

    it("holds the capacity invariant on random matrices and capacities", () => {
        let seed = 17;
        const rand = (): number => {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            return seed / 4294967296;
        };
        for (const k of [1, 2, 3]) {
            for (const trial of [0, 1, 2, 3, 4]) {
                const affinity = Array.from({ length: 5 }, () =>
                    Array.from({ length: 3 }, () => Math.round(rand() * 100) / 100),
                );
                const frames = [...mod.run({ affinity, k })];
                checkFrames(frames, 5, 3);
                const final = frames[frames.length - 1]?.meta;
                const assignment = final?.["assignment"] as number[];
                const loads = final?.["loads"] as number[];
                expect(assignment.length).toBe(3 * k);
                expect(loads.reduce((a, b) => a + b, 0)).toBe(3 * k);
                for (let expert = 0; expert < 3; expert += 1) {
                    const picked = assignment.slice(expert * k, (expert + 1) * k);
                    const expected = affinity
                        .map((row, index) => ({ score: row[expert] ?? 0, index }))
                        .sort((a, b) => b.score - a.score || a.index - b.index)
                        .slice(0, k)
                        .map((entry) => entry.index);
                    expect(picked).toEqual(expected);
                }
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
