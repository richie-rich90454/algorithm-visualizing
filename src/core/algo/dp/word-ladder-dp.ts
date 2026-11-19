/**
 * word-ladder-dp.ts - Word Ladder by Iterative Distance Relaxation
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A word ladder transforms one word into another by changing one letter at a
 * time, with every intermediate word taken from a dictionary. Build a graph
 * whose vertices are dictionary words and whose edges join words that differ
 * in exactly one position, then compute the minimum number of transformations
 * by repeatedly relaxing every edge: dist[v] = min(dist[v], dist[u] + 1).
 * Because each relaxation can shorten a path by at most one and the true
 * shortest paths are recovered one layer at a time, this dynamic-programming
 * style iteration converges in at most as many passes as the ladder length.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(passes * m^2 * L) for m words of length L (graph construction is
 *          O(m^2 * L), relaxation is O(passes * m^2))
 *   Space: O(m^2) for the adjacency lists, O(m) for distances
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - Each dictionary word is a grid cell showing its current distance.
 *   - The relaxed cell is YELLOW; words already finalized are GREEN.
 *   - The final ladder path is marked as PATH on the grid.
 */
import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

/** Join two words by an edge when they differ in exactly one position. */
function adjacent(a: string, b: string): boolean {
    if (a.length !== b.length || a === b) return false;
    let differences = 0;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) {
            differences += 1;
            if (differences > 1) return false;
        }
    }
    return differences === 1;
}

