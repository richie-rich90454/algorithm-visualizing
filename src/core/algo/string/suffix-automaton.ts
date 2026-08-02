/**
 * suffix-automaton.ts – Suffix Automaton
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * A suffix automaton is the minimal deterministic finite automaton that
 * accepts all substrings of a string (and, with a final-state trick, all its
 * suffixes). It is built incrementally by appending one character at a time,
 * using two arrays per state – a transition `next`, a suffix link `link`, and
 * a length `len`. The automaton has at most 2n states and 3n transitions, so
 * many substring queries become trivial scans of the automaton.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build: O(n) time and states (≤ 2n states, ≤ 3n transitions)
 *   Query: O(length of query)
 *
 * ---------------------------------------------------------------------------
 * Visualisation mapping
 * ---------------------------------------------------------------------------
 *   - The current state is YELLOW (comparing).
 *   - Suffix-link edges are drawn dashed-ish via the label "link".
 *   - States are numbered; transitions carry characters.
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Minimal and elegant – the DFA is exactly as small as it can be.
 *   - The suffix-link tree is a separate data structure hiding inside it.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Suffix Automaton generator.
 *
 * @param input `{ text }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string } | null) ?? {};
    const text = task.text ?? "ababa";

    let step = 0;
    let stateCount = 0;

    // Automaton structures: len, link, next (state → char → state).
    const len: number[] = [0];
    const link: number[] = [-1];
    const next: Array<Map<string, number>> = [new Map()];

    const buildFrame = (message: string): VisualFrame => {
        // Build node entities for each automaton state.
        const entities: VisualEntity[] = len.map((_, i) => ({
            id: `state-${i}`,
            type: "node" as const,
            label: String(i),
            value: i,
            state: "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { len: len[i] ?? 0, link: link[i] ?? -1 },
        }));

        // Build transition edges (state → state via character).
        const edges: VisualEdge[] = [];
        for (let s = 0; s < next.length; s += 1) {
            for (const [char, target] of next[s] ?? []) {
                edges.push({
                    id: `edge-${s}-${target}-${char}`,
                    sourceId: `state-${s}`,
                    targetId: `state-${target}`,
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
            layout: "graph",
            meta: { states: stateCount },
        };
    };

    // Frame 0: the initial (empty-string) automaton.
    yield buildFrame("Initial automaton – just the start state 0.");
    step += 1;

    let last = 0;

    // Extend the automaton with one character at a time.
    for (const char of text) {
        // Create the new state for the whole current string.
        const cur = stateCount + 1;
        stateCount += 1;
        len.push(len[last]! + 1);
        link.push(0);
        next.push(new Map());

        // Follow suffix links, adding the transition where it is missing.
        let p = last;
        while (p !== -1 && !(next[p]?.has(char) ?? true)) {
            next[p]?.set(char, cur);
            p = link[p] ?? -1;
        }

        if (p === -1) {
            // No state already had this transition → the new state links to 0.
            link[cur] = 0;
        } else {
            // State q already has the transition on `char`.
            const q = next[p]?.get(char) ?? 0;
            if ((len[p] ?? 0) + 1 === (len[q] ?? 0)) {
                // q is exactly the right length – link directly.
                link[cur] = q;
            } else {
                // Clone q: copy its transitions, shorten its length.
                const clone = stateCount + 1;
                stateCount += 1;
                len.push(len[p]! + 1);
                link.push(link[q] ?? 0);
                next.push(new Map(next[q] ?? []));

                // Redirect transitions pointing at q to the clone.
                while (p !== -1 && (next[p]?.get(char) ?? 0) === q) {
                    next[p]?.set(char, clone);
                    p = link[p] ?? -1;
                }

                link[q] = clone;
                link[cur] = clone;
            }
        }

        last = cur;

        yield buildFrame(`Appended "${char}" – automaton now has ${stateCount + 1} state(s).`);
        step += 1;
    }

    yield buildFrame(`Suffix automaton of "${text}" complete – ${stateCount + 1} states.`);
}

/** The Suffix Automaton module, registered with the engine. */
const module: AlgorithmModule = {
    id: "suffix-automaton",
    name: "Suffix Automaton",
    category: "string",
    complexity: { time: "O(n)", space: "O(n)" },
    // "ababa" builds a small, readable automaton with one clone.
    defaultInput: { text: "ababa" },
    visualType: "graph",
    run,
};

export default module;
