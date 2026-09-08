/**
 * van-emde-boas-tree.ts – van Emde Boas Tree
 *
 * Sqrt-decomposition over a fixed universe: min/max shortcuts plus a
 * summary of non-empty clusters. Predecessor walks clusters, not keys.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

const U = 16;
const C = 4;

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { keys?: number[]; query?: number } | null) ?? {};
    const insertKeys = task.keys ?? [2, 5, 11];
    const query = task.query ?? 6;
    let step = 0;

    const present = new Set<number>();
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        const arr = [...present].sort((a, b) => a - b);
        const mn = arr.length > 0 ? (arr[0] ?? -1) : -1;
        const mx = arr.length > 0 ? (arr[arr.length - 1] ?? -1) : -1;
        entities.push({
            id: "veb-minmax",
            type: "cell" as const,
            label: `min=${mn} max=${mx}`,
            value: mx,
            state: "highlight" as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { row: 0, col: 0 },
        });
        for (let c = 0; c < C; c += 1) {
            const members = arr.filter((k) => Math.floor(k / C) === c);
            entities.push({
                id: `veb-sum-${c}`,
                type: "cell" as const,
                label: members.length > 0 ? `C${c}*` : `C${c}-`,
                value: members.length,
                state: (hot.has(c) ? "comparing" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 1, col: c },
            });
        }
        arr.forEach((k, i) => {
            entities.push({
                id: `veb-k-${k}`,
                type: "cell" as const,
                label: String(k),
                value: k,
                state: (hot.has(10 + k) ? "sorted" : "idle") as EntityState,
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: 2, col: i },
            });
        });
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { universe: U, stored: present.size, query },
        };
    };

    yield snap(new Set(), `Empty vEB tree over universe ${U} – 4 clusters of 4.`, 0);
    step += 1;
    for (const k of insertKeys) {
        present.add(k);
        const c = Math.floor(k / C);
        yield snap(
            new Set([c, 10 + k]),
            `Inserted ${k}: summary marks cluster ${c}, min/max updated.`,
            1,
        );
        step += 1;
    }

    const arr = [...present].sort((a, b) => a - b);
    const hc = Math.floor(query / C);
    const lc = query % C;
    yield snap(new Set([hc]), `Query ${query}: high cluster ${hc}, low ${lc}.`, 2);
    step += 1;
    const inCluster = arr.filter((k) => Math.floor(k / C) === hc && k % C < lc);
    let answer: number;
    if (inCluster.length > 0) {
        answer = Math.max(...inCluster);
        yield snap(
            new Set([hc, 10 + answer]),
            `Cluster ${hc} holds ${answer} below low ${lc} – answer ${answer}.`,
            3,
        );
    } else {
        const prev = arr.filter((k) => Math.floor(k / C) < hc);
        answer = prev.length > 0 ? Math.max(...prev) : (arr[0] ?? -1);
        yield snap(
            new Set([hc]),
            `Cluster ${hc} empty below ${lc} – summary steps to previous cluster: ${answer}.`,
            3,
        );
    }
    step += 1;
    yield snap(new Set([10 + answer]), `predecessor(${query}) = ${answer}.`, 4);
}

const module: AlgorithmModule = {
    id: "van-emde-boas-tree",
    name: "van Emde Boas Tree",
    category: "data-structures",
    complexity: { time: "O(log log U)", space: "O(U)" },
    defaultInput: { keys: [2, 5, 11], query: 6 },
    visualType: "grid",
    run,
};

export default module;
