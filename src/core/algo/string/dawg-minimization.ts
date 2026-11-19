/**
 * dawg-minimization.ts – DAWG minimization.
 *
 * A directed acyclic word graph is the smallest deterministic automaton that
 * accepts exactly a given finite set of words. Starting from the trie of the
 * words, states are processed from the leaves upward and states with the same
 * accepting flag and the same labeled successors are merged. Repeating this
 * bottom-up pass yields the minimal DAWG.
 *
 *  Time:  O(total trie edges log states) in this teaching version
 *  Space: O(number of trie states)
 */
import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

interface State {
    id: number;
    children: Map<string, number>;
    final: boolean;
}

interface Automaton {
    states: State[];
    start: number;
}

function buildTrie(words: string[]): { states: State[]; start: number } {
    const states: State[] = [];
    const make = (final: boolean): number => {
        states.push({ id: states.length, children: new Map(), final });
        return states.length - 1;
    };
    const start = make(false);
    for (const word of words) {
        let cur = start;
        for (const ch of word) {
            let next = states[cur]!.children.get(ch);
            if (next === undefined) {
                next = make(false);
                states[cur]!.children.set(ch, next);
            }
            cur = next;
        }
        states[cur]!.final = true;
    }
    return { states, start };
}

function nodeEntities(automaton: Automaton, active: Set<number>): VisualEntity[] {
    return automaton.states.map((s) => ({
        id: `node-${s.id}`,
        type: "node" as const,
        label: s.id === automaton.start ? "start" : s.final ? `q${s.id}*` : `q${s.id}`,
        value: s.id,
        state: active.has(s.id) ? ("active" as EntityState) : (s.final ? "sorted" as EntityState : "idle" as EntityState),
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { stateId: s.id, final: s.final, start: s.id === automaton.start },
    }));
}

function edgeEntities(automaton: Automaton, highlighted: Set<string>): VisualEdge[] {
    const edges: VisualEdge[] = [];
    for (const s of automaton.states) {
        for (const [ch, target] of s.children) {
            const id = `edge-${s.id}-${target}-${ch}`;
            edges.push({
                id,
                sourceId: `node-${s.id}`,
                targetId: `node-${target}`,
                label: ch,
                state: highlighted.has(id) ? ("active" as EntityState) : ("idle" as EntityState),
                directed: true,
            });
        }
    }
    return edges;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const cfg = (input as { words?: string[] } | null) ?? {};
    const words = Array.isArray(cfg.words)
        ? cfg.words.filter((w) => typeof w === "string" && w.length > 0)
        : ["cat", "car", "dog", "do"];
    const lines = 8;
    let step = 0;
    const F = (automaton: Automaton, description: string, line: number, active: Set<number>, highlighted: Set<string>, groups: number): VisualFrame => ({
        stepNumber: step,
        entities: nodeEntities(automaton, active),
        edges: edgeEntities(automaton, highlighted),
        description,
        codeLineNumber: Math.min(line, lines - 1),
        layout: "graph",
        meta: { states: automaton.states.length, wordCount: words.length, mergedGroups: groups },
    });

    if (words.length === 0) {
        const empty: Automaton = { states: [{ id: 0, children: new Map(), final: false }], start: 0 };
        yield F(empty, "No words given - the trie has only a start state.", 7, new Set(), new Set(), 0);
        return;
    }

    const trie = buildTrie(words);
    yield F(trie, `Built a trie of ${trie.states.length} states for ${words.length} word(s).`, 0, new Set(), new Set(), 0);
    step += 1;

    // Compute depths by breadth-first traversal.
    const depth = new Array<number>(trie.states.length).fill(0);
    const seen = new Set<number>([trie.start]);
    const queue: number[] = [trie.start];
    while (queue.length > 0) {
        const cur = queue.shift() as number;
        for (const child of trie.states[cur]!.children.values()) {
            if (!seen.has(child)) {
                seen.add(child);
                depth[child] = (depth[cur] as number) + 1;
                queue.push(child);
            }
        }
    }

    // Bottom-up merging: a state's signature is its final flag plus the
    // representatives of its labeled successors.
    const rep = new Array<number>(trie.states.length).fill(-1);
    const order = trie.states.map((s) => s.id).sort((a, b) => (depth[b] as number) - (depth[a] as number));
    const byDepth = new Map<number, number[]>();
    for (const id of order) {
        const d = depth[id] as number;
        const group = byDepth.get(d) ?? [];
        group.push(id);
        byDepth.set(d, group);
    }
    const depths = [...byDepth.keys()].sort((a, b) => b - a);
    // A single map across all depths so equal states at different depths merge.
    const sigToRep = new Map<string, number>();
    let processed = 0;

    for (const d of depths) {
        const group = byDepth.get(d) as number[];
        const active = new Set<number>(group);
        for (const id of group) {
            const s = trie.states[id]!;
            const succ = [...s.children.entries()]
                .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
                .map(([ch, child]) => `${ch}:${rep[child]}`)
                .join(",");
            const signature = `${s.final ? "1" : "0"}|${succ}`;
            let r = sigToRep.get(signature);
            if (r === undefined) {
                r = id;
                sigToRep.set(signature, r);
            }
            rep[id] = r;
            processed += 1;
        }
        yield F(trie, `Depth ${d}: ${processed} of ${trie.states.length} states processed into ${sigToRep.size} equivalent class(es).`, 4, active, new Set(), sigToRep.size);
        step += 1;
    }
    const totalGroups = sigToRep.size;

    // Assemble the minimal automaton from the representatives.
    const repStates = new Map<number, State>();
    for (let id = 0; id < trie.states.length; id += 1) {
        const r = rep[id] as number;
        const source = trie.states[r]!;
        let target = repStates.get(r);
        if (!target) {
            target = { id: r, children: new Map(), final: source.final };
            repStates.set(r, target);
        }
        for (const [ch, child] of source.children) {
            if (!target.children.has(ch)) target.children.set(ch, rep[child] as number);
        }
    }
    const ordered = [...repStates.values()].sort((a, b) => (a.id - b.id));
    const minimal: Automaton = { states: ordered, start: rep[trie.start] as number };

    yield F(minimal, `Minimal DAWG has ${minimal.states.length} state(s), down from ${trie.states.length}; it accepts exactly the ${words.length} words.`, 7, new Set(), new Set(), totalGroups);
}

