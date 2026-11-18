/**
 * test-time-training.test.ts - Independent gradient-step reference, loss
 * descent property, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./test-time-training";
import type { VisualFrame } from "@/types";

function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

function reference(tokens: number[][], eta: number, seed: number) {
    const d = tokens[0]?.length ?? 0;
    const next = weightStream(seed);
    const make = (): number[][] => Array.from({ length: d }, () => Array.from({ length: d }, next));
    const Wk = make();
    const Wq = make();
    const Wv = make();
    const mv = (m: number[][], v: number[]): number[] => m.map((row) => row.reduce((s, x, i) => s + x * (v[i] ?? 0), 0));
    let W: number[][] = Array.from({ length: d }, () => Array(d).fill(0));
    const records: Array<{ z: number[]; target: number[]; predBefore: number[]; predAfter: number[]; lossBefore: number; lossAfter: number; output: number[]; W: number[] }> = [];
    for (const x of tokens) {
        const z = mv(Wk, x);
        const target = mv(Wv, x);
        const predBefore = mv(W, z);
        const lossBefore = predBefore.reduce((s, v, k) => s + (v - (target[k] ?? 0)) ** 2, 0);
        W = W.map((row, r) => row.map((value, k) => value - eta * ((predBefore[r] ?? 0) - (target[r] ?? 0)) * (z[k] ?? 0)));
        const predAfter = mv(W, z);
        const lossAfter = predAfter.reduce((s, v, k) => s + (v - (target[k] ?? 0)) ** 2, 0);
        const output = mv(Wq, predAfter);
        records.push({ z, target, predBefore, predAfter, lossBefore, lossAfter, output, W: W.flat() });
    }
    return { Wk, Wq, Wv, records };
}

function checkFrames(frames: VisualFrame[], d: number): void {
    expect(frames.length).toBe(4);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(d * d);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(d);
        expect(frame.meta["cols"]).toBe(d);
    });
}

describe("TestTimeTraining", () => {
    const tokens = [
        [1, 0],
        [0, 1],
        [1, 1],
    ];

    it("matches an independent gradient-step computation at every token", () => {
        const frames = [...mod.run({ tokens, eta: 0.05, seed: 3 })];
        checkFrames(frames, 2);
        const expected = reference(tokens, 0.05, 3);
        for (let i = 0; i < tokens.length; i += 1) {
            const frame = frames[i + 1];
            const rec = expected.records[i];
            expect(frame?.meta["tokenIndex"]).toBe(i);
            (frame?.meta["z"] as number[]).forEach((v, idx) => expect(v).toBeCloseTo(rec?.z[idx] ?? 0, 9));
            (frame?.meta["target"] as number[]).forEach((v, idx) => expect(v).toBeCloseTo(rec?.target[idx] ?? 0, 9));
            (frame?.meta["predBefore"] as number[]).forEach((v, idx) => expect(v).toBeCloseTo(rec?.predBefore[idx] ?? 0, 9));
            (frame?.meta["predAfter"] as number[]).forEach((v, idx) => expect(v).toBeCloseTo(rec?.predAfter[idx] ?? 0, 9));
            (frame?.meta["output"] as number[]).forEach((v, idx) => expect(v).toBeCloseTo(rec?.output[idx] ?? 0, 9));
            (frame?.meta["W"] as number[]).forEach((v, idx) => expect(v).toBeCloseTo(rec?.W[idx] ?? 0, 9));
            expect(Number(frame?.meta["lossBefore"])).toBeCloseTo(rec?.lossBefore ?? 0, 9);
            expect(Number(frame?.meta["lossAfter"])).toBeCloseTo(rec?.lossAfter ?? 0, 9);
        }
    });

    it("never increases the reconstruction loss for a small step size", () => {
        for (const seed of [1, 3, 9, 21]) {
            const frames = [...mod.run({ tokens, eta: 0.02, seed })];
            for (const frame of frames.slice(1)) {
                expect(Number(frame.meta["lossAfter"])).toBeLessThanOrEqual(Number(frame.meta["lossBefore"]) + 1e-12);
            }
        }
    });

    it("reports fixed projections in metadata", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const weights = JSON.parse(String(frames[0]?.meta["weights"]));
        expect(weights.Wk.length).toBe(2);
        expect(weights.Wq.length).toBe(2);
        expect(weights.Wv.length).toBe(2);
        const expected = reference(tokens, 0.05, 3);
        expect(weights.Wk).toEqual(expected.Wk);
        expect(weights.Wq).toEqual(expected.Wq);
        expect(weights.Wv).toEqual(expected.Wv);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
