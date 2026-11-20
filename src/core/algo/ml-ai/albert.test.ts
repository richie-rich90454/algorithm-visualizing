/**
 * albert.test.ts - Independent reference correctness, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./albert";
import type { VisualFrame } from "@/types";

interface AlbertInput {
    tokenIds: number[];
    vocabSize: number;
    embeddingSize: number;
    hiddenSize: number;
    layers: number;
}

type Matrix = number[][];

function embedFactor(token: number, component: number): number {
    return ((token + 1) * (component + 3)) % 5 - 2;
}

function projectionFactor(component: number, hidden: number): number {
    return ((component + 2) * (hidden + 1)) % 5 - 2;
}

function layerWeight(from: number, to: number): number {
    return ((from + 1) * (to + 1)) % 3 - 1;
}

function referenceEmbedding(tokenIds: number[], E: number, H: number): Matrix {
    return tokenIds.map((token) => {
        const hidden = new Array<number>(H).fill(0);
        for (let component = 0; component < E; component += 1) {
            for (let h = 0; h < H; h += 1) {
                hidden[h] = (hidden[h] ?? 0) + embedFactor(token, component) * projectionFactor(component, h);
            }
        }
        return hidden;
    });
}

function referenceLayer(state: Matrix, H: number): Matrix {
    const scale = Math.sqrt(Math.max(1, H));
    return state.map((hidden) => {
        const next = new Array<number>(H).fill(0);
        for (let to = 0; to < H; to += 1) {
            let sum = 0;
            for (let from = 0; from < H; from += 1) {
                sum += (hidden[from] ?? 0) * layerWeight(from, to);
            }
            next[to] = Math.tanh(sum / scale);
        }
        return next;
    });
}

function reference(cfg: AlbertInput) {
    const traces: Matrix[] = [referenceEmbedding(cfg.tokenIds, cfg.embeddingSize, cfg.hiddenSize)];
    for (let depth = 0; depth < cfg.layers; depth += 1) {
        traces.push(referenceLayer(traces[traces.length - 1] ?? [], cfg.hiddenSize));
    }
    return {
        traces,
        factorizedEmbeddingParams: cfg.vocabSize * cfg.embeddingSize + cfg.embeddingSize * cfg.hiddenSize,
        directEmbeddingParams: cfg.vocabSize * cfg.hiddenSize,
        sharedEncoderParams: cfg.hiddenSize * cfg.hiddenSize,
        unsharedEncoderParams: cfg.layers * cfg.hiddenSize * cfg.hiddenSize,
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe(mod.visualType);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
        expect(Number(frame.meta["rows"])).toBeGreaterThan(0);
        expect(Number(frame.meta["cols"])).toBeGreaterThan(0);
    });
}

describe("ALBERT factorized embedding and shared weights", () => {
    it("matches an independent embedding, shared-layer, and parameter reference", () => {
        const cfg: AlbertInput = {
            tokenIds: [4, 7, 2, 9, 1],
            vocabSize: 1000,
            embeddingSize: 4,
            hiddenSize: 5,
            layers: 3,
        };
        const frames = [...mod.run(cfg)];
        checkFrames(frames);
        const expected = reference(cfg);
        const summary = frames[frames.length - 1]?.meta;
        const traces = summary?.["traces"] as Matrix[];
        expect(traces.length).toBe(cfg.layers + 1);
        for (let depth = 0; depth < traces.length; depth += 1) {
            for (let row = 0; row < (traces[depth] as Matrix).length; row += 1) {
                for (let col = 0; col < (traces[depth]?.[row]?.length ?? 0); col += 1) {
                    expect((traces[depth]?.[row] ?? [])[col] ?? 0).toBeCloseTo(expected.traces[depth]?.[row]?.[col] ?? 0, 9);
                }
            }
        }
        expect(Number(summary?.["factorizedEmbeddingParams"])).toBe(expected.factorizedEmbeddingParams);
        expect(Number(summary?.["directEmbeddingParams"])).toBe(expected.directEmbeddingParams);
        expect(Number(summary?.["sharedEncoderParams"])).toBe(expected.sharedEncoderParams);
        expect(Number(summary?.["unsharedEncoderParams"])).toBe(expected.unsharedEncoderParams);
        expect(Number(summary?.["totalParams"])).toBe(
            expected.factorizedEmbeddingParams + expected.sharedEncoderParams,
        );
    });

    it("satisfies sharing and bounded-output properties", () => {
        const cfg: AlbertInput = {
            tokenIds: [3, 5, 8],
            vocabSize: 30000,
            embeddingSize: 8,
            hiddenSize: 64,
            layers: 4,
        };
        const frames = [...mod.run(cfg)];
        const summary = frames[frames.length - 1]?.meta;
        expect(Number(summary?.["directEmbeddingParams"])).toBeGreaterThan(Number(summary?.["factorizedEmbeddingParams"]));
        expect(Number(summary?.["sharedEncoderParams"])).toBe(cfg.hiddenSize * cfg.hiddenSize);
        expect(Number(summary?.["totalSaving"])).toBeGreaterThan(0);
        const traces = summary?.["traces"] as Matrix[];
        for (let depth = 1; depth < traces.length; depth += 1) {
            for (const row of traces[depth] ?? []) {
                for (const value of row ?? []) {
                    expect(value).toBeGreaterThanOrEqual(-1);
                    expect(value).toBeLessThanOrEqual(1);
                }
            }
        }
    });

    it("is deterministic and changes with the token ids", () => {
        const base = { vocabSize: 1000, embeddingSize: 4, hiddenSize: 4, layers: 3 };
        const a = [...mod.run({ ...base, tokenIds: [1, 2, 3] })][0]?.meta["values"];
        const b = [...mod.run({ ...base, tokenIds: [1, 2, 3] })][0]?.meta["values"];
        const c = [...mod.run({ ...base, tokenIds: [9, 8, 7] })][0]?.meta["values"];
        expect(a).toEqual(b);
        expect(a).not.toEqual(c);
    });

    it("emits one trace frame per depth plus the summary", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBe(3 + 2);
        expect(frames[0]?.meta["phase"]).toBe("embedding");
        expect(frames[frames.length - 2]?.meta["phase"]).toBe("shared-layer");
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
