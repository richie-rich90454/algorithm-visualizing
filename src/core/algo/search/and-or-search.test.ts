import { describe, expect, it } from "vitest";
import mod from "./and-or-search";

interface Node { id: string; op: "OR" | "AND" | "LEAF"; children?: string[]; solved?: boolean }

function checkFrame(frame: { stepNumber: number; entities: unknown[]; edges: unknown[]; description: string; codeLineNumber?: number; layout: string; meta: object }, lines: number): void {
    expect(Number.isInteger(frame.stepNumber)).toBe(true);
    expect(frame.entities.length).toBeGreaterThan(0);
    expect(Array.isArray(frame.edges)).toBe(true);
    expect(frame.description.length).toBeGreaterThanOrEqual(10);
    expect(frame.codeLineNumber).toBeGreaterThanOrEqual(0);
    expect(frame.codeLineNumber as number).toBeLessThan(lines);
    expect(frame.layout).toBe("tree");
    expect(frame.meta).toBeTypeOf("object");
}

function brute(nodes: Map<string, Node>, id: string, memo = new Map<string, { ok: boolean; proof: string[] }>()): { ok: boolean; proof: string[] } {
    const cached = memo.get(id);
    if (cached) return cached;
    const node = nodes.get(id) as Node;
    let result: { ok: boolean; proof: string[] };
    if (node.op === "LEAF") {
        const ok = node.solved === true;
        result = { ok, proof: ok ? [id] : [] };
    } else if (node.op === "OR") {
        result = { ok: false, proof: [] };
        for (const c of node.children ?? []) {
            const r = brute(nodes, c, memo);
            if (r.ok) {
                result = { ok: true, proof: [id, ...r.proof] };
                break;
            }
        }
    } else {
        const proof: string[] = [id];
        let ok = (node.children ?? []).length > 0;
        for (const c of node.children ?? []) {
            const r = brute(nodes, c, memo);
            if (!r.ok) ok = false;
            else proof.push(...r.proof);
        }
        result = { ok, proof: ok ? proof : [] };
    }
    memo.set(id, result);
    return result;
}

describe("AND/OR Search", () => {
    const lines = mod.pseudocode?.length ?? 1;

    it("yields sequential, well-formed frames and terminates", () => {
        const frames = [...mod.run(mod.defaultInput)];
        expect(frames.length).toBeGreaterThan(3);
        frames.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            checkFrame(f, lines);
        });
    });

    it("matches a brute-force AND/OR evaluator on several trees", () => {
        const trees: Array<{ root: string; nodes: Node[] }> = [
            mod.defaultInput as { root: string; nodes: Node[] },
            {
                root: "r",
                nodes: [
                    { id: "r", op: "AND", children: ["x", "y"] },
                    { id: "x", op: "LEAF", solved: true },
                    { id: "y", op: "LEAF", solved: true },
                ],
            },
            {
                root: "r",
                nodes: [
                    { id: "r", op: "OR", children: ["x", "y"] },
                    { id: "x", op: "LEAF", solved: false },
                    { id: "y", op: "LEAF", solved: false },
                ],
            },
            {
                root: "r",
                nodes: [
                    { id: "r", op: "OR", children: ["a", "b"] },
                    { id: "a", op: "AND", children: ["a1", "a2"] },
                    { id: "a1", op: "LEAF", solved: true },
                    { id: "a2", op: "LEAF", solved: true },
                    { id: "b", op: "LEAF", solved: true },
                ],
            },
        ];
        for (const tree of trees) {
            const frames = [...mod.run(tree)];
            const last = frames[frames.length - 1];
            const expected = brute(new Map(tree.nodes.map((n) => [n.id, n])), tree.root);
            expect(last?.meta["solved"]).toBe(expected.ok);
            expect([...(last?.meta["proof"] as string[] ?? [])].sort()).toEqual([...expected.proof].sort());
        }
    });
});
