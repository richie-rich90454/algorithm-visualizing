import { describe, expect, it } from "vitest";
import mod from "./fifo-push-relabel";
import type { VisualFrame } from "@/types";

type Input = {
    vertices: string[];
    edges: Array<[string, string, number]>;
    source: string;
    sink: string;
};

/** Maximum flow equals the minimum s-t cut; enumerate all cuts for small n. */
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
            const iu = input.vertices.indexOf(u);
            const iv = input.vertices.indexOf(v);
            if (((mask >> iu) & 1) === 1 && ((mask >> iv) & 1) === 0) {
                cut += cap;
            }
        }
        best = Math.min(best, cut);
    }
    return best;
}

function checkFrames(frames: VisualFrame[], nodeCount: number, edgeCount: number): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBe(nodeCount);
        expect(frame.edges.length).toBe(edgeCount);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.edges.every((e) => frame.entities.some((v) => v.id === e.sourceId))).toBe(true);
    });
}

const cases: Input[] = [
    {
        vertices: ["S", "A", "B", "T"],
        edges: [["S", "A", 3], ["S", "B", 2], ["A", "B", 1], ["A", "T", 2], ["B", "T", 3]],
        source: "S",
        sink: "T",
    },
    {
        vertices: ["s", "a", "b", "c", "t"],
        edges: [
            ["s", "a", 4], ["s", "b", 3], ["a", "c", 2], ["b", "c", 5],
            ["c", "t", 6], ["a", "t", 2], ["b", "a", 1],
        ],
        source: "s",
        sink: "t",
    },
    {
        vertices: ["s", "a", "b", "c", "d", "t"],
        edges: [
            ["s", "a", 7], ["s", "b", 4], ["a", "b", 3], ["a", "c", 5],
            ["b", "d", 6], ["c", "d", 2], ["c", "t", 4], ["d", "t", 8], ["d", "c", 1],
        ],
        source: "s",
        sink: "t",
    },
];

describe("FIFO Push-Relabel", () => {
    it("finds the maximum flow on fixed networks", () => {
        for (const input of cases) {
            const frames = [...mod.run(input)];
            checkFrames(frames, input.vertices.length, input.edges.length);
            const last = frames[frames.length - 1]?.meta;
            expect(last?.["maxFlow"]).toBe(bruteForceMaxFlow(input));
        }
    });

    it("finds the maximum flow on random networks", () => {
        const vertices = ["s", "a", "b", "c", "d", "t"];
        for (let trial = 0; trial < 20; trial += 1) {
            const edges: Array<[string, string, number]> = [];
            for (let i = 0; i < 4; i += 1) {
                for (let j = i + 1; j < 6; j += 1) {
                    if (Math.random() < 0.6) {
                        edges.push([vertices[i] ?? "s", vertices[j] ?? "t", 1 + Math.floor(Math.random() * 7)]);
                    }
                }
            }
            const input: Input = { vertices, edges, source: "s", sink: "t" };
            const frames = [...mod.run(input)];
            expect(frames[frames.length - 1]?.meta["maxFlow"]).toBe(bruteForceMaxFlow(input));
        }
    });

    it("handles a zero flow case and terminates cleanly", () => {
        const input: Input = { vertices: ["s", "a", "t"], edges: [["a", "t", 5]], source: "s", sink: "t" };
        const frames = [...mod.run(input)];
        expect(frames[frames.length - 1]?.meta["maxFlow"]).toBe(0);
        const generator = mod.run(mod.defaultInput);
        let count = 0;
        for (const _frame of generator) {
            count += 1;
        }
        expect(count).toBeGreaterThan(1);
        expect(generator.next().done).toBe(true);
    });
});
