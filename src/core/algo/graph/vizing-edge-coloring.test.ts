/**
 * vizing-edge-coloring.test.ts - Proper-coloring property checks, frame shape
 * validation, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./vizing-edge-coloring";
import type { VisualFrame } from "@/types";

type Graph = Record<string, string[]>;

function checkFrames(frames: VisualFrame[]): void {
    expect(frames.length).toBeGreaterThan(0);
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.layout).toBe("graph");
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.entities.every((entity) => entity.type === "node")).toBe(true);
        const ids = new Set(frame.entities.map((entity) => entity.id));
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(mod.pseudocode?.length ?? 0);
        expect(frame.meta).toBeDefined();
    });
}

/** Assert the final frame encodes a proper coloring using at most delta+1 colors. */
function assertProper(graph: Graph): void {
    const frames = [...mod.run({ graph })];
    checkFrames(frames);
    const last = frames[frames.length - 1] as VisualFrame;
    const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
    const degree = new Map<string, number>(labels.map((label) => [label, 0]));
    const pairSet = new Set<string>();
    for (const [u, vs] of Object.entries(graph)) {
        for (const v of vs) {
            if (u === v) {
                continue;
            }
            degree.set(u, (degree.get(u) ?? 0) + 1);
            degree.set(v, (degree.get(v) ?? 0) + 1);
            pairSet.add(u < v ? `${u}|${v}` : `${v}|${u}`);
        }
    }
    const delta = Math.max(0, ...degree.values());
    const palette = delta + 1;

    expect(Number(last.meta["edgesColored"])).toBe(pairSet.size);
    expect(Number(last.meta["colorsUsed"])).toBeLessThanOrEqual(palette);

    const incidentColors = new Map<string, number[]>();
    for (const edge of last.edges) {
        const color = Number(edge.label);
        expect(Number.isInteger(color)).toBe(true);
        expect(color).toBeGreaterThanOrEqual(1);
        expect(color).toBeLessThanOrEqual(palette);
        for (const endpoint of [edge.sourceId, edge.targetId]) {
            const bucket = incidentColors.get(endpoint) ?? [];
            bucket.push(color);
            incidentColors.set(endpoint, bucket);
        }
    }
    for (const colors of incidentColors.values()) {
        expect(new Set(colors).size).toBe(colors.length);
    }
}

function complete(n: number): Graph {
    const names = Array.from({ length: n }, (_v, i) => String.fromCharCode(65 + i));
    const graph: Graph = {};
    for (let i = 0; i < n; i += 1) {
        graph[names[i] as string] = names.filter((_name, j) => j !== i);
    }
    return graph;
}

function cycle(n: number): Graph {
    const names = Array.from({ length: n }, (_v, i) => String.fromCharCode(65 + i));
    const graph: Graph = {};
    for (let i = 0; i < n; i += 1) {
        graph[names[i] as string] = [names[(i + 1) % n] as string, names[(i - 1 + n) % n] as string];
    }
    return graph;
}

/** Deterministic pseudo-random graph via a linear congruential generator. */
function randomGraph(n: number, seed: number, density: number): Graph {
    let state = seed >>> 0;
    const next = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const names = Array.from({ length: n }, (_v, i) => String.fromCharCode(65 + i));
    const graph: Graph = Object.fromEntries(names.map((name) => [name, [] as string[]]));
    for (let i = 0; i < n; i += 1) {
        for (let j = i + 1; j < n; j += 1) {
            if (next() < density) {
                graph[names[i] as string]?.push(names[j] as string);
                graph[names[j] as string]?.push(names[i] as string);
            }
        }
    }
    return graph;
}

describe("Vizing Edge Coloring", () => {
    it("produces a proper coloring on classic graph families", () => {
        const graphs: Graph[] = [
            (mod.defaultInput as { graph: Graph }).graph,
            complete(3),
            complete(4),
            complete(5),
            complete(6),
            cycle(4),
            cycle(5),
            cycle(6),
            { A: ["B", "C", "D", "E"], B: [], C: [], D: [], E: [] },
            {
                A: ["D", "E", "F"],
                B: ["D", "E", "F"],
                C: ["D", "E", "F"],
                D: ["A", "B", "C"],
                E: ["A", "B", "C"],
                F: ["A", "B", "C"],
            },
        ];
        for (const graph of graphs) {
            assertProper(graph);
        }
    });

    it("produces a proper coloring on many deterministic random graphs", () => {
        for (let seed = 1; seed <= 60; seed += 1) {
            for (const density of [0.25, 0.4, 0.55, 0.7, 0.85]) {
                assertProper(randomGraph(8, seed * 31 + density * 100, density));
            }
        }
    });

    it("handles empty and single-vertex graphs", () => {
        assertProper({});
        assertProper({ A: [] });
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
