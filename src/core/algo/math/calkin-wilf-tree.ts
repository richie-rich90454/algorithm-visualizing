/**
 * calkin-wilf-tree.ts - Calkin-Wilf Enumeration of the Rationals
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The Calkin-Wilf tree lists every positive reduced fraction exactly once.
 * Its root is 1/1, and a node a/b has children a/(a+b) and (a+b)/b. Reading the
 * tree breadth first gives the Calkin-Wilf sequence, whose n-th term equals
 * Stern's diatomic value fusc(n) over fusc(n+1). Walking a fraction back to the
 * root by subtracting the smaller entry from the larger recovers its left/right
 * path and proves membership.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n) to emit the first n fractions, O(log(a+b)) to find a path
 *   Space: O(n) for the stored tree nodes
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each fraction is a tree node, with a directed edge from its parent.
 *   - The current level's nodes are GREEN; earlier levels are GREY.
 *   - The final frame lists the breadth-first sequence and its checks.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Node {
    a: number;
    b: number;
    parent: number;
    direction: string;
}

function gcd(a: number, b: number): number {
    let x = a;
    let y = b;
    while (y !== 0) {
        const t = x % y;
        x = y;
        y = t;
    }
    return x;
}

/** Breadth-first Calkin-Wilf tree with left child a/(a+b), right child (a+b)/b. */
function generate(count: number): Node[] {
    const nodes: Node[] = [{ a: 1, b: 1, parent: -1, direction: "" }];
    let cursor = 0;
    while (nodes.length < count && cursor < nodes.length) {
        const current = nodes[cursor]!;
        nodes.push({ a: current.a, b: current.a + current.b, parent: cursor, direction: "L" });
        if (nodes.length >= count) break;
        nodes.push({ a: current.a + current.b, b: current.b, parent: cursor, direction: "R" });
        cursor += 1;
    }
    return nodes;
}

/** Recover the left/right path from the root to a reduced fraction. */
function pathTo(aInput: number, bInput: number): string {
    let a = aInput;
    let b = bInput;
    let path = "";
    let guard = 0;
    while (a !== b && guard < 10000) {
        guard += 1;
        if (a < b) {
            path += "L";
            b -= a;
        } else {
            path += "R";
            a -= b;
        }
    }
    return path.split("").reverse().join("");
}

