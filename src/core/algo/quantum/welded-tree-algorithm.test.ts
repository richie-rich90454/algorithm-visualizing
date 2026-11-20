/**
 * welded-tree-algorithm.test.ts - Unitarity, independent evolution, and frames.
 */

import { describe, expect, it } from "vitest";
import mod from "./welded-tree-algorithm";
import type { VisualFrame } from "@/types";

type Complex = [number, number];

/** Independent glued-trees construction and sparse Hamiltonian evolution. */
function reference(columns: number, t: number, terms: number) {
    const half = 2 ** (columns + 1) - 1;
    const left = 1;
    const right = 1 + half;
    const exit = right + half;
    const total = exit + 1;
    const adj: number[][] = Array.from({ length: total }, () => []);
    const link = (a: number, b: number) => {
        adj[a]?.push(b);
        adj[b]?.push(a);
    };
    const at = (side: "left" | "right", level: number, index: number) =>
        (side === "left" ? left : right) + 2 ** level - 1 + index;
    link(0, at("left", 0, 0));
    link(at("right", 0, 0), exit);
    for (const side of ["left", "right"] as const) {
        for (let level = 0; level < columns; level += 1) {
            for (let j = 0; j < 2 ** level; j += 1) {
                link(at(side, level, j), at(side, level + 1, 2 * j));
                link(at(side, level, j), at(side, level + 1, 2 * j + 1));
            }
        }
    }
    const leaves = 2 ** columns;
    for (let j = 0; j < leaves; j += 1) {
        link(at("left", columns, j), at("right", columns, leaves - 1 - j));
    }
    let psi: Complex[] = adj.map((_, i) => (i === 0 ? [1, 0] : [0, 0]));
    let term = psi.map((z) => [...z] as Complex);
    for (let k = 1; k <= terms; k += 1) {
        const next = adj.map((neighbors, i) => {
            let re = 0;
            let im = 0;
            for (const n of neighbors ?? []) {
                re += term[n]?.[0] ?? 0;
                im += term[n]?.[1] ?? 0;
            }
            return [(im * t) / k, (-re * t) / k] as Complex;
        });
        psi = psi.map((z, i) => [z[0] + (next[i]?.[0] ?? 0), z[1] + (next[i]?.[1] ?? 0)]);
        term = next;
    }
    return {
        total,
        exit,
        probabilities: psi.map((z) => z[0] * z[0] + z[1] * z[1]),
    };
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("array");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "bar")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThan(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Welded tree algorithm", () => {
    it("matches an independent evolution and preserves probability", () => {
        const frames = [...mod.run({ columns: 2, terms: 60, times: [0, 0.5, 1.5, 3] })];
        checkFrames(frames);
        for (const frame of frames) {
            expect(Number(frame.meta["norm"])).toBeCloseTo(1, 8);
        }
        for (const t of [0.5, 1.5, 3]) {
            const frame = frames.find((f) => Number(f.meta["time"]) === t);
            const expected = reference(2, t, 60);
            const probs = frame?.meta["probabilities"] as number[];
            expect(probs.length).toBe(expected.total);
            for (let i = 0; i < probs.length; i += 1) {
                expect(probs[i] ?? 0).toBeCloseTo(expected.probabilities[i] ?? 0, 7);
            }
        }
    });

    it("agrees with the first-order step at a tiny time", () => {
        const frames = [...mod.run({ columns: 1, terms: 40, times: [0, 0.001] })];
        const probs = frames[2]?.meta["probabilities"] as number[];
        const expected = reference(1, 0.001, 40).probabilities;
        for (let i = 0; i < probs.length; i += 1) {
            expect(probs[i] ?? 0).toBeCloseTo(expected[i] ?? 0, 9);
        }
    });

    it("accumulates substantial probability at the exit", () => {
        const frames = [...mod.run({ columns: 2, terms: 60, times: [0, 4] })];
        const final = frames[frames.length - 1]?.meta;
        expect(Number(final?.["exitProbability"])).toBeGreaterThan(0.5);
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
