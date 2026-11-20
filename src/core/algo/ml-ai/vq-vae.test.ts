/** vq-vae.test.ts - Brute-force nearest code, commitment loss, permutation invariance, frame shape. */

import { describe, expect, it } from "vitest";
import mod from "./vq-vae";
import type { VisualFrame } from "@/types";

interface Input {
    zE: number[];
    codebook: number[][];
    beta: number;
}

function reference(input: Input) {
    const distances = input.codebook.map((c) => (input.zE[0]! - c[0]!) ** 2 + (input.zE[1]! - c[1]!) ** 2);
    let nearest = 0;
    for (let k = 1; k < distances.length; k += 1) {
        if (distances[k]! < distances[nearest]!) {
            nearest = k;
        }
    }
    return {
        distances,
        nearest,
        zQ: input.codebook[nearest]!,
        commitmentLoss: (1 + input.beta) * distances[nearest]!,
    };
}

function checkFrames(frames: VisualFrame[], codeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    expect(frames[1]?.entities.length).toBe(codeCount);
}

describe("VQ-VAE codebook quantization", () => {
    const cases: Input[] = [
        { zE: [1.1, -0.2], codebook: [[0, 0], [1, 0], [0, 1], [1, 1]], beta: 0.25 },
        { zE: [0, 0], codebook: [[0, 0], [5, 5]], beta: 0 },
        { zE: [-2, 3], codebook: [[-2, 3], [-2, 2], [-1, 3]], beta: 1.5 },
        mod.defaultInput as Input,
    ];

    it("matches a brute-force nearest-code search", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.codebook.length);
            const expected = reference(input);
            const final = frames[frames.length - 1]?.meta;
            expect(Number(final?.["nearest"])).toBe(expected.nearest);
            const zQ = final?.["zQ"] as number[];
            zQ.forEach((v, i) => expect(v).toBeCloseTo(expected.zQ[i]!, 9));
            const distances = final?.["distances"] as number[];
            distances.forEach((v, i) => expect(v).toBeCloseTo(expected.distances[i]!, 9));
            expect(Number(final?.["commitmentLoss"])).toBeCloseTo(expected.commitmentLoss, 9);
        }
    });

    it("is invariant to reordering the codebook", () => {
        const input = cases[0]!;
        const reordered: Input = {
            zE: input.zE,
            codebook: [input.codebook[2]!, input.codebook[0]!, input.codebook[3]!, input.codebook[1]!],
            beta: input.beta,
        };
        const a = [...mod.run(input)].at(-1)?.meta;
        const b = [...mod.run(reordered)].at(-1)?.meta;
        expect((a?.["zQ"] as number[])[0]).toBeCloseTo((b?.["zQ"] as number[])[0]!, 9);
        expect((a?.["zQ"] as number[])[1]).toBeCloseTo((b?.["zQ"] as number[])[1]!, 9);
        expect(Number(a?.["commitmentLoss"])).toBeCloseTo(Number(b?.["commitmentLoss"]), 9);
    });

    it("breaks ties by the lowest index", () => {
        const input: Input = { zE: [0.5, 0.5], codebook: [[0, 0], [1, 1]], beta: 0.5 };
        const final = [...mod.run(input)].at(-1)?.meta;
        expect(Number(final?.["nearest"])).toBe(0);
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
