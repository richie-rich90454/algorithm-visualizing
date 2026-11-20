/**
 * hellinger-distance.test.ts - Independent formula, symmetry, identical and
 * disjoint cases, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./hellinger-distance";
import type { VisualFrame } from "@/types";

function reference(p: number[], q: number[]): number {
    const m = Math.max(p.length, q.length);
    const norm = (v: number[]) => {
        const raw = Array.from({ length: m }, (_, i) => Math.max(0, v[i] ?? 0));
        const sum = raw.reduce((a, b) => a + b, 0);
        return sum > 0 ? raw.map((x) => x / sum) : raw.map(() => 1 / m);
    };
    const a = norm(p);
    const b = norm(q);
    let acc = 0;
    for (let i = 0; i < m; i += 1) acc += (Math.sqrt(a[i] ?? 0) - Math.sqrt(b[i] ?? 0)) ** 2;
    return Math.sqrt(acc / 2);
}

function checkFrames(frames: VisualFrame[], m: number): void {
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(2 * m);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

describe("HellingerDistance", () => {
    it("matches an independent formula computation", () => {
        const p = [3, 1, 4, 0, 2];
        const q = [1, 1, 1, 1, 1];
        const frames = [...mod.run({ p, q })];
        checkFrames(frames, 5);
        expect(Number(frames[frames.length - 1].meta["distance"])).toBeCloseTo(reference(p, q), 10);
    });

    it("is symmetric and bounded", () => {
        const p = [0.2, 0.5, 0.3];
        const q = [0.6, 0.1, 0.3];
        const d = (a: number[], b: number[]) => Number([...mod.run({ p: a, q: b })].at(-1)?.meta["distance"]);
        expect(d(q, p)).toBeCloseTo(d(p, q), 10);
        expect(d(p, p)).toBeCloseTo(0, 10);
        expect(d([1, 0], [0, 1])).toBeCloseTo(1, 10);
    });

    it("normalizes unnormalized counts", () => {
        expect(Number([...mod.run({ p: [10, 30], q: [1, 3] })].at(-1)?.meta["distance"])).toBeCloseTo(0, 10);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBe(6);
        expect(generator.next().done).toBe(true);
    });
});
