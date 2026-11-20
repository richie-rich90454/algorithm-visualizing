/**
 * tree-automaton-traversal.ts - Bottom-Up Tree Automaton Traversal
 *
 * A deterministic finite tree automaton assigns a state to every node from
 * its label and the states of its children in left-to-right order. The root's
 * state decides acceptance. The visualization reveals the postorder evaluation
 * one node at a time.
 *
 * Time: O(size of tree times rule lookup). Space: O(n).
 */

import type { AlgorithmModule, EntityState, VisualFrame } from "@/types";
import { makeTreeEdges, makeTreeNodes } from "./tree-util";

type Rule = { label: string; children: string[]; result: string };
type Task = {
    parentMap?: Record<string, string | null>;
    labels?: Record<string, string>;
    rules?: Rule[];
    accepting?: string[];
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const parentMap = new Map<string, string | null>(
        Object.entries(task.parentMap ?? {
            B: "A", C: "A", D: "B", E: "B", F: "C", G: "C",
        }),
    );
    const labels: Record<string, string> = task.labels ?? {
        A: "node", B: "node", C: "node", D: "leaf", E: "leaf", F: "a", G: "leaf",
    };
    const rules: Rule[] = task.rules ?? [
        { label: "leaf", children: [], result: "even" },
        { label: "a", children: [], result: "odd" },
        { label: "node", children: ["even", "even"], result: "even" },
        { label: "node", children: ["even", "odd"], result: "odd" },
        { label: "node", children: ["odd", "even"], result: "odd" },
        { label: "node", children: ["odd", "odd"], result: "even" },
    ];
    const accepting = task.accepting ?? ["odd"];
    const ids = Object.keys(labels).length > 0 ? Object.keys(labels) : ["A"];
    const frames: VisualFrame[] = [];
    let step = 0;

    const childrenOf = (id: string): string[] =>
        ids.filter((child) => parentMap.get(child) === id);
    const root = ids.find((id) => parentMap.get(id) === null) ?? ids[0] ?? "A";
    const nodes = makeTreeNodes(parentMap, ids);
    const edges = makeTreeEdges(parentMap, ids);
    const states = new Map<string, string>();

    const snapshot = (hot: string | null, message: string, line: number, extra: Record<string, number | string | boolean> = {}): VisualFrame => ({
        stepNumber: step,
        entities: nodes.map((node) => {
            const id = node.id.replace("node-", "");
            const state = states.get(id);
            return {
                ...node,
                label: `${id}:${labels[id] ?? "?"}${state ? `=${state}` : ""}`,
                state: (id === hot ? "comparing" : state ? "visited" : "unvisited") as EntityState,
            };
        }),
        edges: edges.map((edge) => ({ ...edge, state: hot && edge.targetId === `node-${hot}` ? "active" as EntityState : "idle" as EntityState })),
        description: message,
        codeLineNumber: line,
        layout: "tree",
        meta: { vertices: ids.length, assigned: states.size, ...extra },
    });

    frames.push(snapshot(null, `Bottom-up automaton on ${ids.length} nodes with ${rules.length} transition rule(s).`, 0));
    step += 1;

    const evaluate = (id: string): string => {
        const childStates = childrenOf(id).map((child) => evaluate(child));
        const label = labels[id] ?? "";
        const rule = rules.find(
            (candidate) => candidate.label === label &&
                candidate.children.length === childStates.length &&
                candidate.children.every((state, i) => state === childStates[i]),
        );
        const result = rule?.result ?? "reject";
        states.set(id, result);
        frames.push(snapshot(
            id,
            `Node ${id} (${label}) with child states [${childStates.join(", ")}] enters state ${result}.`,
            rule ? 3 : 4,
            { state: result },
        ));
        step += 1;
        return result;
    };

    const rootState = evaluate(root);
    const accepted = accepting.includes(rootState);
    frames.push(snapshot(null, `Root ${root} is in state ${rootState}; the tree is ${accepted ? "accepted" : "rejected"}.`, 5, {
        accepted,
        rootState,
    }));
    yield* frames;
}

const module: AlgorithmModule = {
    id: "tree-automaton-traversal",
    name: "Tree Automaton Traversal",
    category: "tree",
    complexity: { time: "O(n·r)", space: "O(n)" },
    defaultInput: {
        parentMap: { B: "A", C: "A", D: "B", E: "B", F: "C", G: "C" },
        labels: { A: "node", B: "node", C: "node", D: "leaf", E: "leaf", F: "a", G: "leaf" },
        rules: [
            { label: "leaf", children: [], result: "even" },
            { label: "a", children: [], result: "odd" },
            { label: "node", children: ["even", "even"], result: "even" },
            { label: "node", children: ["even", "odd"], result: "odd" },
            { label: "node", children: ["odd", "even"], result: "odd" },
            { label: "node", children: ["odd", "odd"], result: "even" },
        ],
        accepting: ["odd"],
    },
    visualType: "tree",
    run,
    pseudocode: [
        "read the labeled ordered tree and the transition rules",
        "visit nodes in postorder so children are evaluated first",
        "collect the states of the children in left-to-right order",
        "find the rule matching the node label and child states",
        "assign the rule's result state to the node",
        "repeat until the root receives its state",
        "accept when the root state is in the accepting set",
        "report the verdict",
    ],
    education: {
        intuition:
            "A tree automaton labels each node by reading its own symbol and the states of its children, from the leaves upward. Because a node's state depends only on its children's states, one bottom-up pass is enough to decide whether the whole tree belongs to the language.",
        invariants: [
            "A node is evaluated only after every child has a state.",
            "The state assigned to a node depends solely on its label and its ordered child states.",
            "Each node is assigned exactly one state during the traversal.",
        ],
        correctness:
            "Postorder visits every node after its children, so the state stored at each node equals the unique transition determined by its label and child states. By induction on tree height this is the automaton's run on the subtree. Acceptance is defined by the root state, so the verdict matches the automaton's semantics.",
        complexityRationale:
            "Each node scans the rule list once, giving O(n times r) time for n nodes and r rules; with hashed transitions this becomes O(n). Storing one state per node uses O(n) space.",
        uses: [
            "Validating the structure of XML and HTML documents",
            "Recognizing expression trees in compilers",
            "Checking tree-shaped queries in databases",
        ],
        references: [
            "Comon et al., Tree Automata Techniques and Applications, 2007",
            "Hopcroft and Ullman, Introduction to Automata Theory, Languages, and Computation",
        ],
        workedExample:
            "With rules that track the parity of leaf symbols, a tree whose leaves are all labeled leaf starts in state even at each leaf. Combining children with the node rules propagates parity upward; a tree with an odd number of marked leaves ends in state odd and is accepted.",
    },
};

export default module;
