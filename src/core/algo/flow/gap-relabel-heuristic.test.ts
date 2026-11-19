import { describe, expect, it } from "vitest";
import mod from "./gap-relabel-heuristic";
import type { VisualFrame } from "@/types";

type Input = {
    vertices: string[];
    edges: Array<[string, string, number]>;
    source: string;
    sink: string;
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
        vertices: ["S", "A", "B", "T"],
        edges: [["S", "A", 4], ["S", "B", 3], ["A", "B", 2], ["A", "T", 3], ["B", "T", 4]],
        source: "S",
        sink: "T",
    },
    {
        vertices: ["s", "a", "b", "c", "t"],
        edges: [
            ["s", "a", 5], ["s", "b", 4], ["a", "b", 1], ["a", "c", 3],
            ["b", "c", 2], ["c", "t", 7], ["b", "t", 3],
        ],
        source: "s",
        sink: "t",
    },
];

describe("Gap Relabel Heuristic", () => {
    it("computes the maximum flow on fixed and random networks", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.vertices.length, input.edges.length);
            expect(frames[frames.length - 1]?.meta["maxFlow"]).toBe(bruteForceMaxFlow(input));
        }
        const vertices = ["s", "a", "b", "c", "d", "t"];
        for (let trial = 0; trial < 15; trial += 1) {
            const edges: Array<[string, string, number]> = [];
            for (let i = 0; i < 4; i += 1) {
                for (let j = i + 1; j < 6; j += 1) {
                    if (Math.random() < 0.55) {
                        edges.push([vertices[i] ?? "s", vertices[j] ?? "t", 1 + Math.floor(Math.random() * 9)]);
                    }
                }
            }
            const input: Input = { vertices, edges, source: "s", sink: "t" };
            const frames = [...mod.run(input)];
            expect(frames[frames.length - 1]?.meta["maxFlow"]).toBe(bruteForceMaxFlow(input));
        }
    });

    it("reports gap sweeps when they occur and terminates", () => {
        const frames = [...mod.run(cases[1])];
        const sweep = frames.find((f) => typeof f.meta["lifted"] === "number");
        if (sweep) {
            expect(Number(sweep.meta["lifted"])).toBeGreaterThan(0);
        }
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
