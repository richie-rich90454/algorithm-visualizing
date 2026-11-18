/**
 * mixture-of-experts-routing.test.ts - Brute-force top-k and capacity checks, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { moeForward, moeRoute, softmax } from "./mixture-of-experts-routing";
import type { VisualFrame } from "@/types";

type Input = { tokens: number[][]; routerW: number[][]; topK: number; capacityFactor: number };

function checkFrames(frames: VisualFrame[], n: number, E: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * E);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("MixtureOfExpertsRouting", () => {
    it("softmax rows sum to one", () => {
        expect(softmax([1, 2, 3]).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
        expect(softmax([])).toEqual([]);
    });

    it("chooses exact top-k experts and never exceeds capacity", () => {
        const cases: Input[] = [
            {
                tokens: [[1, 0], [0, 1], [1, 1]],
                routerW: [[1, 0], [0, 1], [0.5, 0.5]],
                topK: 2,
                capacityFactor: 1,
            },
            {
                tokens: [[2, -1], [0.3, 4], [-2, 1], [1, 1], [0, 0]],
                routerW: [[1, 2], [-1, 0.5], [3, -2], [0.2, 0.8]],
                topK: 2,
                capacityFactor: 0.5,
            },
            {
                tokens: [[1, 2, 0.5], [-1, 0, 3]],
                routerW: [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]],
                topK: 3,
                capacityFactor: 2,
            },
        ];
        for (const input of cases) {
            const route = moeRoute(input.tokens, input.routerW, input.topK, input.capacityFactor);
            for (let i = 0; i < input.tokens.length; i += 1) {
                const expected = route.probs[i]!
                    .map((p, e) => ({ p, e }))
                    .sort((a, b) => b.p - a.p || a.e - b.e)
                    .slice(0, route.k)
                    .map((x) => x.e);
                expect(route.chosen[i]).toEqual(expected);
                expect(route.probs[i]!.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
            }
            for (const count of route.counts) expect(count).toBeLessThanOrEqual(route.capacity);
            const accepted = route.counts.reduce((a, b) => a + b, 0);
            expect(accepted + route.dropped).toBe(input.tokens.length * route.k);
            const assigned = route.assignments.reduce((sum, row) => sum + row.length, 0);
            expect(assigned).toBe(accepted);
        }
    });

    it("combined output matches an independent brute-force recombination", () => {
        const input = mod.defaultInput as Input;
        const route = moeRoute(input.tokens, input.routerW, input.topK, input.capacityFactor);
        const output = moeForward(input.tokens, route);
        const frames = [...mod.run(input)];
        checkFrames(frames, input.tokens.length, input.routerW.length);
        const metaOutput = frames[frames.length - 1]?.meta["output"] as number[];
        output.forEach((row, i) =>
            row.forEach((v, j) => {
                expect(v).toBeCloseTo(metaOutput[i * row.length + j] ?? 0, 9);
                const kept = route.assignments[i] ?? [];
                const total = kept.reduce((s, e) => s + (route.probs[i]?.[e] ?? 0), 0);
                const brute = kept.reduce(
                    (s, e) => s + ((route.probs[i]?.[e] ?? 0) / total) * (input.tokens[i]?.[j] ?? 0) * (1 + 0.5 * e),
                    0,
                );
                expect(v).toBeCloseTo(brute, 9);
            }),
        );
    });

    it("reports capacity drops in the frame metadata", () => {
        const frames = [...mod.run({ tokens: [[1, 0], [0, 1], [1, 1]], routerW: [[1, 0], [0, 1], [0.5, 0.5]], topK: 2, capacityFactor: 0.5 })];
        const final = frames[frames.length - 1]?.meta ?? {};
        expect(Number(final["dropped"])).toBeGreaterThan(0);
        expect((final["chosen"] as number[]).length).toBe(3 * 2);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
