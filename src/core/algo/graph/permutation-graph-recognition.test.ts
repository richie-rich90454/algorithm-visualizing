/**
 * permutation-graph-recognition.test.ts - Brute-force recognition check, frame
 * shape, and termination.
 */

import { describe, expect, it } from "vitest";
import mod from "./permutation-graph-recognition";
import type { VisualFrame } from "@/types";

type Adj = Record<string, string[]>;

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

function inversionSet(positions: number[]): Set<string> {
    const result = new Set<string>();
    for (let i = 0; i < positions.length; i += 1) {
        for (let j = i + 1; j < positions.length; j += 1) {
            const pi = positions[i];
            const pj = positions[j];
            if (pi !== undefined && pj !== undefined && pi > pj) {
                result.add(`${i},${j}`);
            }
        }
    }
    return result;
}

function targetSet(adjacency: Adj, vertices: string[]): Set<string> {
    const result = new Set<string>();
    for (let i = 0; i < vertices.length; i += 1) {
        const v = vertices[i];
        if (v === undefined) {
            continue;
        }
        for (const raw of adjacency[v] ?? []) {
            const j = vertices.indexOf(String(raw));
            if (j > i) {
                result.add(`${i},${j}`);
            }
        }
    }
    return result;
}

/** Independent reference: does any position assignment match the inversion set? */
function bruteForceRecognize(adjacency: Adj, vertices: string[]): boolean {
    const target = targetSet(adjacency, vertices);
    const used = new Array<boolean>(vertices.length).fill(false);
    const assign = new Array<number>(vertices.length).fill(-1);
    const search = (index: number): boolean => {
        if (index >= vertices.length) {
            const edges = inversionSet(assign);
            return edges.size === target.size && [...edges].every((k) => target.has(k));
        }
        for (let p = 0; p < vertices.length; p += 1) {
            if (used[p]) {
                continue;
            }
            used[p] = true;
            assign[index] = p;
            if (search(index + 1)) {
                return true;
            }
            used[p] = false;
            assign[index] = -1;
        }
        return false;
    };
    return search(0);
}

describe("Permutation Graph Recognition", () => {
    it("matches brute force on several graphs", () => {
        const graphs: Adj[] = [
            (mod.defaultInput as { adjacency: Adj }).adjacency,
            { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] },
            { A: ["B"], B: ["A", "C"], C: ["B", "D"], D: ["C"] },
            { A: ["B", "C", "D"], B: ["A"], C: ["A"], D: ["A"] },
        ];
        for (const adjacency of graphs) {
            const vertices = Object.keys(adjacency).sort();
            const frames = [...mod.run({ adjacency })];
            checkFrames(frames);
            const meta = frames[frames.length - 1]?.meta;
            expect(meta?.["permutationGraph"]).toBe(bruteForceRecognize(adjacency, vertices));
            if (meta?.["permutationGraph"]) {
                const witness = meta["witness"] as number[];
                expect(inversionSet(witness)).toEqual(targetSet(adjacency, vertices));
            }
        }
    });

    it("recognizes a complete graph", () => {
        const adjacency: Adj = { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"] };
        const frames = [...mod.run({ adjacency })];
        expect(frames[frames.length - 1]?.meta["permutationGraph"]).toBe(true);
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
