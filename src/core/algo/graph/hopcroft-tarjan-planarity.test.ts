import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./hopcroft-tarjan-planarity";

function collect(graph: Record<string, string[]>): VisualFrame[] {
    return [...mod.run({ graph })];
}

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.layout).toBe("graph");
        expect(frame.edges).toBeInstanceOf(Array);
        expect(frame.meta).toBeTypeOf("object");
        for (const entity of frame.entities) expect(entity.type).toBe("node");
    });
}

function verdict(frames: VisualFrame[]): boolean {
    const last = frames[frames.length - 1] as VisualFrame;
    return Boolean(last.meta.planar);
}

function complete(n: number): Record<string, string[]> {
    const labels = Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i));
    const graph: Record<string, string[]> = {};
    for (const a of labels) graph[a] = labels.filter((b) => b !== a);
    return graph;
}

describe("Hopcroft-Tarjan Planarity", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect((mod.defaultInput as { graph: Record<string, string[]> }).graph);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(100);
    });

    it("classifies named planar and nonplanar graphs", () => {
        expect(verdict(collect({ A: [], B: [], C: [] }))).toBe(true);
        expect(verdict(collect({ A: ["B"], B: ["A", "C"], C: ["B"] }))).toBe(true);
        expect(verdict(collect({ A: ["B", "C"], B: ["A", "C"], C: ["A", "B"], D: [] }))).toBe(true);
        expect(verdict(collect(complete(4)))).toBe(true);
        expect(verdict(collect(complete(5)))).toBe(false);
        expect(
            verdict(
                collect({
                    A: ["D", "E", "F"],
                    B: ["D", "E", "F"],
                    C: ["D", "E", "F"],
                    D: ["A", "B", "C"],
                    E: ["A", "B", "C"],
                    F: ["A", "B", "C"],
                }),
            ),
        ).toBe(false);
    });

    it("agrees with the brute-force rule on every graph with at most four vertices", () => {
        const labels = ["A", "B", "C", "D"];
        const possible: Array<[string, string]> = [];
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) possible.push([labels[i] as string, labels[j] as string]);
        }
        for (let mask = 0; mask < 1 << possible.length; mask += 1) {
            const graph: Record<string, string[]> = { A: [], B: [], C: [], D: [] };
            possible.forEach(([a, b], bit) => {
                if ((mask & (1 << bit)) !== 0) {
                    (graph[a] as string[]).push(b);
                    (graph[b] as string[]).push(a);
                }
            });
            const frames = collect(graph);
            checkFrames(frames);
            expect(verdict(frames)).toBe(true);
        }
    });

    it("agrees with the Kuratowski rule on every graph with five vertices", () => {
        const labels = ["A", "B", "C", "D", "E"];
        const possible: Array<[string, string]> = [];
        for (let i = 0; i < labels.length; i += 1) {
            for (let j = i + 1; j < labels.length; j += 1) possible.push([labels[i] as string, labels[j] as string]);
        }
        for (let mask = 0; mask < 1 << possible.length; mask += 1) {
            const graph: Record<string, string[]> = { A: [], B: [], C: [], D: [], E: [] };
            let edgeCount = 0;
            possible.forEach(([a, b], bit) => {
                if ((mask & (1 << bit)) !== 0) {
                    (graph[a] as string[]).push(b);
                    (graph[b] as string[]).push(a);
                    edgeCount += 1;
                }
            });
            const expected = edgeCount < 10;
            const frames = collect(graph);
            expect(verdict(frames)).toBe(expected);
        }
    });
});
