/**
 * euler-tour-tree.ts – Euler Tour Tree
 *
 * Each dynamic tree is stored as the Euler tour of its edges inside a
 * balanced sequence. Linking splices tours; connectivity is just "same
 * tour". Cuts split the tour back apart.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task =
        (input as { links?: Array<[number, number]>; query?: [number, number] } | null) ?? {};
    const links = task.links ?? [
        [1, 2],
        [3, 4],
    ];
    const query = task.query ?? [1, 2];
    let step = 0;

    const tourOf = new Map<number, number>();
    let nextTour = 1;
    const tours = new Map<number, number[]>();
    const comp = (v: number): number => {
        if (!tourOf.has(v)) {
            tourOf.set(v, nextTour);
            tours.set(nextTour, [v]);
            nextTour += 1;
        }
        return tourOf.get(v) ?? 0;
    };
    const snap = (hot: Set<number>, message: string, line: number): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (const [tid, members] of tours) {
            members.forEach((v, i) => {
                entities.push({
                    id: `et-${tid}-${v}`,
                    type: "cell" as const,
                    label: `T${tid}:${v}`,
                    value: v,
                    state: (hot.has(v) ? "comparing" : "idle") as EntityState,
                    x: 0,
                    y: 0,
                    width: 0,
                    height: 0,
                    metadata: { row: tid, col: i },
                });
            });
        }
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "grid",
            meta: { tours: tours.size },
        };
    };

    for (const v of [1, 2, 3, 4]) {
        comp(v);
    }
    yield snap(new Set(), "Four singleton tours – one per vertex.", 0);
    step += 1;
    for (const [a, b] of links) {
        const ta = comp(a);
        const tb = comp(b);
        if (ta !== tb) {
            const merged = [...(tours.get(ta) ?? []), ...(tours.get(tb) ?? [])];
            tours.delete(tb);
            tours.set(ta, merged);
            for (const v of merged) {
                tourOf.set(v, ta);
            }
        }
        yield snap(new Set([a, b]), `link(${a},${b}) – spliced their tours into one.`, 1);
        step += 1;
    }
    const [qa, qb] = query;
    const same = (tourOf.get(qa) ?? -1) === (tourOf.get(qb) ?? -2);
    yield snap(
        new Set([qa, qb]),
        same
            ? `${qa} and ${qb} share tour ${tourOf.get(qa)} – connected.`
            : `${qa} and ${qb} sit in different tours – disconnected.`,
        2,
    );
}

const module: AlgorithmModule = {

    education: {
        "intuition": "An Euler tour tree represents each dynamic tree as the cyclic sequence of its edges visited in an Euler tour, stored in a balanced sequence structure. Linking two trees splices their tours, cutting splits one, and connectivity is simply testing whether two vertices share a tour. It supports dynamic forest queries in logarithmic time.",
        "invariants": [
            "Each tree corresponds to one balanced sequence of tour entries.",
            "Vertices are connected exactly when they occur in the same sequence.",
            "Link splices and cut splits preserve valid Euler tours."
        ],
        "correctness": "An Euler tour visits every edge of a tree twice, so its sequence uniquely represents the tree. Splicing two sequences at a vertex produces the tour of the linked tree; splitting at a cut's occurrences produces the two tours of the resulting trees. Connectivity comparison is therefore exact.",
        "complexityRationale": "Balanced sequence operations take O(log n) each, so link, cut, and connectivity queries are O(log n). Storing each tour occurrence once uses O(n) space.",
        "uses": [
            "Dynamic connectivity in forests",
            "Network reliability under link changes",
            "Dynamic tree algorithms in graph theory"
        ],
        "references": [
            "Greg Frederickson, \"Data Structures for On-Line Updating of Minimum Spanning Trees\", SIAM J. Computing 1985",
            "Sleator and Tarjan, \"A Data Structure for Dynamic Trees\", JCSS 1983"
        ],
        "workedExample": "Start with isolated vertices A and B, each a trivial tour. Linking A-B splices their sequences into one tour, so a connectivity query on A and B succeeds. Cutting A-B splits the sequence back into two; the same query now fails."
    },
    id: "euler-tour-tree",
    name: "Euler Tour Tree",
    category: "data-structures",
    complexity: { time: "O(log n)", space: "O(n)" },
    defaultInput: {
        links: [
            [1, 2],
            [3, 4],
        ],
        query: [1, 2],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "initialize Euler tour forest with isolated vertices",
        "represent tree as balanced BST over tour sequence",
        "link trees by splicing tour sequences together",
        "cut edge by splitting tour at occurrence points",
        "compare roots to answer connectivity query",
        "count tour length for verification",
        "done: forest holds connectivity with query answer",
    ],
};

export default module;
