/** spectral-clustering.test.ts - Reference power iteration, cluster properties, frame shape, termination. */
import { describe, expect, it } from "vitest";
import mod from "./spectral-clustering";
import type { VisualFrame } from "@/types";

type Matrix = number[][];
interface Input {
    adjacency: Matrix;
    iterations: number;
}

function close(a: number, b: number, eps = 1e-6): boolean {
    return Math.abs(a - b) <= eps;
}

function matVec(m: Matrix, v: number[]): number[] {
    return m.map((row) => row.reduce((a, val, j) => a + val * (v[j] ?? 0), 0));
}

function reference(input: Input) {
    const n = input.adjacency.length;
    const degrees = input.adjacency.map((row) => row.reduce((a, v) => a + v, 0));
    const maxDegree = Math.max(0, ...degrees);
    const shifted: Matrix = input.adjacency.map((row, i) =>
        row.map((v, j) => (i === j ? maxDegree - degrees[i]! : -v)));
    let vector = input.adjacency.map((_, i) => (i < n / 2 ? 1 : -1) + 0.1 * Math.cos(i));
    for (let it = 0; it < input.iterations; it += 1) {
        const next = matVec(shifted, vector);
        const avg = next.reduce((a, v) => a + v, 0) / next.length;
        const centered = next.map((v) => v - avg);
        const scale = centered.reduce((a, v) => Math.max(a, Math.abs(v)), 0);
        vector = scale === 0 ? centered : centered.map((v) => v / scale);
    }
    return { fiedler: vector, clusters: vector.map((v) => (v >= 0 ? 0 : 1)) };
}

function signAgreement(a: number[], b: number[]): number {
    const direct = a.reduce((count, v, i) => count + (v === b[i] ? 1 : 0), 0);
    const flipped = a.reduce((count, v, i) => count + (v === (b[i] === 0 ? 1 : 0) ? 1 : 0), 0);
    return Math.max(direct, flipped);
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(frame.edges.every((e) => !e.directed)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Spectral Clustering", () => {
    it("matches an independent Fiedler power iteration up to global sign", () => {
        const input = mod.defaultInput as Input;
        const frames = [...mod.run(input)];
        checkFrames(frames);
        const expected = reference(input);
        const final = frames[frames.length - 1]?.meta;
        const clusters = final?.["clusters"] as number[];
        expect(signAgreement(clusters, expected.clusters)).toBe(input.adjacency.length);
    });

    it("splits the two cliques into two nonempty communities", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const clusters = final?.["clusters"] as number[];
        expect(new Set(clusters).size).toBe(2);
        expect(clusters.slice(0, 3).every((c) => c === clusters[0])).toBe(true);
        expect(clusters.slice(3).every((c) => c === clusters[3])).toBe(true);
        expect(clusters[0]).not.toBe(clusters[3]);
    });

    it("keeps the iterated vector mean-centered", () => {
        const frames = [...mod.run(mod.defaultInput)];
        const final = frames[frames.length - 1]?.meta;
        const fiedler = final?.["fiedler"] as number[];
        const mean = fiedler.reduce((a, v) => a + v, 0) / fiedler.length;
        expect(close(mean, 0, 1e-9)).toBe(true);
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
