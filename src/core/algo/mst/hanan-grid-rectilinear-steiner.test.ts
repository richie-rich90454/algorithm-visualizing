/**
 * hanan-grid-rectilinear-steiner.test.ts - exact cost vs brute force on the Hanan grid.
 */
import { describe, expect, it } from "vitest";
import mod from "./hanan-grid-rectilinear-steiner";
import type { VisualFrame } from "@/types";

type Point = [number, number];

function bruteForce(terminals: Point[]): number {
    const xs = [...new Set(terminals.map((p) => p[0]))].sort((a, b) => a - b);
    const ys = [...new Set(terminals.map((p) => p[1]))].sort((a, b) => a - b);
    const at = (i: number, j: number) => i * ys.length + j;
    const edges: Array<[number, number, number]> = [];
    for (let i = 0; i < xs.length; i += 1) {
        for (let j = 0; j < ys.length; j += 1) {
            if (i + 1 < xs.length) edges.push([at(i, j), at(i + 1, j), (xs[i + 1] as number) - (xs[i] as number)]);
            if (j + 1 < ys.length) edges.push([at(i, j), at(i, j + 1), (ys[j + 1] as number) - (ys[j] as number)]);
        }
    }
    const tIdx = terminals.map(([x, y]) => at(xs.indexOf(x), ys.indexOf(y)));
    const n = xs.length * ys.length;
    let best = Infinity;
    for (let mask = 0; mask < 1 << edges.length; mask += 1) {
        const parent = Array.from({ length: n }, (_, i) => i);
        const find = (x: number): number => {
            let r = x;
            while (parent[r] !== r) r = parent[r] as number;
            return r;
        };
        let weight = 0;
        for (let i = 0; i < edges.length; i += 1) {
            if (!(mask & (1 << i))) continue;
            const [a, b, w] = edges[i] as [number, number, number];
            weight += w;
            if (find(a) !== find(b)) parent[find(a)] = find(b);
        }
        const roots = tIdx.map(find);
        if (roots.every((r) => r === roots[0])) best = Math.min(best, weight);
    }
    return best;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(2);
    const seen = new Set<number>();
    frames.forEach((frame) => {
        expect(frame.layout).toBe("point");
        expect(seen.has(frame.stepNumber)).toBe(false);
        seen.add(frame.stepNumber);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
    frames.forEach((frame, i) => expect(frame.stepNumber).toBe(i));
}

function evaluate(terminals: Point[]) {
    const frames = [...mod.run({ terminals })];
    checkFrames(frames);
    const final = frames[frames.length - 1]?.meta as Record<string, unknown>;
    return { frames, cost: Number(final["cost"]) };
}

describe("Hanan Grid Rectilinear Steiner Tree", () => {
    it("matches brute force on the default rectangle", () => {
        const input = mod.defaultInput as { terminals: Point[] };
        const result = evaluate(input.terminals);
        expect(result.cost).toBeCloseTo(bruteForce(input.terminals), 10);
        expect(result.cost).toBe(10);
    });

    it("matches brute force on random small terminal sets", () => {
        let seed = 701;
        const rand = () => {
            seed = (seed * 1103515245 + 12345) % 2147483648;
            return seed / 2147483648;
        };
        for (let trial = 0; trial < 12; trial += 1) {
            const coords = new Set<number>();
            while (coords.size < 3) coords.add(1 + Math.floor(rand() * 6));
            const ys = new Set<number>();
            while (ys.size < 3) ys.add(1 + Math.floor(rand() * 6));
            const xArr = [...coords];
            const yArr = [...ys];
            const terminals: Point[] = [
                [xArr[0] as number, yArr[0] as number],
                [xArr[2] as number, yArr[2] as number],
                [xArr[1] as number, yArr[1] as number],
            ];
            const result = evaluate(terminals);
            expect(result.cost).toBeCloseTo(bruteForce(terminals), 10);
        }
    });

    it("terminates cleanly", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
