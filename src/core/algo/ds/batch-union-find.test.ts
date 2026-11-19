import { describe, expect, it } from "vitest";
import mod from "./batch-union-find";

type Frame = ReturnType<typeof mod.run> extends Generator<infer F> ? F : never;

function checkFrames(frames: Frame[]): void {
    frames.forEach((frame, i) => {
        expect(frame.stepNumber).toBe(i);
        expect(Array.isArray(frame.entities)).toBe(true);
        expect(Array.isArray(frame.edges)).toBe(true);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 12);
        expect(frame.meta).toBeDefined();
    });
}

function connected(n: number, edges: Array<[number, number]>, a: number, b: number): boolean {
    const parent = Array.from({ length: n }, (_, i) => i);
    const find = (x: number): number => {
        while (parent[x] !== x) {
            const next = parent[x] ?? x;
            parent[x] = parent[next] ?? next;
            x = next;
        }
        return x;
    };
    for (const [u, v] of edges) {
        const ru = find(u);
        const rv = find(v);
        if (ru !== rv) parent[ru] = rv;
    }
    return find(a) === find(b);
}

function brute(n: number, edges: Array<[number, number]>, queries: Array<[number, number]>): number[] {
    return queries.map(([a, b]) => {
        if (a === b) return 0;
        for (let k = 1; k <= edges.length; k += 1) {
            if (connected(n, edges.slice(0, k), a, b)) return k;
        }
        return -1;
    });
}

describe("Batch Union-Find", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        checkFrames(frames);
    });

    it("merge-tree LCA times match brute-force prefix connectivity", () => {
        for (let trial = 0; trial < 40; trial += 1) {
            const n = 4 + Math.floor(Math.random() * 6);
            const edges: Array<[number, number]> = Array.from(
                { length: 8 },
                () => [Math.floor(Math.random() * n), Math.floor(Math.random() * n)] as [number, number],
            );
            const queries: Array<[number, number]> = Array.from(
                { length: 8 },
                () => [Math.floor(Math.random() * n), Math.floor(Math.random() * n)] as [number, number],
            );
            const frames = [...mod.run({ n, edges, queries })];
            checkFrames(frames);
            const answers = (frames[frames.length - 1]?.meta.answers as number[]) ?? [];
            expect(answers).toEqual(brute(n, edges, queries));
        }
    });

    it("reports -1 for elements in different components", () => {
        const frames = [...mod.run({ n: 6, edges: [[0, 1], [2, 3]], queries: [[0, 5], [0, 1]] })];
        expect(frames[frames.length - 1]?.meta.answers).toEqual([-1, 1]);
    });
});
