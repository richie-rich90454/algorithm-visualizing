/**
 * dsu-rollback.ts – DSU with Rollback
 *
 * Union-find without path compression but with union by size records
 * every merge on a stack, so undo rewinds to any snapshot – the engine
 * behind offline divide-and-conquer connectivity.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as {
            n?: number;
            ops?: Array<["union" | "undo" | "query", number?, number?]>;
        } | null) ?? {};
    const n = task.n ?? 4;
    const ops = task.ops ?? [
        ["union", 0, 1],
        ["union", 2, 3],
        ["query", 0, 2],
        ["undo"],
        ["query", 2, 3],
    ];
    let step = 0;

    const parent = Array.from({ length: n }, (_, i) => i);
    const size = new Array<number>(n).fill(1);
    const history: Array<{ child: number; parent: number; sizeParent: number } | null> = [];
    const find = (x: number): number => {
        let r = x;
        while (parent[r] !== r) {
            r = parent[r] ?? r;
        }
        return r;
    };
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => ({
        stepNumber: step,
        entities: parent.map((p, i) => ({
            id: `dr-${i}`,
            type: "cell" as const,
            label: `${i}>${p}`,
            value: p,
            state: (hot.has(i) ? "comparing" : find(i) === i ? "highlight" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: i },
        })),
        edges: [],
        description: message,
        codeLineNumber: line,
        layout: "grid",
        meta: { components: new Set(parent.map((_, i) => find(i))).size, history: history.length },
    });

    yield snap(new Set(), `DSU over ${n} singletons – roots highlighted.`, 0);
    step += 1;
    for (const [op, a, b] of ops) {
        if (op === "union" && a !== undefined && b !== undefined) {
            let ra = find(a);
            let rb = find(b);
            if (ra === rb) {
                history.push(null);
                yield snap(
                    new Set([a, b]),
                    `union(${a},${b}) – already together, no-op recorded.`,
                    1,
                );
            } else {
                if ((size[ra] ?? 0) < (size[rb] ?? 0)) {
                    [ra, rb] = [rb, ra];
                }
                history.push({ child: rb, parent: ra, sizeParent: size[ra] ?? 0 });
                parent[rb] = ra;
                size[ra] = (size[ra] ?? 0) + (size[rb] ?? 0);
                yield snap(
                    new Set([a, b]),
                    `union(${a},${b}) – ${rb} joins ${ra}, change pushed.`,
                    1,
                );
            }
        } else if (op === "undo") {
            const last = history.pop();
            if (last !== null && last !== undefined) {
                parent[last.child] = last.child;
                size[last.parent] = last.sizeParent;
                yield snap(
                    new Set([last.child]),
                    `undo – ${last.child} detached from ${last.parent}.`,
                    2,
                );
            } else {
                yield snap(new Set(), "undo – top of stack was a no-op.", 2);
            }
        } else if (op === "query" && a !== undefined && b !== undefined) {
            const same = find(a) === find(b);
            yield snap(
                new Set([a, b]),
                same ? `${a} and ${b} are connected.` : `${a} and ${b} are separate.`,
                3,
            );
        }
        step += 1;
    }
    yield snap(new Set(), `Final components: ${new Set(parent.map((_, i) => find(i))).size}.`, 4);
}

const module: AlgorithmModule = {

    education: {
        "intuition": "A rollback DSU supports undo by recording every parent or rank change on a stack and never using path compression. To rewind, it pops changes back to a saved snapshot. This makes union-find usable in offline algorithms that need to revisit earlier states, such as divide-and-conquer connectivity.",
        "invariants": [
            "Each union pushes the previous values of the modified parent and rank.",
            "Rollback restores exactly the state at the chosen snapshot.",
            "Without path compression, find follows an unchanged parent chain."
        ],
        "correctness": "Because every mutation is recorded before it happens, popping the stack in reverse order restores each field to its prior value. Union by size keeps trees shallow enough without compression. Therefore a query after rollback sees precisely the partition that existed at the snapshot.",
        "complexityRationale": "Find costs O(log n) because union by size bounds tree height, and rollback is proportional to the number of changes undone. Recording each change uses O(n + ops) space for the stack.",
        "uses": [
            "Offline dynamic connectivity",
            "Divide-and-conquer over time intervals",
            "Problems requiring undo of merges"
        ],
        "references": [
            "Robert Tarjan, \"Efficiency of a Good But Not Linear Set Union Algorithm\", JACM 1975",
            "Steven Halim, Competitive Programming 3, rollback union-find section"
        ],
        "workedExample": "Union(1,2) records that parent[2] changed from 2 to 1; snapshot depth is 1. Union(3,4) adds another change. Rolling back to depth 1 pops the second change, so 3 and 4 are separate again while 1 and 2 remain joined."
    },
    id: "dsu-rollback",
    name: "DSU Rollback",
    category: "data-structures",
    complexity: { time: "O(log n) amortized", space: "O(n + ops)" },
    defaultInput: {
        n: 4,
        ops: [["union", 0, 1], ["union", 2, 3], ["query", 0, 2], ["undo"], ["query", 2, 3]],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize DSU with each element as its own parent",
        "find root by climbing parent pointers",
        "compare ranks and attach smaller tree under larger",
        "record change on rollback stack before mutation",
        "union pair and push parent and rank changes",
        "rollback to snapshot by popping stack entries",
        "done: DSU holds sets with rollback restored state",
    ],
};

export default module;
