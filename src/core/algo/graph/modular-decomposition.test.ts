import { describe, expect, it } from "vitest";
import mod, { modularDecomposition, type DecompositionNode } from "./modular-decomposition";

function checkFrame(frame: { stepNumber: number; entities: unknown[]; edges: unknown[]; description: string; codeLineNumber?: number; layout: string; meta: object }, lines: number): void {
    expect(Number.isInteger(frame.stepNumber)).toBe(true);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber as number).toBeLessThan(lines);
    expect(frame.layout).toBe("graph");
    expect(frame.meta).toBeTypeOf("object");
}

function allNodes(root: DecompositionNode): DecompositionNode[] {
    return [root, ...root.children.flatMap(allNodes)];
}

function symmetrize(graph: Record<string, string[]>): Set<string> {
    const edges = new Set<string>();
    for (const [u, vs] of Object.entries(graph)) for (const v of vs) edges.add([u, v].sort().join("-"));
    return edges;
}

describe("Modular Decomposition", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(2);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("classifies the canonical small graphs correctly", () => {
        const clique: Record<string, string[]> = { a: ["b", "c", "d"], b: ["a", "c", "d"], c: ["a", "b", "d"], d: ["a", "b", "c"] };
        const empty: Record<string, string[]> = { a: [], b: [], c: [], d: [] };
        const path: Record<string, string[]> = { a: ["b"], b: ["a", "c"], c: ["b", "d"], d: ["c"] };
        expect(modularDecomposition(clique).type).toBe("series");
        expect(modularDecomposition(empty).type).toBe("coseries");
        const p4 = modularDecomposition(path);
        expect(p4.type).toBe("prime");
        expect(p4.children.length).toBe(4);
    });

    it("builds a laminar tree whose children partition their parent and are modules", () => {
        const graph = (mod.defaultInput as { graph: Record<string, string[]> }).graph;
        const edges = symmetrize(graph);
        const labels = Object.keys(graph);
        const tree = modularDecomposition(graph);
        for (const node of allNodes(tree)) {
            if (node.children.length === 0) continue;
            const union = node.children.flatMap((c) => c.members).sort();
            expect(union).toEqual([...node.members].sort());
            for (const child of node.children) {
                for (const x of labels) {
                    if (child.members.includes(x)) continue;
                    const adjacencies = child.members.map((m) => edges.has([x, m].sort().join("-")));
                    expect(new Set(adjacencies).size).toBe(1);
                }
            }
            const allPairs = node.members.flatMap((a, i) => node.members.slice(i + 1).map((b) => edges.has([a, b].sort().join("-"))));
            const allAdjacent = allPairs.every(Boolean);
            const noneAdjacent = allPairs.every((x) => !x);
            if (node.type === "series") expect(allAdjacent).toBe(true);
            if (node.type === "coseries") expect(noneAdjacent).toBe(true);
            if (node.type === "prime") expect(allAdjacent && noneAdjacent).toBe(false);
        }
        expect([...tree.members].sort()).toEqual(labels.sort());
    });
});
