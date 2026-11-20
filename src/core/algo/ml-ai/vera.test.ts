/** vera.test.ts - Triple-product reference, linearity, rank, frame checks. */

import { describe, expect, it } from "vitest";
import mod, { veraDelta, veraForward, veraRandomMatrices } from "./vera";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("matrix");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("VeRA", () => {
    it("effective delta matches an explicit triple-product loop", () => {
        const { A, B } = veraRandomMatrices(4, 3, 5, 7);
        const lambda = [0.2, -0.5, 1.1];
        const got = veraDelta(A, B, lambda);
        for (let i = 0; i < 4; i += 1) {
            for (let o = 0; o < 5; o += 1) {
                let expected = 0;
                for (let k = 0; k < 3; k += 1) {
                    expected += B[k]![o]! * lambda[k]! * A[i]![k]!;
                }
                expect(got[i]![o]).toBeCloseTo(expected, 12);
            }
        }
    });

    it("is linear in scales, zero-scale is identity, and rank-one rows are proportional", () => {
        const { A, B } = veraRandomMatrices(3, 2, 4, 2);
        const base = [
            [1, 1, 1, 1],
            [1, 1, 1, 1],
            [1, 1, 1, 1],
        ];
        const zero = veraForward(base, A, B, [0, 0]);
        zero.forEach((row) => row.forEach((v) => expect(v).toBe(1)));

        const lambda = [0.3, 0.7];
        const scaled = veraDelta(A, B, lambda.map((l) => 2 * l));
        const plain = veraDelta(A, B, lambda);
        scaled.forEach((row, i) =>
            row.forEach((v, o) => expect(v).toBeCloseTo(2 * plain[i]![o]!, 10)),
        );

        const { A: A1, B: B1 } = veraRandomMatrices(4, 1, 3, 5);
        const rankOne = veraDelta(A1, B1, [0.9]);
        const first = rankOne[0]!;
        for (let i = 1; i < 4; i += 1) {
            const ratio = rankOne[i]![0]! / first[0]!;
            for (let o = 0; o < 3; o += 1) {
                expect(rankOne[i]![o]!).toBeCloseTo(ratio * first[o]!, 8);
            }
        }
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        expect(frames[frames.length - 1]!.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
