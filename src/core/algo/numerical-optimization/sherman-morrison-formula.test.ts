/**
 * sherman-morrison-formula.test.ts - Inverse cross-check, frame shape, termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./sherman-morrison-formula";
import type { VisualFrame } from "@/types";

function checkFrames(frames: VisualFrame[], n: number): void {
    expect(frames.length).toBeGreaterThan(1);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("grid");
        expect(frame.entities.length).toBe(n * n);
        expect(frame.entities.every((e) => e.type === "cell")).toBe(true);
        expect(frame.edges).toEqual([]);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

function toMatrix(flat: number[], n: number): number[][] {
    return Array.from({ length: n }, (_, i) => flat.slice(i * n, (i + 1) * n));
}

function inverseReference(a: number[][]): number[][] {
    const n = a.length;
    const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
    for (let col = 0; col < n; col += 1) {
        let p = col;
        for (let r = col + 1; r < n; r += 1) if (Math.abs(m[r]?.[col] ?? 0) > Math.abs(m[p]?.[col] ?? 0)) p = r;
        const t = m[col] as number[];
        m[col] = m[p] as number[];
        m[p] = t;
        const d = m[col]?.[col] ?? 0;
        for (let c = 0; c < 2 * n; c += 1) m[col]![c] = (m[col]![c] ?? 0) / d;
        for (let r = 0; r < n; r += 1) {
            if (r === col) continue;
            const f = m[r]?.[col] ?? 0;
            for (let c = 0; c < 2 * n; c += 1) m[r]![c] = (m[r]![c] ?? 0) - f * (m[col]![c] ?? 0);
        }
    }
    return m.map((row) => row.slice(n));
}

describe("Sherman-Morrison formula", () => {
    it("matches a direct inversion of the perturbed matrix on the default input", () => {
        const input = mod.defaultInput as { matrix: number[][]; u: number[]; v: number[] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["singular"]).toBe(false);
        const updated = toMatrix(last?.["updated"] as number[], 2);
        const n = 2;
        const perturbed = input.matrix.map((row, i) => row.map((value, j) => value + (input.u[i] ?? 0) * (input.v[j] ?? 0)));
        const reference = inverseReference(perturbed);
        for (let i = 0; i < n; i += 1) {
            for (let j = 0; j < n; j += 1) expect(updated[i]?.[j] ?? 0).toBeCloseTo(reference[i]?.[j] ?? 0, 8);
        }
    });

    it("matches direct inversion on several random rank-one updates", () => {
        const cases = [
            { matrix: [[5, 1, 0], [1, 4, 1], [0, 1, 6]], u: [1, 0, 2], v: [0, 1, 1] },
            { matrix: [[3, 1], [2, 4]], u: [1, 1], v: [2, 0] },
        ];
        for (const input of cases) {
            const n = input.matrix.length;
            const frames = [...mod.run(input)];
            checkFrames(frames, n);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["singular"]).toBe(false);
            const updated = toMatrix(last?.["updated"] as number[], n);
            const perturbed = input.matrix.map((row, i) => row.map((value, j) => value + (input.u[i] ?? 0) * (input.v[j] ?? 0)));
            const reference = inverseReference(perturbed);
            for (let i = 0; i < n; i += 1) {
                for (let j = 0; j < n; j += 1) expect(updated[i]?.[j] ?? 0).toBeCloseTo(reference[i]?.[j] ?? 0, 7);
            }
            expect(last?.["error"] as number).toBeLessThan(1e-8);
        }
    });

    it("detects a singular update", () => {
        const input = { matrix: [[1, 0], [0, 1]], u: [-1, 0], v: [1, 0] };
        const frames = [...mod.run(input)];
        checkFrames(frames, 2);
        const last = frames[frames.length - 1]?.meta;
        expect(last?.["singular"]).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        const frames = [...generator];
        expect(frames.length).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
