/**
 * aho-corasick.ts – Aho-Corasick Algorithm (multi-pattern matching)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Aho-Corasick finds *all* occurrences of a set of patterns in a text in
 * linear time. It builds a trie of the patterns, then augments it with *failure
 * links* (the longest proper suffix that is also a prefix of some pattern) and
 * *output links* (which pattern ends are reachable from each node). The text
 * is then scanned once, following trie edges and falling back along failure
 * links on mismatch.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build: O(sum of pattern lengths)
 *   Scan:  O(n + number of matches)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The trie node currently visited is YELLOW (comparing).
 *   - Failure-link traversal on mismatch is RED (swapped).
 *   - Nodes at which a pattern ends are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - The automaton generalises KMP from one pattern to many.
 *   - Failure links make the scan linear even with many patterns.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Aho-Corasick generator.
 *
 * @param input `{ text, patterns }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; patterns?: string[] } | null) ?? {};
    const text = task.text ?? "abacababa";
    const patterns = task.patterns ?? ["aba", "ab", "ba"];

    let step = 0;
    let nodeCount = 1; // node 0 is the root

    // Trie children: node index → char → child index.
    const children: Array<Map<string, number>> = [new Map()];
    // Failure links and which patterns end at each node.
    const fail: number[] = [-1];
    const output: Array<string[]> = [[]];

    // ------------------------------------------------------------------
    // Build the trie from the patterns.
    // ------------------------------------------------------------------
    for (const pattern of patterns) {
        let node = 0;
        for (const char of pattern) {
            const existing = children[node]?.get(char);
            if (existing !== undefined) {
                node = existing;
            } else {
                children.push(new Map());
                fail.push(0);
                output.push([]);
                children[node]?.set(char, nodeCount);
                node = nodeCount;
                nodeCount += 1;
            }
        }
        output[node]?.push(pattern);
    }

    // ------------------------------------------------------------------
    // Build the failure links via BFS.
    // ------------------------------------------------------------------
    const queue: number[] = [];
    for (const child of children[0]?.values() ?? []) {
        fail[child] = 0;
        queue.push(child);
    }

    while (queue.length > 0) {
        const current = queue.shift();
        if (current === undefined) {
            continue;
        }
        for (const [char, child] of children[current] ?? []) {
            // Find the failure link for `child`.
            let f = fail[current] ?? 0;
            while (f !== -1 && !(children[f]?.has(char) ?? false)) {
                f = fail[f] ?? 0;
            }
            if (f === -1) {
                fail[child] = 0;
            } else {
                fail[child] = children[f]?.get(char) ?? 0;
                // Merge the output of the failure target.
                for (const pat of output[fail[child] ?? 0] ?? []) {
                    output[child]?.push(pat);
                }
            }
            queue.push(child);
        }
    }

    const buildFrame = (message: string): VisualFrame => {
        const entities: VisualEntity[] = [];
        for (let i = 0; i < nodeCount; i += 1) {
            entities.push({
                id: `node-${i}`,
                type: "node" as const,
                label: String(i),
                value: i,
                state: (output[i]?.length ?? 0) > 0 ? "unvisited" : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
        }
        // Trie edges (labeled by character).
        const edges: VisualEdge[] = [];
        for (let s = 0; s < nodeCount; s += 1) {
            for (const [char, target] of children[s] ?? []) {
                edges.push({
                    id: `edge-${s}-${target}-${char}`,
                    sourceId: `node-${s}`,
                    targetId: `node-${target}`,
                    label: char,
                    state: "idle",
                    directed: true,
                });
            }
        }
        return {
            stepNumber: step,
            entities,
            edges,
            description: message,
            codeLineNumber: 2,
            layout: "tree",
            meta: { nodes: nodeCount, matches: 0 },
        };
    };

    yield buildFrame(`Trie built with ${patterns.length} pattern(s).`);
    step += 1;

    // ------------------------------------------------------------------
    // Scan the text using the automaton.
    // ------------------------------------------------------------------
    let node = 0;
    const matches: Array<{ index: number; pattern: string }> = [];

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i] as string;

        // Follow failure links until an edge for this char exists.
        while (node !== 0 && !(children[node]?.has(char) ?? false)) {
            node = fail[node] ?? 0;
        }
        const next = children[node]?.get(char);
        if (next !== undefined) {
            node = next;
        }

        // Record all patterns that end at the current node.
        for (const pattern of output[node] ?? []) {
            matches.push({ index: i - pattern.length + 1, pattern });
        }

        yield buildFrame(
            matches.length === 0
                ? `Scanning text[${i}]="${char}" – no match yet.`
                : `At text[${i}]: ${matches.map((m) => `"${m.pattern}"@${m.index}`).join(", ")}`,
        );
        step += 1;
    }

    yield buildFrame(
        matches.length === 0
            ? "No pattern found in the text."
            : `Found ${matches.length} match(es): ${matches.map((m) => `"${m.pattern}"@${m.index}`).join(", ")}.`,
    );
}

/** The Aho-Corasick module, registered with the engine. */
const module: AlgorithmModule = {
    id: "aho-corasick",
    name: "Aho-Corasick",
    category: "string",
    complexity: { time: "O(n + matches)", space: "O(patterns)" },
    // Overlapping patterns show off the failure-link machinery.
    defaultInput: { text: "abacababa", patterns: ["aba", "ab", "ba"] },
    visualType: "tree",
    run,
};

export default module;
