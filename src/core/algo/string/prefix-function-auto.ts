/**
 * prefix-function-auto.ts – Prefix-Function Automaton (KMP failure automaton)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * The prefix-function automaton is the KMP failure function turned into a
 * full deterministic automaton. For each state j (a matched prefix length) and
 * each possible next character c, the automaton records the state reached
 * after reading c – either an extension (j+1) or a fallback along the failure
 * links. This "automaton table" lets KMP-style matching run without the
 * fallback loop, in strictly O(n) and often with a simple table lookup.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Build: O(m·σ) where σ is the alphabet size
 *   Scan:  O(n)
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The current automaton state is YELLOW (comparing).
 *   - The transition being followed is highlighted.
 *   - Accepting states (full matches) are GREEN (sorted).
 *
 * ---------------------------------------------------------------------------
 * Properties
 * ---------------------------------------------------------------------------
 *   - Precomputing the fallback into the table removes the inner loop.
 *   - The automaton viewpoint unifies KMP with Aho-Corasick.
 */

import type { AlgorithmModule, VisualEdge, VisualEntity, VisualFrame } from "@/types";

/**
 * The Prefix-Function Automaton generator.
 *
 * @param input `{ text, pattern }`.
 */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { text?: string; pattern?: string } | null) ?? {};
    const text = task.text ?? "ababcabababcab";
    const pattern = task.pattern ?? "ababcab";

    const m = pattern.length;
    const alphabet = [...new Set(pattern.split(""))];

    // Build the prefix function.
    const pi = new Array<number>(m).fill(0);
    for (let i = 1; i < m; i += 1) {
        let j = pi[i - 1] ?? 0;
        while (j > 0 && pattern[i] !== pattern[j]) {
            j = pi[j - 1] ?? 0;
        }
        if (pattern[i] === pattern[j]) {
            j += 1;
        }
        pi[i] = j;
    }

    // Build the automaton: aut[state][char] = next state.
    const aut: Array<Map<string, number>> = [];
    for (let state = 0; state <= m; state += 1) {
        const row = new Map<string, number>();
        for (const char of alphabet) {
            if (state < m && char === pattern[state]) {
                // Direct extension.
                row.set(char, state + 1);
            } else {
                // Follow the failure links to find the fallback state.
                let j = state;
                while (j > 0 && pattern[j] !== char) {
                    j = pi[j - 1] ?? 0;
                }
                if (pattern[j] === char) {
                    row.set(char, j + 1);
                } else {
                    row.set(char, 0);
                }
            }
        }
        aut.push(row);
    }

    let step = 0;

    const buildFrame = (message: string, currentState: number): VisualFrame => {
        // States 0..m as nodes; accepting state m is green.
        const entities: VisualEntity[] = [];
        for (let s = 0; s <= m; s += 1) {
            entities.push({
                id: `state-${s}`,
                type: "node" as const,
                label: s === m ? "✓" : String(s),
                value: s,
                state: s === currentState ? "comparing" : s === m ? "sorted" : "unvisited",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { parentId: "root" },
            });
        }
        // Transitions (char edges) for the current state, plus the chain.
        const edges: VisualEdge[] = [];
        for (let s = 0; s <= m; s += 1) {
            for (const [char, target] of aut[s] ?? []) {
                edges.push({
                    id: `edge-${s}-${target}-${char}`,
                    sourceId: `state-${s}`,
                    targetId: `state-${target}`,
                    label: char,
                    state: s === currentState ? "active" : "idle",
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
            meta: { state: currentState },
        };
    };

    yield buildFrame(`Prefix-function automaton built for "${pattern}".`, 0);
    step += 1;

    // ------------------------------------------------------------------
    // Scan the text using the automaton (no fallback loop needed).
    // ------------------------------------------------------------------
    let state = 0;
    const matches: number[] = [];

    for (let i = 0; i < text.length; i += 1) {
        const char = text[i] as string;
        state = aut[state]?.get(char) ?? 0;

        if (state === m) {
            matches.push(i - m + 1);
            yield buildFrame(`Pattern found at index ${i - m + 1}!`, state);
            step += 1;
            // After a full match, the automaton's next state is pi[m-1]-ish;
            // follow the transition for the current char from state m is not
            // defined, so reset via the prefix function.
            state = pi[m - 1] ?? 0;
        } else {
            yield buildFrame(`Read "${char}" – moved to state ${state}.`, state);
            step += 1;
        }
    }

    yield buildFrame(
        matches.length === 0
            ? `"${pattern}" does not occur in the text.`
            : `"${pattern}" occurs at ${matches.join(", ")}.`,
        state,
    );
}

/** The Prefix-Function Automaton module, registered with the engine. */
const module: AlgorithmModule = {
    id: "prefix-function-auto",
    name: "Prefix-Function Automaton",
    category: "string",
    complexity: { time: "O(n + m·σ)", space: "O(m·σ)" },
    // Same input as KMP for a direct comparison.
    defaultInput: { text: "ababcabababcab", pattern: "ababcab" },
    visualType: "graph",
    run,
};

export default module;