const module: AlgorithmModule = {
    education: {
        intuition: "A DAWG is the smallest automaton that accepts a given finite dictionary. Building it starts with a trie, where shared prefixes already save space. Then states that behave identically in the future are merged from the leaves upward, so common suffixes are shared too and the result is minimal.",
        invariants: [
            "States at the same depth can be compared because all their successors lie at smaller depths and are already merged.",
            "Two states are merged only when their accepting flag and every labeled successor are identical.",
            "Merging never changes the language accepted by the automaton."
        ],
        correctness: "Myhill-Nerode theory says two states can be merged exactly when they accept the same set of continuations. Processing by decreasing depth guarantees every successor representative is final before a parent signature is computed, so equal signatures correspond to equivalent states. Merging equivalent states preserves the accepted language and yields the unique minimal acyclic automaton for a finite word set.",
        complexityRationale: "The trie has at most one plus the total number of word characters states. Computing a signature at each state sorts its outgoing labels, costing O(k log k) for k children, so the total is O(E log E) over E trie edges. Space is linear in the number of trie states.",
        uses: [
            "Compact dictionaries for spell checking",
            "Representing large word lists in mobile keyboards",
            "Pattern matching indexes such as the BNDM DAWG variant",
            "Compressing finite vocabularies in natural language tools"
        ],
        references: [
            "Daciuk, Mihov, Watson and Watson, Incremental Construction of Minimal Acyclic Finite-State Automata, 2000",
            "Aho, Sethi and Ullman, Compilers: Principles, Techniques, and Tools, Chapter 3"
        ],
        workedExample: "The words cat and car build a trie that shares the path c-a and then branches on t and r. The two terminal states are both accepting with no successors, so they merge into one. The remaining states have distinct successor labels and stay separate, producing a DAWG with one shared terminal state."
    },
    id: "dawg-minimization",
    name: "DAWG Minimization",
    category: "string",
    complexity: { time: "O(E log E)", space: "O(states)" },
    defaultInput: { words: ["cat", "car", "dog", "do"] },
    visualType: "graph",
    run,
    pseudocode: [
        "insert every word into a trie",
        "compute each state's depth by breadth-first traversal",
        "process states in decreasing depth order",
        "form a signature from the final flag and successor representatives",
        "assign one representative to states sharing a signature",
        "rebuild the automaton from the representatives",
        "wire each representative's labeled edges",
        "report the minimal DAWG and its state count"
    ]
};

export default module;
