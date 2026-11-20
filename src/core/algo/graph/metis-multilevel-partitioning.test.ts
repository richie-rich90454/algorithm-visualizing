/**
 * metis-multilevel-partitioning.test.ts – Correctness and frame checks for METIS Multilevel Partitioning.
 */

import { describe, expect, it } from "vitest";
import metis from "./metis-multilevel-partitioning";

type Adj = Record<string, string[]>;

function framesOf(input: unknown) {
    return [...metis.run(input)];
}

function checkFrameShape(frames: ReturnType<typeof framesOf>) {
    const lines = metis.pseudocode?.length ?? 0;
    frames.forEach((frame, index) => {
        expect(frame.stepNumber).toBe(index);
        expect(frame.entities.length).toBeGreaterThan(0);
        expect(frame.description.length).toBeGreaterThanOrEqual(10);
        expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
        expect(frame.codeLineNumber).toBeLessThan(lines);
        expect(frame.layout).toBe(metis.visualType);
        const ids = new Set(frame.entities.map((e) => e.id));
        expect(ids.size).toBe(frame.entities.length);
        for (const edge of frame.edges) {
            expect(ids.has(edge.sourceId)).toBe(true);
            expect(ids.has(edge.targetId)).toBe(true);
        }
    });
}

function edgesOf(adj: Adj): Array<[string, string]> {
    const labels = [...new Set([...Object.keys(adj), ...Object.values(adj).flat()])];
    const known = new Set(labels);
    const seen = new Set<string>();
    const out: Array<[string, string]> = [];
    for (const [u, vs] of Object.entries(adj)) {
        for (const v of vs) {
            if (!known.has(u) || !known.has(v)) continue;
            const key = [u, v].sort().join("|");
            if (!seen.has(key)) {
                seen.add(key);
                out.push([u, v]);
            }
        }
    }
    return out;
}

function parsePartition(raw: unknown): Map<string, number> {
    const out = new Map<string, number>();
    if (!Array.isArray(raw)) return out;
    for (const entry of raw as string[]) {
        const [node, part] = String(entry).split(":");
        if (node && part !== undefined) out.set(node, Number(part));
    }
    return out;
}

const graphs: Adj[] = [
    {
        A: ["B", "C", "D"],
        B: ["A", "C", "D"],
        C: ["A", "B", "D"],
        D: ["A", "B", "C", "E"],
        E: ["D", "F", "G"],
        F: ["E", "G", "H"],
        G: ["E", "F", "H"],
        H: ["F", "G"],
    },
    { A: ["B", "C"], B: ["A", "C"], C: ["A", "B"], D: ["E", "F"], E: ["D", "F"], F: ["D", "E"], C2: ["D"] },
];

describe("MetisMultilevelPartitioning", () => {
    it("emits well-formed frames and terminates", () => {
        const frames = framesOf(metis.defaultInput);
        expect(frames.length).toBeGreaterThan(2);
        expect(frames.length).toBeLessThan(200);
        checkFrameShape(frames);
    });

    it("produces a valid, balanced partition whose reported cut is correct", () => {
        for (const graph of graphs) {
            for (const k of [2, 3]) {
                const frames = framesOf({ graph, k });
                const meta = frames[frames.length - 1]?.meta ?? {};
                const part = parsePartition(meta.partition);
                const labels = [...new Set([...Object.keys(graph), ...Object.values(graph).flat()])];
                expect(part.size).toBe(labels.length);
                for (const label of labels) expect(part.has(label)).toBe(true);
                const sizes = new Array<number>(k).fill(0);
                for (const p of part.values()) sizes[p as number] = (sizes[p as number] ?? 0) + 1;
                expect(Math.max(...sizes)).toBeLessThanOrEqual(Math.ceil(labels.length / k) + 1);
                expect(Math.min(...sizes)).toBeGreaterThanOrEqual(Math.floor(labels.length / k) - 1);
                let cut = 0;
                for (const [u, v] of edgesOf(graph)) if (part.get(u) !== part.get(v)) cut += 1;
                expect(meta.cut).toBe(cut);
                checkFrameShape(frames);
            }
        }
    });

    it("never increases the cut during refinement and is deterministic", () => {
        const frames = framesOf(metis.defaultInput);
        const initial = frames.find((f) => f.meta.phase === "initial")?.meta.cut;
        const refineCuts = frames.filter((f) => f.meta.phase === "refine").map((f) => Number(f.meta.cut));
        expect(typeof initial).toBe("number");
        let previous = Number(initial);
        for (const cut of refineCuts) {
            expect(cut).toBeLessThanOrEqual(previous);
            previous = cut;
        }
        const a = frames[frames.length - 1]?.meta.partition;
        const b = framesOf(metis.defaultInput)[framesOf(metis.defaultInput).length - 1]?.meta.partition;
        expect(a).toEqual(b);
    });
});
