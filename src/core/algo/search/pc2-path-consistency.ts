/**
 * pc2-path-consistency.ts – PC-2 Path Consistency
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * PC-2 enforces path consistency on a binary constraint network. For every
 * directed triple (i, j, k) it revises the relation R_ij so that each allowed
 * pair (a, b) has a middle value c supported by both R_ik and R_kj. When a
 * relation shrinks, all triples through the changed pair are queued again. The
 * result is a tighter network in which every two values can be extended to a
 * consistent third variable.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(n^3 · d^3) worst - triples times value-pair composition
 *   Space: O(n^2 · d^2) for the pairwise relations and the triple queue
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The relation being revised is PINK (highlight).
 *   - Relations that lose pairs flash RED (swapped).
 *   - The final path-consistent network turns GREEN (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type PairKey = string;
type Relation = Set<string>;

const encode = (a: number, b: number): string => `${a},${b}`;
const key = (a: string, b: string): PairKey => `${a}${b}`;
const inverse = (p: string): string => {
    const [a, b] = p.split(",") as [string, string];
    return encode(Number(b), Number(a));
};

function universal(domain: number[]): Relation {
    const r: Relation = new Set();
    for (const a of domain) for (const b of domain) r.add(encode(a, b));
    return r;
}

function identity(domain: number[]): Relation {
    return new Set(domain.map((v) => encode(v, v)));
}

/** Compose R_ik with R_kj through a shared middle value. */
function compose(rik: Relation, rkj: Relation, domain: number[]): Relation {
    const out: Relation = new Set();
    for (const a of domain) {
        for (const b of domain) {
            for (const c of domain) {
                if (rik.has(encode(a, c)) && rkj.has(encode(c, b))) {
                    out.add(encode(a, b));
                    break;
                }
            }
        }
    }
    return out;
}

interface PC2Result {
    relations: Map<PairKey, Relation>;
    revisions: number;
    events: Array<{ focus: string; snapshot: string[]; pairs: string }>;
}

function runPC2(vars: string[], domain: number[], allowed: Record<string, [number, number][]>): PC2Result {
    const relations = new Map<PairKey, Relation>();
    for (const v of vars) relations.set(key(v, v), identity(domain));
    for (let i = 0; i < vars.length; i += 1) {
        for (let j = i + 1; j < vars.length; j += 1) {
            const a = vars[i] as string;
            const b = vars[j] as string;
            const given = allowed[`${a}-${b}`] ?? allowed[key(a, b)];
            const base: Relation = Array.isArray(given)
                ? new Set(given.map(([x, y]) => encode(x, y)))
                : universal(domain);
            relations.set(key(a, b), new Set(base));
            relations.set(key(b, a), new Set([...base].map(inverse)));
        }
    }

    const queue: Array<[string, string, string]> = [];
    for (const i of vars) for (const j of vars) for (const k of vars) {
        if (i !== j && j !== k && i !== k) queue.push([i, j, k]);
    }

    const pairs = [key(vars[0] as string, vars[1] as string), key(vars[0] as string, vars[2] as string), key(vars[1] as string, vars[2] as string)];
    const snapshot = (): string[] =>
        pairs.map((pk) => {
            const [a, b] = [pk[0] as string, pk[1] as string];
            return `${a}-${b}:{${[...(relations.get(pk) ?? [])].sort().join(" ")}}`;
        });

    const result: PC2Result = { relations, revisions: 0, events: [] };
    let guard = 0;
    while (queue.length > 0 && guard < 100000) {
        guard += 1;
        const [i, j, k] = queue.shift() as [string, string, string];
        const rij = relations.get(key(i, j)) as Relation;
        const rik = relations.get(key(i, k)) as Relation;
        const rkj = relations.get(key(k, j)) as Relation;
        const next = new Set([...rij].filter((p) => compose(rik, rkj, domain).has(p)));
        if (next.size === rij.size) continue;
        relations.set(key(i, j), next);
        relations.set(key(j, i), new Set([...next].map(inverse)));
        result.revisions += 1;
        result.events.push({ focus: key(i, j), snapshot: snapshot(), pairs: [...next].sort().join(" ") });
        for (const m of vars) {
            if (m !== i && m !== j) {
                queue.push([i, j, m]);
                queue.push([j, i, m]);
            }
        }
    }
    return result;
}

