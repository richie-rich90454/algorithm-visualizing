import { describe, expect, it } from "vitest";
import mod from "./sss-star";

type RawNode = number | { type: "max" | "min"; children: RawNode[] };

/** Independent minimax reference: MAX takes the largest child, MIN the smallest. */
function minimax(raw: RawNode): number {
    if (typeof raw === "number") return raw;
    const values = raw.children.map(minimax);
    return raw.type === "max" ? Math.max(...values) : Math.min(...values);
}

function answerFor(tree: RawNode): number {
    const all = [...mod.run({ tree })];
    return Number(all[all.length - 1]!.meta["answer"]);
}

function randomTree(depth: number, type: "max" | "min", seed: { value: number }): RawNode {
    const rnd = (): number => {
        seed.value = (seed.value * 1103515245 + 12345) & 0x7fffffff;
        return seed.value / 0x7fffffff;
    };
    if (depth === 0) return Math.floor(rnd() * 21); // leaf utility 0..20
    const count = 1 + Math.floor(rnd() * 3); // 1..3 children
    const next = type === "max" ? "min" : "max";
    const children: RawNode[] = [];
    for (let i = 0; i < count; i += 1) children.push(randomTree(depth - 1, next, seed));
    return { type, children };
}

describe("SSS* Best-First Search", () => {
    it("matches minimax on the default game tree", () => {
        const tree = (mod.defaultInput as { tree: RawNode }).tree;
        expect(answerFor(tree)).toBe(minimax(tree));
    });

    it("matches minimax across many random game trees", () => {
        for (let seed = 1; seed <= 120; seed += 1) {
            const tree = randomTree(3, "max", { value: seed * 7919 });
            expect(answerFor(tree), `seed ${seed}`).toBe(minimax(tree));
        }
    });

    it("handles a single leaf and shallow trees", () => {
        expect(answerFor(7)).toBe(7);
        expect(answerFor({ type: "max", children: [1, 9, 4] })).toBe(9);
        expect(answerFor({ type: "min", children: [1, 9, 4] })).toBe(1);
    });

    it("produces well-formed frames and terminates", () => {
        const all = [...mod.run(mod.defaultInput)];
        expect(all.length).toBeGreaterThan(3);
        all.forEach((f, i) => {
            expect(f.stepNumber).toBe(i);
            expect(f.layout).toBe("tree");
            expect(f.description.length).toBeGreaterThanOrEqual(10);
            expect(f.codeLineNumber).toBeGreaterThanOrEqual(0);
            expect(f.codeLineNumber!).toBeLessThan(mod.pseudocode!.length);
            expect(f.meta).toBeDefined();
            expect(f.entities.length).toBeGreaterThan(0);
            expect(f.edges.length).toBeGreaterThan(0);
            for (const e of f.entities) {
                expect(e.id).toBeTruthy();
                expect(typeof e.label).toBe("string");
                expect(["idle", "active", "comparing", "swapped", "sorted", "pivot", "visited", "path", "highlight", "error", "unvisited"]).toContain(e.state);
                expect(Number.isFinite(e.x)).toBe(true);
                expect(Number.isFinite(e.y)).toBe(true);
            }
            for (const edge of f.edges) {
                expect(f.entities.some((e) => e.id === edge.sourceId)).toBe(true);
                expect(f.entities.some((e) => e.id === edge.targetId)).toBe(true);
            }
        });
        expect(Number(all[all.length - 1]!.meta["answer"])).toBe(6);
    });
});
