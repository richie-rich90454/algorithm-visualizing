/**
 * fork-join.ts - Fork-Join Parallelism and the Work/Span Model
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Fork-join is the structured model of task parallelism: a task may spawn
 * (fork) subtasks and then wait (join) for them before continuing. The
 * computation forms a tree. Two numbers predict its speed: work T1 is the total
 * number of tasks, and span Tinf is the length of the longest root-to-leaf path.
 * Brent's bound says that on P processors the running time is at most T1/P +
 * Tinf, so the model explains both how parallelism helps and why the critical
 * path ultimately limits the speedup. This module builds the task tree of a
 * recursive Fibonacci computation.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(T1) tasks total, O(Tinf) on unbounded processors
 *   Space: O(T1) for the task tree
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each node is one spawned task, labeled with its Fibonacci argument.
 *   - Edges connect a task to the subtasks it forks.
 *   - The final meta reports work, span, parallelism, and Brent's bound.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualEdge, VisualFrame } from "@/types";

interface ForkJoinInput {
    n?: number;
    processors?: number;
}

interface TaskNode {
    id: string;
    label: string;
    parentId: string;
    depth: number;
    k: number;
}

/** Build the fork-join task tree in breadth-first order. */
function buildTree(n: number): TaskNode[] {
    const nodes: TaskNode[] = [];
    let next = 0;
    const queue: Array<{ k: number; parentId: string; depth: number }> = [{ k: n, parentId: "root", depth: 0 }];
    while (queue.length > 0) {
        const item = queue.shift()!;
        const id = `node-${next}`;
        next += 1;
        nodes.push({ id, label: `fib(${item.k})`, parentId: item.parentId, depth: item.depth, k: item.k });
        if (item.k > 1) {
            queue.push({ k: item.k - 1, parentId: id, depth: item.depth + 1 });
            queue.push({ k: item.k - 2, parentId: id, depth: item.depth + 1 });
        }
    }
    return nodes;
}

function makeEntities(visible: TaskNode[], active: string | null): VisualEntity[] {
    return visible.map((node) => ({
        id: node.id,
        type: "node" as const,
        label: node.label,
        value: node.k,
        state: (node.id === active ? "comparing" : node.k <= 1 ? "sorted" : "active") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { parentId: node.parentId === "root" ? "root" : node.parentId, depth: node.depth, work: node.k },
    }));
}

function makeEdges(visible: TaskNode[]): VisualEdge[] {
    const ids = new Set(visible.map((node) => node.id));
    return visible
        .filter((node) => node.parentId !== "root" && ids.has(node.parentId))
        .map((node) => ({
            id: `edge-${node.parentId}-${node.id}`,
            sourceId: node.parentId,
            targetId: node.id,
            label: "fork",
            state: "idle" as EntityState,
            directed: true,
        }));
}

/** The fork-join generator. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as ForkJoinInput | null) ?? {};
    const n = typeof task.n === "number" && task.n >= 1 ? Math.min(12, Math.floor(task.n)) : 6;
    const processors = typeof task.processors === "number" && task.processors >= 1 ? Math.floor(task.processors) : 4;
    const nodes = buildTree(n);
    const work = nodes.length;
    const span = nodes.reduce((max, node) => Math.max(max, node.depth + 1), 0);
    const parallelism = work / span;
    const bound = Math.ceil(work / processors) + span;
    const visible: TaskNode[] = [];
    let step = 0;

    yield {
        stepNumber: step++,
        entities: makeEntities(visible, null),
        edges: [],
        description: `Fork-join Fibonacci(${n}) on ${processors} processor(s); work ${work}, span ${span}.`,
        codeLineNumber: 0,
        layout: "tree",
        meta: { work, span, processors, parallelism, bound, placed: 0, done: false },
    };

    for (const node of nodes) {
        visible.push(node);
        const done = visible.length === nodes.length;
        yield {
            stepNumber: step++,
            entities: makeEntities(visible, node.id),
            edges: makeEdges(visible),
            description: node.k <= 1
                ? `Task fib(${node.k}) reaches the base case and returns.`
                : `Task fib(${node.k}) forks fib(${node.k - 1}) and fib(${node.k - 2}), then joins.`,
            codeLineNumber: node.k <= 1 ? 1 : 2,
            layout: "tree",
            meta: { work, span, processors, parallelism, bound, placed: visible.length, done },
        };
    }

    yield {
        stepNumber: step,
        entities: makeEntities(visible, null),
        edges: makeEdges(visible),
        description: `Finished with work ${work}, span ${span}, parallelism ${parallelism.toFixed(2)}, and Brent bound ${bound}.`,
        codeLineNumber: 6,
        layout: "tree",
        meta: { work, span, processors, parallelism, bound, placed: work, done: true },
    };
}

/** The fork-join module. */
const module: AlgorithmModule = {
    education: {
        intuition:
            "Fork-join programming splits work into tasks that spawn subtasks and then wait for them. Drawing the spawns gives a tree. Two simple counts describe every such tree: the total number of tasks, called work, and the height of the longest branch, called span. Work is how long one processor would take; span is how long infinitely many processors would take. Together they predict real speed on a fixed number of cores.",
        invariants: [
            "Each non-leaf task spawns exactly two children and joins both.",
            "Work equals the number of nodes in the task tree.",
            "Span equals the height of the tallest root-to-leaf path.",
            "On P processors the time is bounded by work/P plus span.",
        ],
        correctness:
            "The recursion tree is generated directly from the fork rule, so every child edge corresponds to a real spawn and every leaf is a base case. Work is the node count by construction. Span obeys S(k) = 1 + max(S(k-1), S(k-2)) with S(0) = S(1) = 1, which is exactly the longest dependency chain, and no execution can be shorter than that chain. Brent's scheduling lemma shows a greedy scheduler finishes within work/P + span steps, so the reported bound is a genuine upper bound on running time.",
        complexityRationale:
            "Building and displaying the tree touches each of the T1 tasks once, giving O(T1) time and space. The critical path has length Tinf, which is the minimum possible wall-clock time regardless of the processor count.",
        uses: [
            "Parallel merge sort and divide-and-conquer algorithms",
            "Task runtimes such as Cilk, Java ForkJoinPool, and OpenMP tasks",
            "Reasoning about the speedup limits of recursive parallelism",
        ],
        references: [
            "Brent, The Parallel Evaluation of General Arithmetic Expressions, 1974",
            "Cilk Consortium, The Cilk++ Concurrency Platform, 2009",
        ],
        workedExample:
            "Fibonacci(6) produces a task tree with 25 nodes and a longest chain of 6 tasks, so work is 25 and span is 6. On four processors the bound is ceil(25/4) + 6 = 13 steps, and the implied parallelism is about 4.17. Even with hundreds of processors the run could not beat 6 steps because of the dependency chain.",
    },
    id: "fork-join",
    name: "Fork-Join Parallelism (Work and Span)",
    category: "parallel-distributed",
    complexity: { time: "O(T1)", space: "O(T1)" },
    defaultInput: { n: 6, processors: 4 },
    visualType: "tree",
    run,
    pseudocode: [
        "define a task with argument k and a parent task",
        "if k is zero or one, return immediately",
        "otherwise fork two child tasks on k-1 and k-2",
        "join the children and combine their results",
        "count tasks for work and the longest branch for span",
        "bound the time on P processors by work/P plus span",
        "done: report work, span, parallelism, and bound",
    ],
};

export default module;
