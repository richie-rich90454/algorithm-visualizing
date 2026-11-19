/** rural-postman-problem.test.ts - Brute-force state-space check, frame shape, termination. */

import { describe, expect, it } from "vitest";
import mod from "./rural-postman-problem";
import type { VisualFrame } from "@/types";

type WGraph = Record<string, Array<[string, number]>>;

const INF = 1e9;

/** Independent Dijkstra over (vertex, covered-required-mask) states for a closed tour. */
function bruteForce(graph: WGraph, required: Array<[string, string]>): number {
    const vertices = new Set<string>();
    for (const [a, list] of Object.entries(graph)) {
        vertices.add(a);
        for (const [b] of list) vertices.add(b);
    }
    const verts = [...vertices];
    const adj = new Map<string, Array<[string, number, number]>>();
    const reqIndex = new Map<string, number>();
    required.forEach(([a, b], i) => {
        reqIndex.set(a < b ? `${a}-${b}` : `${b}-${a}`, i);
    });
    for (const [a, list] of Object.entries(graph)) {
        const out: Array<[string, number, number]> = [];
        for (const [b, w] of list) {
            const key = a < b ? `${a}-${b}` : `${b}-${a}`;
            out.push([b, w, reqIndex.get(key) ?? -1]);
        }
        adj.set(a, out);
    }
    const m = required.length;
    const full = (1 << m) - 1;
    const start = verts.indexOf(required[0]?.[0] ?? verts[0]);
    const size = verts.length * (1 << m);
    const dist = Array<number>(size).fill(INF);
    const encode = (v: number, mask: number): number => v * (1 << m) + mask;
    dist[encode(start, 0)] = 0;
    const queue: Array<[number, number, number]> = [[0, start, 0]];
    while (queue.length > 0) {
        queue.sort((a, b) => a[0] - b[0]);
        const [d, v, mask] = queue.shift() as [number, number, number];
        if (d !== dist[encode(v, mask)]) continue;
        if (v === start && mask === full) return d;
        const label = verts[v] as string;
        for (const [nb, w, req] of adj.get(label) ?? []) {
            const nIdx = verts.indexOf(nb);
            const nMask = req >= 0 ? mask | (1 << req) : mask;
            const nd = d + w;
            const e = encode(nIdx, nMask);
            if (nd < (dist[e] as number)) {
                dist[e] = nd;
                queue.push([nd, nIdx, nMask]);
            }
        }
    }
    return INF;
}

function finalMeta(input: unknown): Record<string, unknown> {
    const frames = [...mod.run(input)];
    return frames[frames.length - 1]?.meta as Record<string, unknown>;
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((e) => e.type === "node")).toBe(true);
        for (const e of frame.edges) {
            expect(frame.entities.some((n) => n.id === e.sourceId)).toBe(true);
            expect(frame.entities.some((n) => n.id === e.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

describe("Rural postman problem", () => {
    it("matches a brute-force state-space search", () => {
        const cases: Array<{ graph: WGraph; required: Array<[string, string]> }> = [
            {
                graph: {
                    A: [
                        ["B", 1],
                        ["E", 5],
                    ],
                    B: [
                        ["A", 1],
                        ["C", 1],
                        ["D", 2],
                    ],
                    C: [
                        ["B", 1],
                        ["D", 1],
                    ],
                    D: [
                        ["C", 1],
                        ["B", 2],
                        ["E", 1],
                    ],
                    E: [
                        ["D", 1],
                        ["A", 5],
                    ],
                },
                required: [
                    ["A", "B"],
                    ["B", "C"],
                    ["C", "D"],
                    ["D", "E"],
                ],
            },
            {
                graph: {
                    A: [
                        ["B", 1],
                        ["D", 1],
                        ["C", 2],
                    ],
                    B: [
                        ["A", 1],
                        ["C", 1],
                        ["D", 2],
                    ],
                    C: [
                        ["B", 1],
                        ["D", 1],
                        ["A", 2],
                    ],
                    D: [
                        ["C", 1],
                        ["A", 1],
                        ["B", 2],
                    ],
                },
                required: [
                    ["A", "B"],
                    ["B", "C"],
                    ["B", "D"],
                ],
            },
        ];
        for (const c of cases) {
            const meta = finalMeta(c);
            const expected = bruteForce(c.graph, c.required);
            expect(meta["answer"]).toBe(expected);
            expect(Number(meta["requiredSum"]) + Number(meta["matchingCost"])).toBe(meta["answer"]);
        }
    });

    it("reports the worked example answer on the default input", () => {
        const meta = finalMeta(mod.defaultInput);
        expect(meta["requiredSum"]).toBe(4);
        expect(meta["matchingCost"]).toBe(4);
        expect(meta["answer"]).toBe(8);
    });

    it("has well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        checkFrames(frames);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _f of generator) count += 1;
        expect(count).toBeGreaterThan(0);
        expect(generator.next().done).toBe(true);
    });
});
