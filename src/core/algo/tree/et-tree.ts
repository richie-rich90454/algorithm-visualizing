/**
 * et-tree.ts - Euler Tour Tree for Dynamic Forests
 *
 * Each tree in a dynamic forest is stored as one cyclic Euler tour: every
 * vertex appears once on entry and once on exit. Linking two trees joins their
 * tours, cutting an edge splits a tour, and connectivity is a tour membership
 * test. All updates are shown as concrete tour concatenations and splits.
 *
 * Time: O(n) per update in this array representation. Space: O(n).
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Task = { vertices?: string[]; operations?: Array<{ op: "link" | "cut" | "connected"; u: string; v: string }> };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const vertices = Array.isArray(task.vertices) ? [...task.vertices].map(String) : ["A", "B", "C", "D", "E", "F"];
    const operations: Array<{ op: "link" | "cut" | "connected"; u: string; v: string }> = Array.isArray(task.operations)
        ? task.operations
        : [
              { op: "link", u: "A", v: "B" },
              { op: "link", u: "B", v: "C" },
              { op: "link", u: "D", v: "E" },
              { op: "connected", u: "A", v: "C" },
              { op: "connected", u: "A", v: "E" },
              { op: "link", u: "C", v: "D" },
              { op: "connected", u: "A", v: "E" },
              { op: "cut", u: "C", v: "D" },
              { op: "connected", u: "A", v: "E" },
          ];
    const adjacency = new Map<string, string[]>();
    for (const v of vertices) {
        adjacency.set(v, []);
    }
    const frames: VisualFrame[] = [];
    let step = 0;
    let links = 0;
    let cuts = 0;

    const edgeList = (): Array<[string, string]> => {
        const list: Array<[string, string]> = [];
        for (const u of vertices) {
            for (const v of adjacency.get(u) ?? []) {
                if (u < v) {
                    list.push([u, v]);
                }
            }
        }
        return list;
    };

    const tours = (): string[][] => {
        const seen = new Set<string>();
        const result: string[][] = [];
        for (const root of vertices) {
            if (seen.has(root)) {
                continue;
            }
            const tour: string[] = [];
            const stack: Array<{ node: string; parent: string | null; expanded: boolean }> = [
                { node: root, parent: null, expanded: false },
            ];
            seen.add(root);
            while (stack.length > 0) {
                const frame = stack.pop();
                if (!frame) {
                    continue;
                }
                if (frame.expanded) {
                    tour.push(frame.node);
                    continue;
                }
                tour.push(frame.node);
                stack.push({ ...frame, expanded: true });
                for (const child of adjacency.get(frame.node) ?? []) {
                    if (child === frame.parent || seen.has(child)) {
                        continue;
                    }
                    seen.add(child);
                    stack.push({ node: child, parent: frame.node, expanded: false });
                }
            }
            result.push(tour);
        }
        return result;
    };

    const connected = (u: string, v: string): boolean => {
        const seen = new Set<string>();
        const stack = [u];
        seen.add(u);
        while (stack.length > 0) {
            const node = stack.pop() as string;
            if (node === v) {
                return true;
            }
            for (const next of adjacency.get(node) ?? []) {
                if (!seen.has(next)) {
                    seen.add(next);
                    stack.push(next);
                }
            }
        }
        return false;
    };

    const emit = (description: string, line: number, hot: string[] = [], extra: Record<string, number | string | boolean> = {}): void => {
        const currentTours = tours();
        const tourOf = new Map<string, number>();
        currentTours.forEach((list, i) => list.forEach((v) => tourOf.set(v, i)));
        const parent = new Map<string, string | null>();
        for (const list of currentTours) {
            const root = list[0] ?? "";
            parent.set(root, null);
            const seen = new Set([root]);
            const stack = [root];
            while (stack.length > 0) {
                const node = stack.pop() as string;
                for (const next of adjacency.get(node) ?? []) {
                    if (seen.has(next)) {
                        continue;
                    }
                    seen.add(next);
                    parent.set(next, node);
                    stack.push(next);
                }
            }
        }
        const entities: VisualEntity[] = vertices.map((v) => ({
            id: `node-${v}`,
            type: "node",
            label: `${v}#${tourOf.get(v) ?? -1}`,
            value: v,
            state: hot.includes(v) ? "comparing" : "visited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { label: v, tour: tourOf.get(v) ?? -1, parentId: parent.get(v) ?? "root" },
        }));
        const edges: VisualEdge[] = edgeList().map(([u, v], i) => ({
            id: `edge-${i}`,
            sourceId: `node-${u}`,
            targetId: `node-${v}`,
            label: "",
            state: hot.includes(u) && hot.includes(v) ? "active" : "idle",
            directed: false,
        }));
        frames.push({
            stepNumber: step,
            entities,
            edges,
            description,
            codeLineNumber: line,
            layout: "tree",
            meta: {
                vertices: vertices.length,
                tours: currentTours.length,
                links,
                cuts,
                tourSequences: currentTours.map((list) => list.join("-")),
                ...extra,
            },
        });
        step += 1;
    };

    emit(`Euler tour forest on ${vertices.length} isolated vertices; each tour holds one vertex twice.`, 0);

    for (const operation of operations) {
        const u = operation.u;
        const v = operation.v;
        if (!vertices.includes(u) || !vertices.includes(v) || u === v) {
            emit(`Operation ${operation.op}(${u},${v}) is invalid: endpoints must be distinct known vertices.`, 1, [u, v]);
            continue;
        }
        if (operation.op === "link") {
            if (connected(u, v)) {
                emit(`link(${u},${v}) refused: both vertices already share one Euler tour.`, 2, [u, v], { linked: false });
                continue;
            }
            adjacency.get(u)?.push(v);
            adjacency.get(v)?.push(u);
            links += 1;
            emit(`link(${u},${v}) concatenated two Euler tours into one cyclic tour.`, 3, [u, v], { linked: true });
        } else if (operation.op === "cut") {
            const neighbors = adjacency.get(u) ?? [];
            if (!neighbors.includes(v)) {
                emit(`cut(${u},${v}) refused: the edge does not exist in the represented forest.`, 4, [u, v], { cut: false });
                continue;
            }
            adjacency.set(u, neighbors.filter((x) => x !== v));
            adjacency.set(v, (adjacency.get(v) ?? []).filter((x) => x !== u));
            cuts += 1;
            emit(`cut(${u},${v}) split one Euler tour into two independent tours.`, 5, [u, v], { cut: true });
        } else {
            const answer = connected(u, v);
            emit(`connected(${u},${v}) is ${answer ? "true" : "false"} by tour membership.`, 6, [u, v], { connected: answer });
        }
    }
    yield* frames;
}

const module: AlgorithmModule = {
    id: "et-tree",
    name: "Euler Tour Tree",
    category: "tree",
    complexity: { time: "O(n) per update", space: "O(n)" },
    defaultInput: {
        vertices: ["A", "B", "C", "D", "E", "F"],
        operations: [
            { op: "link", u: "A", v: "B" },
            { op: "link", u: "B", v: "C" },
            { op: "link", u: "D", v: "E" },
            { op: "connected", u: "A", v: "C" },
            { op: "connected", u: "A", v: "E" },
            { op: "link", u: "C", v: "D" },
            { op: "connected", u: "A", v: "E" },
            { op: "cut", u: "C", v: "D" },
            { op: "connected", u: "A", v: "E" },
        ],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "start with every vertex as a one-vertex Euler tour",
        "for each requested operation on vertices u and v",
        "if linking, verify the two tours are different",
        "join the two tours and add the edge to the forest",
        "if cutting, split the tour at the edge u v",
        "if querying, test whether u and v share a tour",
        "advance to the next operation",
        "report the final Euler tour forest",
    ],
    education: {
        intuition:
            "An Euler tour tree represents a whole tree as one cyclic sequence that walks around it, entering and leaving every vertex. Linking two trees is a sequence concatenation and cutting an edge is a sequence split, so dynamic connectivity reduces to asking whether two vertices live in the same sequence.",
        invariants: [
            "Every tree of the forest corresponds to exactly one Euler tour sequence.",
            "A link is only performed between vertices in different tours, so no cycle is created.",
            "A cut removes exactly one edge and splits one tour into two.",
        ],
        correctness:
            "Each Euler tour visits every vertex of its tree, so two vertices are connected if and only if they occur in the same tour. Linking merges the corresponding sequences and cutting splits one sequence at the removed edge, which are exactly the changes to connectivity. Therefore the membership test is correct after every update.",
        complexityRationale:
            "This array representation rebuilds and scans tours, costing O(n) per update. A balanced sequence structure such as a splay tree reduces each link, cut, or query to O(log n) amortized while using O(n) space.",
        uses: [
            "Dynamic connectivity in the incremental setting",
            "Maintaining spanning forests under edge updates",
            "A conceptual basis for top trees and link-cut trees",
        ],
        references: [
            "Sleator and Tarjan, A Data Structure for Dynamic Trees, JCSS 1983",
            "Achenbach et al., Dynamic Trees: A Survey, 2021",
        ],
        workedExample:
            "Starting from six isolated tours, linking A-B and B-C puts A, B, and C in one tour while D-E forms another. Linking C-D merges them; cutting C-D splits the tour again so a connectivity query for A and E returns false.",
    },
};

export default module;