function makeCells(labels: string[], states: Map<string, EntityState> = new Map()): VisualEntity[] {
    return labels.map((label, index) => ({
        id: `cell-${index}`,
        type: "cell" as const,
        label,
        value: label.length,
        state: states.get(label.split(":")[0] as string) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { pair: label.split(":")[0] ?? "", index },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (
        input as { domain?: number[]; relations?: Record<string, [number, number][]> } | null
    ) ?? {};
    const domain: number[] = Array.isArray(task.domain) && task.domain.length > 0
        ? [...(task.domain as number[])]
        : [1, 2];
    const vars = ["X", "Y", "Z"];
    const allPairs = (): [number, number][] =>
        [...universal(domain)].map((p) => p.split(",").map(Number) as [number, number]);
    const allowed = task.relations ?? {
        "X-Y": allPairs(),
        "X-Z": [
            [1, 2],
            [2, 1],
        ],
        "Y-Z": [
            [1, 2],
            [2, 1],
        ],
    };

    const result = runPC2(vars, domain, allowed);
    const pairKeys = [key("X", "Y"), key("X", "Z"), key("Y", "Z")];
    let step = 0;
    const initial = pairKeys.map((pk) => {
        const [a, b] = [pk[0] as string, pk[1] as string];
        return `${a}-${b}:{${[...(result.relations.get(pk) ?? [])].sort().join(" ")}}`;
    });

    yield {
        stepNumber: step,
        entities: makeCells(initial),
        edges: [],
        description: `PC-2 over ${vars.length} variables on domain {${domain.join(",")}} with ${result.revisions} pending revisions.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { revisions: 0, variables: vars, domain },
    };
    step += 1;

    for (const event of result.events) {
        const states = new Map<string, EntityState>([[event.focus, "swapped"]]);
        yield {
            stepNumber: step,
            entities: makeCells(event.snapshot, states),
            edges: [],
            description: `Revised ${event.focus[0]}->${event.focus[1]}; kept pairs ${event.pairs || "(none)"}.`,
            codeLineNumber: 2,
            layout: "grid",
            meta: { revisions: result.revisions, focus: event.focus },
        };
        step += 1;
        if (step > 60) break;
    }

    const finalLabels = pairKeys.map((pk) => {
        const [a, b] = [pk[0] as string, pk[1] as string];
        return `${a}-${b}:{${[...(result.relations.get(pk) ?? [])].sort().join(" ")}}`;
    });
    const finalStates = new Map<string, EntityState>(
        finalLabels.map((label) => [label.split(":")[0] as string, "sorted" as EntityState]),
    );
    yield {
        stepNumber: step,
        entities: makeCells(finalLabels, finalStates),
        edges: [],
        description: `Path consistent after ${result.revisions} revision(s); every allowed pair has a middle supporter.`,
        codeLineNumber: 5,
        layout: "grid",
        meta: { revisions: result.revisions, relations: finalLabels },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Arc consistency checks pairs of variables; path consistency checks triples. If X can be 1 and Z can be 2, path consistency demands some value of Y that is compatible with both. PC-2 keeps a queue of triples and removes any pair from a relation that cannot be extended through the third variable, repeating until nothing changes.",
        invariants: [
            "Each relation R_ij stays a subset of its previous self; pairs are only removed.",
            "R_ji is always the inverse of R_ij, and R_ii is the identity relation.",
            "After a fixpoint, every allowed pair has a supporting middle value for every third variable.",
        ],
        correctness:
            "Revising R_ij against k deletes exactly the pairs with no witness c in R_ik and R_kj, so it cannot remove a pair that participates in a consistent triple. Re-queuing all triples through a changed pair ensures no deletion invalidates an earlier revision. When the queue empties, the fixpoint satisfies the path-consistency definition.",
        complexityRationale:
            "There are O(n^3) directed triples. Each revision composes two relations over at most d^3 value triples, giving O(n^3 · d^3) worst-case time. Storing O(n^2) relations of up to d^2 pairs plus the queue uses O(n^2 · d^2) space.",
        uses: [
            "Preprocessing binary constraint networks before search",
            "Tightening temporal and scheduling relations",
            "Foundations of higher-k consistency in constraint programming",
        ],
        references: [
            "Mackworth, Consistency in Networks of Relations, Artificial Intelligence, 1977",
            "Dechter, Constraint Processing, Chapter 4 (path consistency)",
        ],
        workedExample:
            "With X not equal Z and Y not equal Z over {1,2}, the pair (1,1) in R_XY has no middle value: Z must differ from both 1s, which is impossible in {1,2}. PC-2 deletes (1,1) and (2,2), leaving X equal Y as the only path-consistent possibility.",
    },
    id: "pc2-path-consistency",
    name: "PC-2 Path Consistency",
    category: "searching",
    complexity: { time: "O(n^3 · d^3)", space: "O(n^2 · d^2)" },
    defaultInput: { domain: [1, 2] },
    visualType: "grid",
    run,
    pseudocode: [
        "build pairwise relations and the identity diagonals",
        "queue every directed triple (i, j, k) of distinct variables",
        "compose R_ik with R_kj through a shared middle value c",
        "keep only pairs of R_ij that survive the composition",
        "if R_ij shrank, re-queue all triples through that pair",
        "repeat until the queue empties with no further change",
        "done: return the path-consistent relations",
    ],
};

export default module;
