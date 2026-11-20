import { describe, expect, it } from "vitest";
import type { VisualFrame } from "@/types";
import mod from "./cnm-community-detection";

function collect(input: unknown): VisualFrame[] {
    return [...mod.run(input)];
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
        for (const edge of frame.edges) {
            expect(frame.entities.some((e) => e.id === edge.sourceId)).toBe(true);
            expect(frame.entities.some((e) => e.id === edge.targetId)).toBe(true);
        }
    });
}

function partitionOf(frame: VisualFrame): Map<string, string> {
    const partition = new Map<string, string>();
    for (const entity of frame.entities) {
        partition.set(String(entity.metadata.label), String(entity.metadata.community));
    }
    return partition;
}

function modularity(graph: Record<string, string[]>, partition: Map<string, string>): number {
    const edges: Array<[string, string]> = [];
    const seen = new Set<string>();
    for (const [a, targets] of Object.entries(graph)) {
        for (const b of targets) {
            const key = [a, b].sort().join("|");
            if (a !== b && !seen.has(key)) {
                seen.add(key);
                edges.push([a, b]);
            }
        }
    }
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const degree = new Map<string, number>(labels.map((v) => [v, 0]));
    for (const [a, b] of edges) {
        degree.set(a, (degree.get(a) ?? 0) + 1);
        degree.set(b, (degree.get(b) ?? 0) + 1);
    }
    const m = edges.length;
    if (m === 0) return 0;
    let internal = 0;
    for (const [a, b] of edges) {
        if (partition.get(a) === partition.get(b)) internal += 1;
    }
    const sums = new Map<string, number>();
    for (const vertex of labels) {
        const group = partition.get(vertex) as string;
        sums.set(group, (sums.get(group) ?? 0) + (degree.get(vertex) ?? 0));
    }
    let penalty = 0;
    for (const value of sums.values()) penalty += (value / (2 * m)) ** 2;
    return internal / m - penalty;
}

describe("CNM Community Detection", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = collect(mod.defaultInput);
        checkFrames(frames);
        expect(frames.length).toBeLessThan(100);
    });

    it("never decreases modularity and matches an independent recomputation", () => {
        const graph = (mod.defaultInput as { graph: Record<string, string[]> }).graph;
        const frames = collect({ graph });
        checkFrames(frames);
        for (let i = 1; i < frames.length; i += 1) {
            const previous = Number(frames[i - 1]?.meta.modularity);
            const current = Number(frames[i]?.meta.modularity);
            expect(current).toBeGreaterThanOrEqual(previous - 0.0011);
        }
        const finalFrame = frames[frames.length - 1] as VisualFrame;
        const expected = modularity(graph, partitionOf(finalFrame));
        expect(Number(finalFrame.meta.modularity)).toBeCloseTo(Math.round(expected * 1000) / 1000, 2);
    });

    it("separates the two halves of the barbell graph", () => {
        const frames = collect(mod.defaultInput);
        const partition = partitionOf(frames[frames.length - 1] as VisualFrame);
        const left = new Set(["A", "B", "C"].map((v) => partition.get(v)));
        const right = new Set(["D", "E", "F"].map((v) => partition.get(v)));
        expect(left.size).toBe(1);
        expect(right.size).toBe(1);
        expect([...left][0]).not.toBe([...right][0]);
    });

    it("handles an empty graph without throwing", () => {
        const frames = collect({ graph: {} });
        expect(frames.length).toBeGreaterThan(0);
        expect(frames[0]?.stepNumber).toBe(0);
        expect(frames[frames.length - 1]?.description.length).toBeGreaterThanOrEqual(10);
    });
});
