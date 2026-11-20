/** latent-semantic-analysis.test.ts - TF-IDF and LSA property checks. */

import { describe, expect, it } from "vitest";
import mod, {
    buildTfidf,
    cosine,
    lsaBasis,
    lsaDocumentVectors,
} from "./latent-semantic-analysis";
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

describe("Latent Semantic Analysis", () => {
    it("TF-IDF matches a direct term-count and document-frequency computation", () => {
        const docs = [
            ["a", "a", "b"],
            ["b", "c"],
            ["a", "c", "c"],
        ];
        const { matrix, vocab, idf } = buildTfidf(docs);
        expect(vocab).toEqual(["a", "b", "c"]);
        const df = [2, 2, 2];
        const expectedIdf = df.map((d) => Math.log(3 / (1 + d)) + 1);
        idf.forEach((v, i) => expect(v).toBeCloseTo(expectedIdf[i]!, 10));
        for (let d = 0; d < docs.length; d += 1) {
            for (let t = 0; t < vocab.length; t += 1) {
                const count = docs[d]!.filter((x) => x === vocab[t]).length;
                const expected = count > 0 ? (1 + Math.log(count)) * expectedIdf[t]! : 0;
                expect(matrix[d]![t]).toBeCloseTo(expected, 10);
            }
        }
    });

    it("latent basis is orthonormal and captures the top singular direction", () => {
        const matrix = [
            [3, 3, 0, 0],
            [4, 4, 0, 0],
            [0, 0, 2, 2],
            [0, 0, 1, 1],
        ];
        const basis = lsaBasis(matrix, 2, 200, 1);
        expect(basis.length).toBe(2);
        for (let i = 0; i < 2; i += 1) {
            const norm = Math.sqrt(basis[i]!.reduce((s, x) => s + x * x, 0));
            expect(norm).toBeCloseTo(1, 6);
        }
        const dot = basis[0]!.reduce((s, x, j) => s + x * basis[1]![j]!, 0);
        expect(dot).toBeCloseTo(0, 6);
        const vectors = lsaDocumentVectors(matrix, basis);
        expect(vectors.length).toBe(4);
        expect(cosine(vectors[0]!, vectors[1]!)).toBeGreaterThan(0.99);
        expect(cosine(vectors[0]!, vectors[2]!)).toBeLessThan(0.2);
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
