/**
 * qubitization.test.ts - Dirichlet-kernel cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./qubitization";
import type { VisualFrame } from "@/types";

/** Independent direct summation of the QPE amplitude. */
function directProb(theta: number, y: number, N: number): number {
    let re = 0;
    let im = 0;
    for (let k = 0; k < N; k += 1) {
        const angle = (theta - (2 * Math.PI * y) / N) * k;
        re += Math.cos(angle);
        im += Math.sin(angle);
    }
    return (re * re + im * im) / (N * N);
}

function checkFrames(frames: VisualFrame[], outcomes: number): void {
    expect(frames.length).toBe(outcomes + 3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("point");
        expect(frame.entities.length).toBe(outcomes);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        const ids = new Set(frame.entities.map((e) => e.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

describe("Qubitization", () => {
    it("matches a direct QPE amplitude sum and normalizes", () => {
        for (const bits of [2, 3, 4]) {
            const N = 1 << bits;
            const frames = [...mod.run({ lambda: 0.5, alpha: 1, bits })];
            checkFrames(frames, N);
            const theta = Math.acos(0.5);
            const distribution = frames[frames.length - 1]?.entities ?? [];
            let total = 0;
            for (const node of distribution) {
                const y = node.metadata["index"] as number;
                const prob = node.metadata["probability"] as number;
                expect(prob).toBeCloseTo(directProb(theta, y, N), 8);
                total += prob;
            }
            expect(total).toBeCloseTo(1, 8);
        }
    });

    it("the walk element equals lambda over alpha and the estimate improves with bits", () => {
        const lambda = 0.3;
        const alpha = 1;
        const frames4 = [...mod.run({ lambda, alpha, bits: 4 })];
        const meta4 = frames4[1]?.meta;
        expect(Number(meta4?.["walkElement"])).toBeCloseTo(lambda / alpha, 9);
        const estimate4 = Number(frames4[frames4.length - 1]?.meta["lambdaEstimate"]);

        const frames6 = [...mod.run({ lambda, alpha, bits: 6 })];
        const estimate6 = Number(frames6[frames6.length - 1]?.meta["lambdaEstimate"]);
        expect(Math.abs(estimate6 - lambda)).toBeLessThan(Math.abs(estimate4 - lambda));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(11);
        expect(generator.next().done).toBe(true);
    });
});
