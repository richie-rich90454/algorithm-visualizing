/**
 * barrier-tree.ts - Tree-Based Barrier Synchronization
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A tree barrier arranges processes as the leaves of a binary tree. On arrival
 * a process signals its parent; an internal node signals its own parent only
 * after every child has arrived. When the root hears from all children the
 * barrier releases, and the release signal travels back down the tree so every
 * process may continue. Compared with a centralized counter, the tree spreads
 * the arrival traffic across log p nodes.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(log p) arrival and O(log p) release on a balanced tree
 *   Space: O(p) for the tree nodes and edges
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Tree nodes are processes (leaves) and internal group nodes.
 *   - An arriving node is active; a released node is green.
 *   - Edges light up when a signal travels along them.
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type BarrierInput = { processes?: number };

interface BarrierNode {
    id: string;
    children: string[];
    parent: string | null;
    level: number;
    process: number | null;
}

function buildBarrierTree(processes: number): { nodes: BarrierNode[]; root: string; height: number } {
    const nodes: BarrierNode[] = [];
    let current: BarrierNode[] = [];
    for (let i = 0; i < processes; i += 1) {
        const leaf: BarrierNode = { id: `proc-${i}`, children: [], parent: null, level: 0, process: i };
        nodes.push(leaf);
        current.push(leaf);
    }
    let level = 0;
    while (current.length > 1) {
        const next: BarrierNode[] = [];
        for (let i = 0; i < current.length; i += 2) {
            if (i + 1 < current.length) {
                const left = current[i] as BarrierNode;
                const right = current[i + 1] as BarrierNode;
                const parent: BarrierNode = {
                    id: `node-${level + 1}-${Math.floor(i / 2)}`,
                    children: [left.id, right.id],
                    parent: null,
                    level: level + 1,
                    process: null,
                };
                left.parent = parent.id;
                right.parent = parent.id;
                nodes.push(parent);
                next.push(parent);
            } else {
                next.push(current[i] as BarrierNode);
            }
        }
        current = next;
        level += 1;
    }
    const root = (current[0] as BarrierNode).id;
    return { nodes, root, height: level };
}

function makeEntities(
    nodes: BarrierNode[],
    arrived: Set<string>,
    released: Set<string>,
    activeId: string,
): VisualEntity[] {
    return nodes.map((node) => {
        let state: EntityState = "unvisited";
        if (released.has(node.id)) {
            state = "sorted";
        } else if (activeId === node.id) {
            state = "active";
        } else if (arrived.has(node.id)) {
            state = "visited";
        }
        return {
            id: node.id,
            type: "node" as const,
            label: node.process === null ? node.id : `P${node.process}`,
            value: node.process ?? node.id,
            state,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { depth: node.level, parentId: node.parent ?? "", process: node.process ?? -1 },
        };
    });
}

function makeEdges(nodes: BarrierNode[], hot: Set<string>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const node of nodes) {
        for (const child of node.children) {
            const id = `edge-${node.id}-${child}`;
            edges.push({
                id,
                sourceId: child,
                targetId: node.id,
                label: "",
                state: hot.has(id) ? "active" : "idle",
                directed: true,
            });
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as BarrierInput | null) ?? {};
    const processes = typeof task.processes === "number" ? Math.max(2, Math.min(16, task.processes)) : 8;
    const { nodes, root, height } = buildBarrierTree(processes);
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const arrived = new Set<string>();
    const released = new Set<string>();
    const hot = new Set<string>();
    let step = 0;

    yield {
        stepNumber: step,
        entities: makeEntities(nodes, arrived, released, ""),
        edges: makeEdges(nodes, hot),
        description: `Tree barrier built for ${processes} processes with height ${height}; all processes wait.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { processes, height, phase: "waiting", arrived: 0, released: 0 },
    };
    step += 1;

    for (let p = 0; p < processes; p += 1) {
        const leaf = `proc-${p}`;
        arrived.add(leaf);
        hot.clear();
        const parent = byId.get(leaf)?.parent;
        if (parent) {
            hot.add(`edge-${leaf}-${parent}`);
        }
        yield {
            stepNumber: step,
            entities: makeEntities(nodes, arrived, released, leaf),
            edges: makeEdges(nodes, hot),
            description: `Process ${p} arrives at the barrier and signals its parent ${parent ?? "none"}.`,
            codeLineNumber: 2,
            layout: "tree",
            meta: { processes, height, phase: "arrival", arrived: arrived.size, released: 0 },
        };
        step += 1;

        let current = parent;
        while (current) {
            const node = byId.get(current) as BarrierNode;
            const allArrived = node.children.every((child) => arrived.has(child));
            if (!allArrived) {
                break;
            }
            arrived.add(node.id);
            hot.clear();
            if (node.parent) {
                hot.add(`edge-${node.id}-${node.parent}`);
            }
            yield {
                stepNumber: step,
                entities: makeEntities(nodes, arrived, released, node.id),
                edges: makeEdges(nodes, hot),
                description: `Node ${node.id} has heard from all children and forwards the arrival upward.`,
                codeLineNumber: 3,
                layout: "tree",
                meta: { processes, height, phase: "arrival", arrived: arrived.size, released: 0 },
            };
            step += 1;
            current = node.parent;
        }
    }

    hot.clear();
    let frontier = [root];
    while (frontier.length > 0) {
        const next: string[] = [];
        for (const id of frontier) {
            released.add(id);
            const node = byId.get(id) as BarrierNode;
            for (const child of node.children) {
                hot.add(`edge-${node.id}-${child}`);
                next.push(child);
            }
        }
        yield {
            stepNumber: step,
            entities: makeEntities(nodes, arrived, released, ""),
            edges: makeEdges(nodes, hot),
            description: `Barrier released at tree level ${(byId.get(frontier[0] as string) as BarrierNode).level}; release signal travels to children.`,
            codeLineNumber: 5,
            layout: "tree",
            meta: { processes, height, phase: "release", arrived: arrived.size, released: released.size },
        };
        step += 1;
        frontier = next;
    }

    yield {
        stepNumber: step,
        entities: makeEntities(nodes, arrived, released, ""),
        edges: makeEdges(nodes, new Set()),
        description: `Barrier complete: all ${processes} processes were released after every process arrived.`,
        codeLineNumber: 7,
        layout: "tree",
        meta: { processes, height, phase: "done", arrived: arrived.size, released: released.size, complete: released.size === nodes.length },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Put processes at the leaves of a binary tree. A process tells its parent it has arrived; parents wait for all their children before telling the next level up. Once the root knows everyone is ready it sends a release signal down the same tree. No single node talks to all processes.",
        invariants: [
            "A node signals its parent only after all of its children have arrived.",
            "The root releases only after every process has arrived.",
            "A process may continue only after the release reaches its leaf.",
        ],
        correctness:
            "By induction on tree height, an internal node is marked arrived exactly when all leaves below it have arrived, so the root is marked only when all processes are present. The release traverses the same edges in the opposite direction, reaching every leaf exactly once. Therefore no process passes the barrier early and none is left blocked.",
        complexityRationale:
            "The tree has height O(log p) for p leaves, so arrival and release each take O(log p) dependent steps; building and storing the 2p-1 nodes and edges takes O(p) space.",
        uses: [
            "Block synchronizations in parallel numerical solvers",
            "GPU kernel barriers implemented with tree reductions",
            "Collective operations such as broadcast and reduce",
        ],
        references: [
            "Cormen et al., Introduction to Algorithms, Chapter 27 (Synchronization)",
            "Mellor-Crummey and Scott, Algorithms for Scalable Synchronization, 1991",
        ],
        workedExample:
            "Eight processes form a three-level tree. After all eight arrive, four parent nodes each report readiness, then two nodes, then the root. The root releases, the signal splits to two nodes, then four, then all eight leaves, and every process continues.",
    },
    id: "barrier-tree",
    name: "Tree Barrier Synchronization",
    category: "parallel-distributed",
    complexity: { time: "O(log p)", space: "O(p)" },
    defaultInput: { processes: 8 },
    visualType: "tree",
    run,
    pseudocode: [
        "arrange processes as leaves of a binary tree",
        "each arriving process signals its parent",
        "a node waits until all children have arrived",
        "then the node signals its own parent",
        "when the root is reached all processes have arrived",
        "the root releases and signals its children",
        "each node forwards release to its children",
        "done: every process continues past the barrier",
    ],
};

export default module;
