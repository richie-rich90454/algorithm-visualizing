/**
 * rotary-position-embedding.test.ts - Rotation identities, relative-position property, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod, { ropeRotate, ropeScores } from "./rotary-position-embedding";
import type { VisualFrame } from "@/types";

type Input = { vectors: number[][]; startPosition: number; base: number };

const norm = (v: number[]): number => Math.sqrt(v.reduce((s, x) => s + x * x, 0));
const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("RotaryPositionEmbedding", () => {
    it("preserves the norm of every rotated vector", () => {
        const vectors = [[1, 0, 1, 0], [0.3, -1.2, 2, 0.5], [-1, 1, -1, 1]];
        for (const vec of vectors) {
            for (const position of [-3, 0, 1, 7, 100]) {
                expect(norm(ropeRotate(vec, position))).toBeCloseTo(norm(vec), 9);
            }
        }
    });

    it("composes rotations by adding positions", () => {
        const vec = [1.3, -0.7, 0.2, 2.1, -1, 0.4];
        const m = 3;
        const n = 5;
        const twice = ropeRotate(ropeRotate(vec, m), n);
        const once = ropeRotate(vec, m + n);
        twice.forEach((v, i) => expect(v).toBeCloseTo(once[i] ?? 0, 9));
    });

    it("encodes only relative position in query-key dot products", () => {
        const q = [1, 0.5, -0.3, 0.8];
        const k = [-0.2, 1.1, 0.7, -0.6];
        for (const m of [0, 2, 10]) {
            for (const n of [0, 1, 5, 12]) {
                const rotated = dot(ropeRotate(q, m), ropeRotate(k, n));
                const relative = dot(q, ropeRotate(k, n - m));
                expect(rotated).toBeCloseTo(relative, 9);
            }
        }
    });

    it("matches an independent score computation in the frames", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = ropeScores(input.vectors, input.vectors, input.startPosition, input.base).flat();
        const metaScores = frames[frames.length - 1]?.meta["scores"] as number[];
        expect(metaScores).toHaveLength(expected.length);
        expected.forEach((v, i) => expect(metaScores[i] ?? 0).toBeCloseTo(v, 9));
        const freqs = frames[0]?.meta["freqs"] as number[];
        expect(freqs).toHaveLength(2);
        expect(freqs[0]).toBeCloseTo(1, 12);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