function makeCells(
    words: string[],
    dist: number[],
    states: Map<number, EntityState> = new Map(),
): VisualEntity[] {
    return words.map((word, index) => ({
        id: `word-${index}`,
        type: "cell" as const,
        label: `${word}:${dist[index] === Infinity ? "-" : dist[index]}`,
        value: word,
        state: states.get(index) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { row: 0, col: index, word, distance: dist[index] === Infinity ? -1 : dist[index] },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { start?: string; target?: string; words?: string[] } | null) ?? {};
    const words = Array.isArray(task.words) && task.words.length > 0
        ? [...new Set(task.words.filter((w) => typeof w === "string"))]
        : ["hit", "hot", "dot", "dog", "lot", "log", "cog"];
    const start = typeof task.start === "string" ? task.start : "hit";
    const target = typeof task.target === "string" ? task.target : "cog";
    const cols = words.length;

    const startIndex = words.indexOf(start);
    const targetIndex = words.indexOf(target);

    if (startIndex < 0 || targetIndex < 0 || cols === 0) {
        yield {
            stepNumber: 0,
            entities: makeCells(words, new Array<number>(cols).fill(Infinity)),
            edges: [],
            description: "Start and target must both appear in the dictionary to form a word ladder.",
            codeLineNumber: 0,
            layout: "grid",
            meta: { rows: 1, cols, path: [], length: -1 },
        };
        return;
    }

    const graph: number[][] = words.map(() => []);
    for (let i = 0; i < words.length; i += 1) {
        for (let j = i + 1; j < words.length; j += 1) {
            if (adjacent(words[i] ?? "", words[j] ?? "")) {
                graph[i]?.push(j);
                graph[j]?.push(i);
            }
        }
    }

    const dist = new Array<number>(words.length).fill(Infinity);
    const parent = new Array<number>(words.length).fill(-1);
    dist[startIndex] = 0;
    let step = 0;
    let relaxations = 0;
    const edgeCount = graph.reduce((total, list) => total + (list?.length ?? 0), 0) / 2;

    yield {
        stepNumber: step,
        entities: makeCells(words, dist),
        edges: [],
        description: `Word ladder from "${start}" to "${target}" over ${words.length} dictionary words.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: 1, cols, path: [], length: -1, relaxations: 0 },
    };
    step += 1;

    yield {
        stepNumber: step,
        entities: makeCells(words, dist),
        edges: [],
        description: `Built the word graph with ${edgeCount} single-letter adjacency pair(s); starting distance is zero.`,
        codeLineNumber: 1,
        layout: "grid",
        meta: { rows: 1, cols, path: [], length: -1, relaxations: 0, edges: edgeCount },
    };
    step += 1;

    for (let pass = 0; pass < words.length; pass += 1) {
        let changed = false;
        for (let u = 0; u < words.length; u += 1) {
            if (!Number.isFinite(dist[u])) continue;
            for (const v of graph[u] ?? []) {
                const candidate = (dist[u] ?? 0) + 1;
                if (candidate < (dist[v] ?? Infinity)) {
                    dist[v] = candidate;
                    parent[v] = u;
                    changed = true;
                    relaxations += 1;
                    const states = new Map<number, EntityState>([
                        [u, "visited"],
                        [v, "comparing"],
                    ]);
                    if (u === startIndex) states.set(startIndex, "sorted");
                    yield {
                        stepNumber: step,
                        entities: makeCells(words, dist, states),
                        edges: [],
                        description: `Pass ${pass + 1}: relaxing ${words[u]} -> ${words[v]} sets distance ${candidate}.`,
                        codeLineNumber: 3,
                        layout: "grid",
                        meta: { rows: 1, cols, path: [], length: -1, relaxations },
                    };
                    step += 1;
                }
            }
        }
        if (!changed) break;

        const settled = new Map<number, EntityState>();
        for (let i = 0; i < words.length; i += 1) {
            if (Number.isFinite(dist[i])) settled.set(i, "sorted");
        }
        yield {
            stepNumber: step,
            entities: makeCells(words, dist, settled),
            edges: [],
            description: `Pass ${pass + 1} complete; ${[...settled].filter(([, s]) => s === "sorted").length} word(s) now have a known shortest distance.`,
            codeLineNumber: 5,
            layout: "grid",
            meta: { rows: 1, cols, path: [], length: -1, relaxations },
        };
        step += 1;
    }

    const path: string[] = [];
    if (Number.isFinite(dist[targetIndex])) {
        let cursor = targetIndex;
        while (cursor >= 0) {
            path.push(words[cursor] ?? "");
            if (cursor === startIndex) break;
            cursor = parent[cursor] ?? -1;
        }
        path.reverse();
    }

    const pathSet = new Set(path);
    const finalStates = new Map<number, EntityState>();
    for (let i = 0; i < words.length; i += 1) {
        if (pathSet.has(words[i] ?? "")) finalStates.set(i, "path");
    }

    yield {
        stepNumber: step,
        entities: makeCells(words, dist, finalStates),
        edges: [],
        description: path.length > 0
            ? `Shortest ladder has ${path.length - 1} steps: ${path.join(" -> ")}.`
            : `No ladder connects "${start}" to "${target}" in this dictionary.`,
        codeLineNumber: path.length > 0 ? 7 : 8,
        layout: "grid",
        meta: {
            rows: 1,
            cols,
            path,
            length: path.length > 0 ? path.length - 1 : -1,
            relaxations,
            start,
            target,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Treat each dictionary word as a vertex and join two words when one letter changes. A word ladder is then a shortest path. Instead of a queue, this module repeatedly relaxes every edge, storing the best known distance to each word and updating a neighbor whenever a shorter route through the current word appears.",
        invariants: [
            "dist[start] stays zero and every other distance only decreases.",
            "After each pass, every distance is the length of some real ladder of that many letter changes.",
            "A pass that makes no change means no shorter ladder exists.",
        ],
        correctness:
            "Relaxation implements the recurrence dist[v] = min over neighbors u of dist[u] + 1, which is the shortest-path optimality condition in an unweighted graph. Starting from dist[start] = 0, after k passes every distance equals the length of a shortest path of at most k edges, by induction on k. Since shortest paths need at most as many edges as there are words, the iteration stabilizes at the true minimum, and following parent pointers reconstructs a ladder achieving it.",
        complexityRationale:
            "Building the graph compares every pair of words in O(m^2 * L) time for m words of length L. Each relaxation pass scans all adjacency lists, O(m^2), and at most m passes are needed, so the DP phase is O(m^3) in the worst case; distances and parents use O(m) space.",
        uses: [
            "Finding minimal edit chains in spelling correction tools",
            "Planning stepwise transformations in puzzle solvers",
            "A compact example of shortest paths as a DP recurrence",
        ],
        references: [
            "Knuth, The Art of Computer Programming, Volume 3, section on word ladders",
            "Cormen et al., Introduction to Algorithms, Chapter 24 on shortest paths",
        ],
        workedExample:
            "With start hit, target cog, and dictionary hit, hot, dot, dog, lot, log, cog, the relaxation first sets hot to 1, then dot and lot to 2, then dog and log to 3, and finally cog to 4. Following parents gives hit -> hot -> dot -> dog -> cog, a four-step ladder.",
    },
    id: "word-ladder-dp",
    name: "Word Ladder by Distance Relaxation",
    category: "dynamic-programming",
    complexity: { time: "O(m^3 + m^2 * L)", space: "O(m^2)" },
    defaultInput: {
        start: "hit",
        target: "cog",
        words: ["hit", "hot", "dot", "dog", "lot", "log", "cog"],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "build a graph joining words that differ in one letter",
        "set dist[start] to zero and all other distances to infinity",
        "for each pass over the words",
        "for every neighbor v of a reached word u",
        "if dist[u] plus one is less than dist[v] update dist[v]",
        "record u as the predecessor of v",
        "stop a pass early when nothing improved",
        "follow predecessors from target back to start",
        "report the shortest ladder and its length",
    ],
};

export default module;
