/**
 * gemma-3n.test.ts - Independent recomputation, AltUp and rank-one
 * properties, frame shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod, { gemma3n } from "./gemma-3n";
import type { VisualFrame } from "@/types";

const STATES = new Set(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]);

function reference(tokenId: number, layers: number, d: number, rankScale: number) {
    let a = new Array(d).fill(0);
    let b = new Array(d).fill(0);
    const embeddings: number[][] = [];
    const perLayer = [a.map((v, i) => v + b[i])];
    for (let layer = 0; layer < layers; layer += 1) {
        const emb = Array.from({ length: d }, (_, i) => Math.sin((tokenId + 1) * (i + 1) + layer * 0.5));
        const u = Array.from({ length: d }, (_, i) => Math.sin(layer + i) * rankScale);
        const v = Array.from({ length: d }, (_, i) => Math.cos(layer + i));
        const dotB = b.reduce((s, val, i) => s + val * v[i], 0);
        if (layer % 2 === 0) {
            a = a.map((val, i) => val + emb[i] + u[i] * dotB);
        } else {
            const dotA = a.reduce((s, val, i) => s + val * v[i], 0);
            b = b.map((val, i) => val + emb[i] + u[i] * dotA);
        }
        embeddings.push(emb);
        perLayer.push(a.map((val, i) => val + b[i]));
    }
    return { embeddings, perLayer, output: a.map((val, i) => val + b[i]) };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        for (const entity of frame.entities) expect(STATES.has(entity.state)).toBe(true);
    });
}

describe("Gemma 3n core", () => {
    it("matches an independent per-layer computation", () => {
        for (let seed = 0; seed < 12; seed += 1) {
            const params = { tokenId: seed % 5, layers: 2 + (seed % 5), dim: 2 + (seed % 4), rankScale: 0.5 + seed / 10 };
            const got = gemma3n(params.tokenId, params);
            const ref = reference(params.tokenId, params.layers, params.dim, params.rankScale);
            for (let i = 0; i < got.embeddings.length; i += 1) {
                for (let j = 0; j < got.embeddings[i].length; j += 1) {
                    expect(got.embeddings[i][j]).toBeCloseTo(ref.embeddings[i][j], 10);
                }
            }
            for (let i = 0; i < got.perLayer.length; i += 1) {
                for (let j = 0; j < got.perLayer[i].length; j += 1) {
                    expect(got.perLayer[i][j]).toBeCloseTo(ref.perLayer[i][j], 10);
                }
            }
            expect(got.output.length).toBe(params.dim);
        }
    });

    it("removes the low-rank residual at scale zero and keeps layers distinct", () => {
        const plain = gemma3n(3, { layers: 4, dim: 4, rankScale: 0 });
        const noRank = reference(3, 4, 4, 0);
        for (let i = 0; i < plain.output.length; i += 1) expect(plain.output[i]).toBeCloseTo(noRank.output[i], 10);
        expect(plain.embeddings[0]).not.toEqual(plain.embeddings[1]);
    });

    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const input = mod.defaultInput as { layers: number };
        expect(frames.length).toBe(2 + input.layers);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBe(frames.length);
        expect(generator.next().done).toBe(true);
    });
});
