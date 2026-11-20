/** glove.test.ts - Co-occurrence reference, loss reference, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { gloveCooccurrence, gloveEmbeddings, gloveLoss } from "./glove";
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

describe("GloVe", () => {
    it("co-occurrence counts match an independent double loop and are symmetric", () => {
        const corpus = [
            ["a", "b", "a"],
            ["b", "c", "a"],
        ];
        const { vocab, matrix } = gloveCooccurrence(corpus, 1);
        expect(vocab).toEqual(["a", "b", "c"]);
        const expected = [
            [0, 2, 1],
            [2, 0, 1],
            [1, 1, 0],
        ];
        for (let i = 0; i < 3; i += 1) {
            for (let j = 0; j < 3; j += 1) {
                expect(matrix[i]![j]).toBe(expected[i]![j]);
                expect(matrix[i]![j]).toBe(matrix[j]![i]);
            }
        }
    });

    it("loss matches a direct weighted summation and decreases during training", () => {
        const { matrix } = gloveCooccurrence(
            [
                ["a", "b", "c"],
                ["a", "b", "d"],
                ["b", "c", "d"],
            ],
            2,
        );
        const fit = gloveEmbeddings(matrix, 2, 25, 0.5, 3);
        const direct = gloveLoss(matrix, fit.embeddings, fit.biases);
        expect(fit.losses[fit.losses.length - 1]).toBeCloseTo(direct, 10);
        expect(fit.losses[fit.losses.length - 1]!).toBeLessThan(fit.losses[0]!);
        for (let i = 1; i < fit.losses.length; i += 1) {
            expect(fit.losses[i]!).toBeLessThanOrEqual(fit.losses[i - 1]! + 1e-9);
        }
    });

    it("produces well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const final = frames[frames.length - 1]!;
        expect(final.meta["converged"]).toBe(true);
        const gen = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of gen) count += 1;
        expect(count).toBe(frames.length);
        expect(gen.next().done).toBe(true);
    });
});
