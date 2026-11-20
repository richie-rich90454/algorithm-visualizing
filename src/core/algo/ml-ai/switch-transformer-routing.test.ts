/**
 * switch-transformer-routing.test.ts - Independent router, capacity, and
 * auxiliary-loss reference, frame shape, and termination checks.
 */

import { describe, expect, it } from "vitest";
import mod from "./switch-transformer-routing";
import type { VisualFrame } from "@/types";

function weightStream(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return Math.round(((state / 4294967296) * 2 - 1) * 100) / 100;
    };
}

function reference(tokens: number[][], E: number, capacityFactor: number, seed: number) {
    const d = tokens[0]?.length ?? 0;
    const n = tokens.length;
    const next = weightStream(seed);
    const W = Array.from({ length: d }, () => Array.from({ length: E }, next));
    const logits = tokens.map((row) => Array.from({ length: E }, (_u, e) => row.reduce((s, x, k) => s + x * (W[k]?.[e] ?? 0), 0)));
    const probs = logits.map((row) => {
        const max = Math.max(...row);
        const exp = row.map((v) => Math.exp(v - max));
        const denom = exp.reduce((a, b) => a + b, 0);
        return exp.map((v) => v / denom);
    });
    const capacity = Math.max(1, Math.ceil((n * capacityFactor) / E));
    const counts = Array(E).fill(0) as number[];
    const chosen: number[] = [];
    const dropped: boolean[] = [];
    for (let i = 0; i < n; i += 1) {
        const row = probs[i] ?? [];
        let best = 0;
        for (let e = 1; e < E; e += 1) if ((row[e] ?? 0) > (row[best] ?? 0)) best = e;
        chosen.push(best);
        if ((counts[best] ?? 0) >= capacity) dropped.push(true);
        else {
            counts[best] = (counts[best] ?? 0) + 1;
            dropped.push(false);
        }
    }
    const tokenFraction = counts.map((c) => c / n);
    const probFraction = Array.from({ length: E }, (_u, e) => probs.reduce((s, row) => s + (row[e] ?? 0), 0) / n);
    const auxLoss = E * tokenFraction.reduce((s, f, e) => s + f * (probFraction[e] ?? 0), 0);
    return { logits, probs, capacity, counts, chosen, dropped, tokenFraction, probFraction, auxLoss };
}

function checkFrames(frames: VisualFrame[], n: number, E: number): void {
    expect(frames.length).toBe(3);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * E);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(n);
        expect(frame.meta["cols"]).toBe(E);
    });
}

describe("SwitchTransformerRouting", () => {
    const tokens = [
        [1, 0],
        [0, 1],
        [1, 1],
        [2, 0],
        [0, 2],
        [1, 2],
    ];

    it("matches an independent router and load-balancing loss", () => {
        const input = { tokens, experts: 3, capacityFactor: 1, seed: 13 };
        const frames = [...mod.run(input)];
        checkFrames(frames, 6, 3);
        const expected = reference(tokens, 3, 1, 13);
        const final = frames[frames.length - 1];
        (frames[0]?.meta["logits"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.logits.flat()[i] ?? 0, 9));
        (frames[1]?.meta["probs"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.probs.flat()[i] ?? 0, 9));
        expect(final?.meta["chosen"]).toEqual(expected.chosen);
        expect(final?.meta["dropped"]).toEqual(expected.dropped.map((d) => (d ? 1 : 0)));
        expect(final?.meta["counts"]).toEqual(expected.counts);
        (final?.meta["tokenFraction"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.tokenFraction[i] ?? 0, 9));
        (final?.meta["probFraction"] as number[]).forEach((v, i) => expect(v).toBeCloseTo(expected.probFraction[i] ?? 0, 9));
        expect(Number(final?.meta["auxLoss"])).toBeCloseTo(expected.auxLoss, 9);
    });

    it("respects capacity and keeps probability invariants across settings", () => {
        for (const experts of [2, 3, 4]) {
            for (const capacityFactor of [0.5, 1, 2]) {
                const frames = [...mod.run({ tokens, experts, capacityFactor, seed: 4 })];
                checkFrames(frames, 6, experts);
                const final = frames[frames.length - 1];
                const counts = final?.meta["counts"] as number[];
                const capacity = Number(final?.meta["capacity"]);
                counts.forEach((c) => expect(c).toBeLessThanOrEqual(capacity));
                const chosen = final?.meta["chosen"] as number[];
                chosen.forEach((e) => {
                    expect(e).toBeGreaterThanOrEqual(0);
                    expect(e).toBeLessThan(experts);
                });
                const probs = final?.meta["probs"] as number[];
                for (let i = 0; i < 6; i += 1) {
                    const sum = probs.slice(i * experts, (i + 1) * experts).reduce((a, b) => a + b, 0);
                    expect(sum).toBeCloseTo(1, 9);
                }
                const probFraction = final?.meta["probFraction"] as number[];
                expect(probFraction.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
                expect(Number(final?.meta["auxLoss"])).toBeGreaterThanOrEqual(0);
                expect(Number(final?.meta["auxLoss"])).toBeLessThanOrEqual(experts);
            }
        }
    });

    it("reports drops only when capacity is binding", () => {
        const generous = [...mod.run({ tokens, experts: 3, capacityFactor: 3, seed: 13 })];
        expect((generous[2]?.meta["dropped"] as number[]).some((v) => v === 1)).toBe(false);
        const tight = [...mod.run({ tokens, experts: 3, capacityFactor: 0.34, seed: 13 })];
        expect((tight[2]?.meta["dropped"] as number[]).some((v) => v === 1)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
