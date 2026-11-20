import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./reliable-shortest-path";

function frames(input: unknown): VisualFrame[] {
    return Array.from(mod.run(input));
}

function shapes(fs: VisualFrame[]): void {
    const pc = mod.pseudocode ?? [];
    expect(pc.length).toBeGreaterThanOrEqual(5);
    expect(pc.length).toBeLessThanOrEqual(12);
    expect(fs.length).toBeGreaterThan(2);
    fs.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber ?? 0).toBeLessThan(pc.length);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        frame.edges.forEach((edge) => {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        });
    });
}

/** Enumerate every simple path and take the maximum product of probabilities. */
function bruteReliability(
    graph: Record<string, Array<[string, number]>>,
    start: string,
    target: string,
): number {
    let best = 0;
    const walk = (node: string, seen: Set<string>, product: number): void => {
        if (node === target) {
            best = Math.max(best, product);
            return;
        }
        for (const [next, probability] of graph[node] ?? []) {
            if (seen.has(next) || probability <= 0) continue;
            const nextSeen = new Set(seen);
            nextSeen.add(next);
            walk(next, nextSeen, product * probability);
        }
    };
    walk(start, new Set([start]), 1);
    return best;
}

const graphs: Array<{
    graph: Record<string, Array<[string, number]>>;
    start: string;
    target: string;
}> = [
    {
        graph: {
            A: [
                ["B", 0.9],
                ["C", 0.7],
            ],
            B: [
                ["C", 0.6],
                ["D", 0.8],
            ],
            C: [["D", 0.95]],
            D: [],
        },
        start: "A",
        target: "D",
    },
    {
        graph: {
            S: [
                ["A", 0.5],
                ["B", 0.9],
            ],
            A: [["T", 0.95]],
            B: [["T", 0.4]],
            T: [],
        },
        start: "S",
        target: "T",
    },
    {
        graph: {
            X: [
                ["Y", 0.2],
                ["Z", 0.99],
            ],
            Y: [["Z", 0.9]],
            Z: [],
        },
        start: "X",
        target: "Z",
    },
];

describe("Most reliable path", () => {
    it("matches brute-force enumeration of all simple paths", () => {
        for (const input of graphs) {
            const fs = frames(input);
            shapes(fs);
            const last = fs[fs.length - 1];
            const expected = bruteReliability(input.graph, input.start, input.target);
            expect(Number(last?.meta["reliability"])).toBeCloseTo(expected, 6);
        }
    });

    it("reports the path product and terminates", () => {
        const fs = frames(mod.defaultInput);
        shapes(fs);
        const last = fs[fs.length - 1];
        const path = String(last?.meta["path"]).split("->");
        let product = 1;
        for (let i = 0; i + 1 < path.length; i += 1) {
            const edge = (mod.defaultInput as { graph: Record<string, Array<[string, number]>> }).graph[path[i] as string]
                ?.find(([to]) => to === path[i + 1]);
            product *= edge?.[1] ?? 0;
        }
        expect(product).toBeCloseTo(Number(last?.meta["reliability"]), 6);
        expect(Number(last?.meta["passes"])).toBeGreaterThan(0);
    });
});
