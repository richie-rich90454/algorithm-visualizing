import { describe, expect, it } from "vitest";
import mod from "./global-relabel-heuristic";
import type { VisualFrame } from "@/types";

type Input = {
    vertices: string[];
    edges: Array<[string, string, number]>;
    source: string;
    sink: string;
    period?: number;
};

function bruteForceMaxFlow(input: Input): number {
    const n = input.vertices.length;
    const s = input.vertices.indexOf(input.source);
    const t = input.vertices.indexOf(input.sink);
    let best = Infinity;
    for (let mask = 0; mask < 1 << n; mask += 1) {
        if (((mask >> s) & 1) !== 1 || ((mask >> t) & 1) !== 0) {
            continue;
        }
        let cut = 0;
        for (const [u, v, cap] of input.edges) {
            if (((mask >> input.vertices.indexOf(u)) & 1) === 1 &&
                ((mask >> input.vertices.indexOf(v)) & 1) === 0) {
                cut += cap;
            }
        }
        best = Math.min(best, cut);
    }
    return best;
}

function checkFrames(frames: VisualFrame[], nodes: number, edges: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodes);
        expect(frame.edges.length).toBe(edges);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
    });
}

const cases: Input[] = [
    {
        vertices: ["S", "A", "B", "C", "T"],
        edges: [
            ["S", "A", 5], ["S", "B", 4], ["A", "B", 2], ["A", "C", 3],
            ["B", "C", 4], ["C", "T", 6], ["B", "T", 3],
        ],
        source: "S",
        sink: "T",
        period: 5,
    },
    {
        vertices: ["s", "a", "b", "c", "d", "t"],
        edges: [
            ["s", "a", 6], ["s", "b", 5], ["a", "c", 4], ["b", "c", 3],
            ["c", "d", 5], ["d", "t", 9], ["c", "t", 2], ["a", "d", 1],
        ],
        source: "s",
        sink: "t",
        period: 2,
    },
];

describe("Global Relabel Heuristic", () => {
    it("computes maximum flow on fixed networks", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.vertices.length, input.edges.length);
            expect(frames[frames.length - 1]?.meta["maxFlow"]).toBe(bruteForceMaxFlow(input));
            expect(Number(frames[0]?.meta["globalPasses"] ?? 0)).toBe(0);
            expect(frames.filter((f) => f.description.includes("Global relabel")).length).toBeGreaterThan(0);
        }
    });

    it("computes maximum flow on random networks", () => {
        const vertices = ["s", "a", "b", "c", "d", "t"];
        for (let trial = 0; trial < 15; trial += 1) {
            const edges: Array<[string, string, number]> = [];
            for (let i = 0; i < 4; i += 1) {
                for (let j = i + 1; j < 6; j += 1) {
                    if (Math.random() < 0.6) {
                        edges.push([vertices[i] ?? "s", vertices[j] ?? "t", 1 + Math.floor(Math.random() * 8)]);
                    }
                }
            }
            const input: Input = { vertices, edges, source: "s", sink: "t", period: 3 };
            const frames = [...mod.run(input)];
            expect(frames[frames.length - 1]?.meta["maxFlow"]).toBe(bruteForceMaxFlow(input));
        }
    });

    it("terminates cleanly on the default input", () => {
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(2);
        expect(generator.next().done).toBe(true);
    });
});
