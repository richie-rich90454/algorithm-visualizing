/** switchable-normalization.test.ts - Statistics, blend, frame, termination checks. */

import { describe, expect, it } from "vitest";
import mod, {
    batchNormalize,
    instanceNormalize,
    layerNormalize,
    normalizeWeights,
    switchableNormalize,
    type Tensor3,
} from "./switchable-normalization";
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

function mean(values: number[]): number {
    return values.reduce((s, x) => s + x, 0) / values.length;
}

describe("Switchable Normalization", () => {
    const tensor: Tensor3 = [
        [
            [1, 2, 3, 4],
            [5, 6, 7, 8],
        ],
        [
            [2, 4, 1, 3],
            [8, 7, 6, 5],
        ],
    ];

    it("each normalizer has zero mean and unit variance on its axes", () => {
        const bn = batchNormalize(tensor);
        const inn = instanceNormalize(tensor);
        const ln = layerNormalize(tensor);
        // Batch norm: per channel across batch and spatial.
        for (let c = 0; c < 2; c += 1) {
            const vals = bn.flatMap((b) => b[c]!);
            expect(mean(vals)).toBeCloseTo(0, 6);
            expect(mean(vals.map((x) => x * x))).toBeCloseTo(1, 4);
        }
        // Instance norm: per batch-channel slice.
        for (const b of inn) {
            for (const ch of b) {
                expect(mean(ch)).toBeCloseTo(0, 6);
                expect(mean(ch.map((x) => x * x))).toBeCloseTo(1, 4);
            }
        }
        // Layer norm: per batch sample.
        for (const b of ln) {
            const vals = b.flat();
            expect(mean(vals)).toBeCloseTo(0, 6);
            expect(mean(vals.map((x) => x * x))).toBeCloseTo(1, 4);
        }
    });

    it("blend matches a direct weighted sum and extreme weights select one normalizer", () => {
        const weights = [
            [1, 1, 1],
            [2, 1, 0],
        ];
        const got = switchableNormalize(tensor, weights);
        const bn = batchNormalize(tensor);
        const inn = instanceNormalize(tensor);
        const ln = layerNormalize(tensor);
        for (let b = 0; b < 2; b += 1) {
            for (let c = 0; c < 2; c += 1) {
                const w = normalizeWeights(weights[c]!);
                for (let s = 0; s < 4; s += 1) {
                    const expected =
                        w[0]! * bn[b]![c]![s]! + w[1]! * inn[b]![c]![s]! + w[2]! * ln[b]![c]![s]!;
                    expect(got[b]![c]![s]!).toBeCloseTo(expected, 10);
                }
            }
        }
        const onlyBatch = switchableNormalize(tensor, [
            [1, 0, 0],
            [1, 0, 0],
        ]);
        onlyBatch.forEach((b, bi) =>
            b.forEach((ch, ci) =>
                ch.forEach((v, si) => expect(v).toBeCloseTo(bn[bi]![ci]![si]!, 10)),
            ),
        );
        expect(normalizeWeights([0, 0, 0]).reduce((s, w) => s + w, 0)).toBeCloseTo(1, 10);
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
