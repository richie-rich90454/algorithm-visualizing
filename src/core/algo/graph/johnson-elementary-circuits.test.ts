/**
 * johnson-elementary-circuits.test.ts – Correctness and frame checks for Johnson Elementary Circuits.
 */

import { describe, expect, it } from "vitest";
import johnson from "./johnson-elementary-circuits";

type Adj = Record<string, string[]>;

function framesOf(input: unknown) {
    return [...johnson.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = johnson.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(johnson.visualType);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

/** Enumerate every simple directed cycle by brute-force depth-first search. */
function bruteCycles(adj: Adj): Set<string> {
    const labels = [...new Set([...Object.keys(adj), ...Object.values(adj).flat()])].sort();
    const idx = new Map(labels.map((l, i) => [l, i]));
    const graph = labels.map((l) =>
        (adj[l] ?? []).filter((v) => idx.has(v)).map((v) => idx.get(v) as number).sort((a, b) => a - b),
    );
    const out = new Set<string>();
    for (let s = 0; s < labels.length; s += 1) {
        const walk = (v: number, path: number[], visited: Set<number>): void => {
            for (const w of graph[v] as number[]) {
                if (w === s) {
                    out.add([...path, s].map((i) => labels[i]).join("->"));
                } else if (w > s && !visited.has(w)) {
                    visited.add(w);
                    path.push(w);
                    walk(w, path, visited);
                    path.pop();
                    visited.delete(w);
                }
            }
        };
        walk(s, [s], new Set([s]));
    }
    return out;
}

function normalize(cycles: unknown): Set<string> {
    const out = new Set<string>();
    if (!Array.isArray(cycles)) return out;
    for (const cycle of cycles as string[]) out.add(String(cycle).replace(/\s/g, ""));
    return out;
}

describe("JohnsonElementaryCircuits", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(johnson.defaultInput);
        expect(frames.length).toBeGreaterThan(1);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("matches brute-force simple-cycle enumeration on several digraphs", () => {
        const graphs: Adj[] = [
            { A: ["B", "C"], B: ["C"], C: ["A"], D: ["A", "E"], E: ["D"] },
            { A: ["B"], B: ["A", "C"], C: ["A"] },
            { A: ["B", "C", "D"], B: ["C"], C: ["D"], D: ["A"] },
            { A: ["B"], B: ["C"], C: ["A", "B"], D: [] },
        ];
        for (const graph of graphs) {
            const frames = framesOf({ graph });
            const got = normalize(frames[frames.length - 1]?.meta.cycles);
            const expected = bruteCycles(graph);
            expect([...got].sort()).toEqual([...expected].sort());
            checkFrameShape(frames);
        }
    });

    it("reports only elementary closed walks", () => {
        const frames = framesOf(johnson.defaultInput);
        const cycles = frames[frames.length - 1]?.meta.cycles as string[];
        for (const raw of cycles) {
            const parts = raw.split(" -> ");
            expect(parts[0]).toBe(parts[parts.length - 1]);
            expect(new Set(parts.slice(0, -1)).size).toBe(parts.length - 1);
        }
    });
});
