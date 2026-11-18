/** independent-component-analysis.test.ts - Fixed-point replay, orthonormality, recovery. */

import { describe, expect, it } from "vitest";
import mod, { fastIca } from "./independent-component-analysis";
import type { VisualFrame } from "@/types";

interface Input {
    samples: number[][];
    components: number;
    maxIter: number;
}

const dot = (a: number[], b: number[]): number => a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
const norm = (w: number[]): number => Math.sqrt(dot(w, w)) || 1;

/** Independent replay of the FastICA loop used only for verification. */
function replay(X: number[][], components: number, maxIter: number): number[][] {
    const dim = X[0]?.length ?? 0;
    const found: number[][] = [];
    for (let c = 0; c < components; c += 1) {
        let w: number[] = Array.from({ length: dim }, (_, i) => (i === c ? 1 : 0.1));
        const n0 = norm(w);
        w = w.map((v) => v / n0);
        for (let iter = 0; iter < maxIter; iter += 1) {
            const proj = X.map((row) => dot(row, w));
            const cubic = Array(dim).fill(0) as number[];
            X.forEach((row, i) => {
                const f = (proj[i] ?? 0) ** 3;
                row.forEach((v, j) => {
                    cubic[j] = (cubic[j] ?? 0) + v * f;
                });
            });
            const meanCube = cubic.map((v) => v / X.length);
            const meanSq = proj.reduce((s, p) => s + p * p, 0) / X.length;
            let next = meanCube.map((v, j) => v - 3 * meanSq * (w[j] ?? 0));
            for (const prior of found) {
                const overlap = dot(next, prior);
                next = next.map((v, j) => v - overlap * (prior[j] ?? 0));
            }
            const n1 = norm(next);
            next = next.map((v) => v / n1);
            const delta = 1 - Math.abs(dot(next, w));
            w = next;
            if (delta < 1e-6) break;
        }
        found.push(w);
    }
    return found;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThan(0);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("Independent Component Analysis", () => {
    it("matches an independent fixed-point replay", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const got = fastIca(input.samples, input.components, input.maxIter).components;
        const expected = replay(input.samples, input.components, input.maxIter);
        got.forEach((w, i) => {
            const sign = dot(w, expected[i] ?? []) < 0 ? -1 : 1;
            w.forEach((value, j) => {
                expect(value * sign).toBeCloseTo(expected[i]?.[j] ?? 0, 8);
            });
        });
    });

    it("keeps recovered directions unit length and decorrelated", () => {
        const input = mod.defaultInput as Input;
        const result = fastIca(input.samples, input.components, input.maxIter);
        result.components.forEach((w) => {
            expect(norm(w)).toBeCloseTo(1, 9);
        });
        if (result.components.length === 2) {
            const [a, b] = result.components as [number[], number[]];
            expect(Math.abs(dot(a, b))).toBeLessThan(1e-6);
        }
    });

    it("recovers rotated independent sources from synthetic whitened data", () => {
        let state = 123456789;
        const rng = (): number => {
            state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
            return state / 4294967296;
        };
        const m = 1200;
        const sources: number[][] = [];
        for (let i = 0; i < m; i += 1) {
            const laplace = -Math.sign(rng() - 0.5) * Math.log(Math.max(1e-9, rng()));
            const uniform = (rng() - 0.5) * 2 * Math.sqrt(3);
            sources.push([laplace, uniform]);
        }
        const cos = Math.cos(0.6);
        const sin = Math.sin(0.6);
        const X = sources.map(([a, b]) => [a * cos - b * sin, a * sin + b * cos]);
        const result = fastIca(X, 2, 200);
        const ics = [0, 1].map((c) => X.map((row) => dot(row, result.components[c] ?? [])));
        const correlation = (a: number[], b: number[]): number => {
            const ma = a.reduce((s, v) => s + v, 0) / a.length;
            const mb = b.reduce((s, v) => s + v, 0) / b.length;
            let num = 0;
            let da = 0;
            let db = 0;
            for (let i = 0; i < a.length; i += 1) {
                const x = (a[i] ?? 0) - ma;
                const y = (b[i] ?? 0) - mb;
                num += x * y;
                da += x * x;
                db += y * y;
            }
            return Math.abs(num) / (Math.sqrt(da * db) || 1);
        };
        for (const component of ics) {
            const best = Math.max(
                correlation(component, sources.map((s) => s[0] ?? 0)),
                correlation(component, sources.map((s) => s[1] ?? 0)),
            );
            expect(best).toBeGreaterThan(0.9);
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
