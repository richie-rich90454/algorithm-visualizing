/** natural-policy-gradient.test.ts - Fisher solve, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod, { naturalPolicyGradient } from "./natural-policy-gradient";
import type { VisualFrame } from "@/types";

interface Input {
    features: number[][];
    theta: number[];
    advantages: number[];
    stepSize: number;
    damping: number;
}

function checkFrames(frames: VisualFrame[], rows: number, cols: number): void {
    expect(frames.length).toBe(rows + 2);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(rows * cols);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta["rows"]).toBe(rows);
    });
}

function solve(A: number[][], b: number[]): number[] {
    const n = b.length;
    const m = A.map((row, i) => [...row, b[i] ?? 0]);
    for (let col = 0; col < n; col += 1) {
        let p = col;
        for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[p]?.[col] ?? 0)) p = r;
        [m[col], m[p]] = [m[p] ?? [], m[col] ?? []];
        const pivot = m[col]?.[col] ?? 1;
        for (let c = col; c <= n; c += 1) m[col]![c] = (m[col]![c] ?? 0) / pivot;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const f = m[r]?.[col] ?? 0;
            for (let c = col; c <= n; c += 1) m[r]![c] = (m[r]![c] ?? 0) - f * (m[col]![c] ?? 0);
        }
    }
    return m.map((row) => row[n] ?? 0);
}

describe("Natural Policy Gradient", () => {
    const input = mod.defaultInput as Input;

    it("produces a step satisfying Fisher times step equals step-size times gradient", () => {
        const frames = [...mod.run(input)];
        checkFrames(frames, input.features.length, 4);
        const result = naturalPolicyGradient(input);
        const got = frames[frames.length - 1]?.meta["step"] as number[];
        got.forEach((v, i) => expect(v).toBeCloseTo(result.step[i] ?? 0, 12));
        const d = input.theta.length;
        for (let i = 0; i < d; i += 1) {
            let acc = 0;
            for (let j = 0; j < d; j += 1) acc += (result.fisher[i]?.[j] ?? 0) * (got[j] ?? 0);
            expect(acc).toBeCloseTo(input.stepSize * (result.gradient[i] ?? 0), 8);
        }
    });

    it("matches an independent Fisher construction and solve", () => {
        const result = naturalPolicyGradient(input);
        const scores = input.features.map((f) => f.reduce((a, v, i) => a + v * (input.theta[i] ?? 0), 0));
        const max = Math.max(...scores);
        const exps = scores.map((s) => Math.exp(s - max));
        const sum = exps.reduce((a, b) => a + b, 0);
        const probs = exps.map((e) => e / sum);
        expect(probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
        probs.forEach((p, i) => expect(result.probs[i]).toBeCloseTo(p, 12));
        const d = input.theta.length;
        const mean = new Array(d).fill(0);
        input.features.forEach((f, a) => f.forEach((v, i) => { mean[i] = (mean[i] ?? 0) + probs[a]! * v; }));
        const F = Array.from({ length: d }, () => new Array(d).fill(0));
        const g = new Array(d).fill(0);
        input.features.forEach((f, a) => {
            const sf = f.map((v, i) => v - mean[i]!);
            sf.forEach((si, i) => {
                g[i] = g[i]! + probs[a]! * input.advantages[a]! * si;
                sf.forEach((sj, j) => { F[i]![j] = F[i]![j]! + probs[a]! * si * sj; });
            });
        });
        for (let i = 0; i < d; i += 1) F[i]![i] += input.damping;
        const expected = solve(F, g).map((v) => input.stepSize * v);
        expected.forEach((v, i) => expect(result.step[i]).toBeCloseTo(v, 10));
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