function nodeEntities(nodes: Node[], activeDepth: number, highlightIndex = -1): VisualEntity[] {
    return nodes.map((node, index) => {
        const depth = Math.floor(Math.log2(index + 1));
        return {
            id: `node-${index}`,
            type: "node" as const,
            label: `${node.a}/${node.b}`,
            value: node.a / node.b,
            state: (index === highlightIndex
                ? "highlight"
                : depth === activeDepth
                  ? "sorted"
                  : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: {
                parentId: node.parent >= 0 ? `node-${node.parent}` : "",
                depth,
                a: node.a,
                b: node.b,
            },
        };
    });
}

function edgesFor(nodes: Node[]): VisualFrame["edges"] {
    return nodes
        .filter((node) => node.parent >= 0)
        .map((node, index) => ({
            id: `edge-${index}`,
            sourceId: `node-${node.parent}`,
            targetId: `node-${nodes.findIndex((n) => n === node)}`,
            label: node.direction,
            state: "idle" as EntityState,
            directed: true,
        }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { count?: number; targetA?: number; targetB?: number } | null) ?? {};
    const count = Math.max(1, Math.min(40, Math.trunc(task.count ?? 15)));
    const nodes = generate(count);
    let step = 0;

    yield {
        stepNumber: step,
        entities: nodeEntities([nodes[0]!], 0),
        edges: [],
        description: `The Calkin-Wilf tree starts at 1/1 and enumerates every positive rational exactly once.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { step, count },
    };
    step += 1;

    const maxDepth = Math.floor(Math.log2(nodes.length));
    for (let depth = 1; depth <= maxDepth; depth += 1) {
        const lastIndex = Math.min(nodes.length, 2 ** (depth + 1) - 1);
        yield {
            stepNumber: step,
            entities: nodeEntities(nodes.slice(0, lastIndex), depth),
            edges: edgesFor(nodes.slice(0, lastIndex)),
            description: `Expand level ${depth}: each a/b grows a/(a+b) on the left and (a+b)/b on the right.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { step, depth, nodesShown: lastIndex },
        };
        step += 1;
    }

    if (typeof task.targetA === "number" && typeof task.targetB === "number") {
        const ta = Math.trunc(task.targetA);
        const tb = Math.trunc(task.targetB);
        if (ta > 0 && tb > 0) {
            const path = pathTo(ta, tb);
            const found = nodes.findIndex((node) => node.a === ta && node.b === tb);
            yield {
                stepNumber: step,
                entities: nodeEntities(nodes, -1, found),
                edges: edgesFor(nodes),
                description:
                    found >= 0
                        ? `Target ${ta}/${tb} is node ${found}, reached by the path ${path || "(root)"}.`
                        : `Target ${ta}/${tb} has path ${path || "(root)"} but lies beyond the first ${count} nodes.`,
                codeLineNumber: 4,
                layout: "tree",
                meta: { step, target: `${ta}/${tb}`, path, index: found },
            };
            step += 1;
        }
    }

    const fractions = nodes.map((node) => `${node.a}/${node.b}`);
    const allReduced = nodes.every((node) => gcd(node.a, node.b) === 1);
    const unique = new Set(fractions).size === fractions.length;
    yield {
        stepNumber: step,
        entities: nodeEntities(nodes, -1).map((entity) => ({
            ...entity,
            state: "sorted" as EntityState,
        })),
        edges: edgesFor(nodes),
        description: `Breadth-first sequence: ${fractions.slice(0, 8).join(", ")}${fractions.length > 8 ? ", ..." : ""}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: {
            step,
            fractions,
            allReduced,
            unique,
            nodes: nodes.length,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "The Calkin-Wilf tree is an infinite binary tree that somehow manages to contain every positive fraction in lowest terms once and only once. From a/b you go to a/(a+b) on the left and (a+b)/b on the right, so the child numerators and denominators are formed by simple sums. Running backwards, repeatedly subtract the smaller of a and b from the larger until they are equal; the sequence of left and right moves is the fraction's address.",
        invariants: [
            "Every node a/b has gcd(a, b) = 1 because a child is formed from coprime sums.",
            "The left child is always less than one and the right child always greater than one.",
            "Backward subtraction strictly decreases a + b until the root 1/1 is reached.",
        ],
        correctness:
            "Children of a reduced fraction stay reduced since gcd(a, a+b) = gcd(a, b) = 1 and gcd(a+b, b) = 1. The backward map is the exact inverse: if a < b the node came from a/(b-a) as a left child, and if a > b it came from (a-b)/b as a right child; each step lowers a + b so it terminates at the root. Therefore every positive rational has a unique path from the root and appears exactly once in the breadth-first listing. The equality with fusc(n)/fusc(n+1) follows from the same two recurrence branches that define Stern's sequence.",
        complexityRationale:
            "Generating the first n nodes does constant work per node, so O(n) time and O(n) space. Recovering a path by backward subtraction needs at most a + b steps in the worst case, or O(log(a+b)) when read as continued-fraction divisions, with O(1) working space.",
        uses: [
            "Enumerating all positive rationals without duplicates",
            "Generating Stern-Brocot style rational approximations",
            "Exploring the Stern diatomic sequence and continued fractions",
        ],
        references: [
            "Calkin and Wilf, Recounting the Rationals, 2000",
            "Graham, Knuth and Patashnik, Concrete Mathematics, Chapter 6",
        ],
        workedExample:
            "Starting at 1/1, the left child is 1/2 and the right child 2/1. Expanding 1/2 gives 1/3 and 3/2, and expanding 2/1 gives 2/3 and 3/1, so the breadth-first sequence begins 1/1, 1/2, 2/1, 1/3, 3/2, 2/3, 3/1. To find 3/2, subtract: 3 > 2 so go right from 1/2, then 1 < 2 so go left from 1/1, giving the path L then R from the root.",
    },
    id: "calkin-wilf-tree",
    name: "Calkin-Wilf Tree",
    category: "math",
    complexity: { time: "O(n) generation", space: "O(n)" },
    defaultInput: { count: 15 },
    visualType: "tree",
    run,
    pseudocode: [
        "start the tree with the root fraction 1/1",
        "for each node a/b expand its two children",
        "left child is a over a plus b",
        "right child is a plus b over b",
        "continue breadth first until enough nodes exist",
        "to locate a fraction subtract smaller from larger",
        "record left or right at each backward step",
        "done: the enumerated rationals and the target path",
    ],
};

export default module;
