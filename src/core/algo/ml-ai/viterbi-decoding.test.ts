/**
 * viterbi-decoding.test.ts - Brute-force path enumeration, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./viterbi-decoding";
import type { VisualFrame } from "@/types";

interface Hmm {
    states: string[];
    observations: string[];
    start: number[];
    trans: number[][];
    emit: number[][];
}

function checkFrames(frames: VisualFrame[], S: number, T: number): void {
    expect(frames.length).toBe(T + 2);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(S * T);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.meta["rows"]).toBe(S);
        expect(frame.meta["cols"]).toBe(T);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function bruteForce(cfg: Hmm): { prob: number; path: number[] } {
    const S = cfg.states.length;
    const T = cfg.observations.length;
    let bestProb = -1;
    let bestPath: number[] = [];
    const path = new Array<number>(T).fill(0);
    const walk = (t: number, prob: number): void => {
        if (t === T) {
            if (prob > bestProb) {
                bestProb = prob;
                bestPath = [...path];
            }
            return;
        }
        for (let s = 0; s < S; s += 1) {
            const step = t === 0 ? (cfg.start[s] ?? 0) : (cfg.trans[path[t - 1] ?? 0]?.[s] ?? 0);
            const emission = cfg.emit[s]?.[t] ?? 0;
            path[t] = s;
            walk(t + 1, prob * step * emission);
        }
    };
    walk(0, 1);
    return { prob: bestProb, path: bestPath };
}

describe("ViterbiDecoding", () => {
    it("matches exhaustive enumeration on the default model", () => {
        const cfg = mod.defaultInput as Hmm;
        const frames = [...mod.run(cfg)];
        checkFrames(frames, cfg.states.length, cfg.observations.length);
        const final = frames[frames.length - 1];
        const expected = bruteForce(cfg);
        expect(Number(final?.meta["bestProb"])).toBeCloseTo(expected.prob, 6);
        expect(final?.meta["bestPath"]).toEqual(expected.path);
    });

    it("matches exhaustive enumeration on random small models", () => {
        const models: Hmm[] = [
            {
                states: ["A", "B", "C"],
                observations: ["x", "y", "z", "w"],
                start: [0.2, 0.5, 0.3],
                trans: [
                    [0.6, 0.2, 0.2],
                    [0.1, 0.7, 0.2],
                    [0.3, 0.3, 0.4],
                ],
                emit: [
                    [0.4, 0.3, 0.2, 0.1],
                    [0.1, 0.2, 0.4, 0.3],
                    [0.25, 0.25, 0.25, 0.25],
                ],
            },
            {
                states: ["X", "Y"],
                observations: ["a", "b", "c", "d", "e"],
                start: [0.5, 0.5],
                trans: [
                    [0.8, 0.2],
                    [0.3, 0.7],
                ],
                emit: [
                    [0.5, 0.2, 0.1, 0.1, 0.1],
                    [0.1, 0.1, 0.2, 0.2, 0.4],
                ],
            },
        ];
        for (const cfg of models) {
            const frames = [...mod.run(cfg)];
            checkFrames(frames, cfg.states.length, cfg.observations.length);
            const final = frames[frames.length - 1];
            const expected = bruteForce(cfg);
            expect(Number(final?.meta["bestProb"])).toBeCloseTo(expected.prob, 6);
            expect(final?.meta["bestPath"]).toEqual(expected.path);
        }
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
