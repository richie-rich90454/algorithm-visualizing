/**
 * slasher.ts - Slashing Condition Detection
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * In a Casper proof-of-stake chain, validators sign attestations with a source
 * and target epoch. Signing two conflicting attestations is punishable. A
 * slasher scans the signed records for two offences: a double vote, which is
 * two different attestations for the same target epoch, and a surround vote,
 * where one attestation strictly encloses another in epoch range.
 *
 * ---------------------------------------------------------------------------
 * Model limits
 * ---------------------------------------------------------------------------
 *   - Only the two classic Casper slashing conditions are checked.
 *   - Attestations are represented by validator, source epoch, target epoch, and hash.
 *   - No equivocation timing, fork choice, or stake accounting is modeled.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k^2) pairwise checks for k attestations of one validator
 *   Space: O(k) for the flagged rows and violation list
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Vote {
    validator?: string;
    source?: number;
    target?: number;
    hash?: string;
}

interface SlasherInput {
    votes?: Vote[];
}

interface NormalizedVote {
    validator: string;
    source: number;
    target: number;
    hash: string;
}

interface Violation {
    type: "double" | "surround";
    a: number;
    b: number;
}

function normalize(votes: Vote[]): NormalizedVote[] {
    return votes.map((vote, i) => ({
        validator: String(vote.validator ?? `v${i}`),
        source: Math.floor(typeof vote.source === "number" ? vote.source : 0),
        target: Math.floor(typeof vote.target === "number" ? vote.target : 0),
        hash: typeof vote.hash === "string" ? vote.hash : String(vote.source ?? 0),
    }));
}

/** Find all double and surround violations by brute-force pairwise scan. */
function detect(votes: NormalizedVote[]): Violation[] {
    const violations: Violation[] = [];
    for (let i = 0; i < votes.length; i += 1) {
        for (let j = i + 1; j < votes.length; j += 1) {
            const a = votes[i]!;
            const b = votes[j]!;
            if (a.validator !== b.validator) continue;
            if (a.target === b.target && a.hash !== b.hash) {
                violations.push({ type: "double", a: i, b: j });
            }
            const surrounds = (a.source < b.source && b.target < a.target)
                || (b.source < a.source && a.target < b.target);
            if (surrounds) {
                violations.push({ type: "surround", a: i, b: j });
            }
        }
    }
    return violations;
}

function makeCells(votes: NormalizedVote[], flagged: Set<number>, done: boolean): VisualEntity[] {
    const entities: VisualEntity[] = [];
    for (let r = 0; r < votes.length; r += 1) {
        const vote = votes[r]!;
        const values = [vote.validator, vote.source, vote.target, vote.hash, flagged.has(r) ? "SLASH" : "ok"];
        for (let c = 0; c < values.length; c += 1) {
            entities.push({
                id: `cell-${r}-${c}`,
                type: "cell" as const,
                label: String(values[c]),
                value: values[c]!,
                state: done ? "sorted" : flagged.has(r) ? "error" : c === 4 ? "idle" : "comparing",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { row: r, col: c, field: c },
            });
        }
    }
    return entities;
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as SlasherInput | null) ?? {};
    const raw = Array.isArray(task.votes) ? task.votes : [];
    const votes = normalize(raw.length > 0 ? raw : [
        { validator: "alice", source: 1, target: 2, hash: "a1" },
        { validator: "alice", source: 1, target: 3, hash: "a2" },
        { validator: "bob", source: 2, target: 4, hash: "b1" },
        { validator: "bob", source: 3, target: 5, hash: "b2" },
        { validator: "bob", source: 4, target: 6, hash: "b3" },
    ]);

    yield {
        stepNumber: 0,
        entities: makeCells(votes, new Set(), false),
        edges: [],
        description: `Scanning ${votes.length} attestations for double and surround votes.`,
        codeLineNumber: 0,
        layout: "grid",
        meta: { rows: votes.length, cols: 5, violations: 0, doubleVotes: 0, surroundVotes: 0, converged: false },
    };

    const violations = detect(votes);
    const flagged = new Set<number>();
    for (const violation of violations) {
        flagged.add(violation.a);
        flagged.add(violation.b);
    }

    let step = 1;
    for (let i = 0; i < violations.length; i += 1) {
        const violation = violations[i]!;
        const visible = new Set<number>();
        for (let k = 0; k <= i; k += 1) {
            visible.add(violations[k]!.a);
            visible.add(violations[k]!.b);
        }
        yield {
            stepNumber: step,
            entities: makeCells(votes, visible, false),
            edges: [],
            description: `Violation ${i + 1}: ${violation.type} vote by ${votes[violation.a]!.validator} involving attestations ${violation.a} and ${violation.b}.`,
            codeLineNumber: violation.type === "double" ? 4 : 6,
            layout: "grid",
            meta: {
                rows: votes.length,
                cols: 5,
                violations: i + 1,
                doubleVotes: violations.filter((v) => v.type === "double").length,
                surroundVotes: violations.filter((v) => v.type === "surround").length,
                converged: false,
            },
        };
        step += 1;
    }

    const doubleCount = violations.filter((v) => v.type === "double").length;
    const surroundCount = violations.filter((v) => v.type === "surround").length;
    yield {
        stepNumber: step,
        entities: makeCells(votes, flagged, true),
        edges: [],
        description: `Found ${doubleCount} double vote(s) and ${surroundCount} surround vote(s) among ${votes.length} attestations.`,
        codeLineNumber: 7,
        layout: "grid",
        meta: {
            rows: votes.length,
            cols: 5,
            violations: violations.length,
            doubleVotes: doubleCount,
            surroundVotes: surroundCount,
            slashable: violations.length > 0,
            converged: true,
        },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "A validator is allowed to vote on many forks, but not on votes that contradict each other. Two attestations with the same target are a double vote, and one whose source is earlier and target is later than another's is a surround vote. A slasher checks every pair of signed votes from the same validator and flags any offending pair for punishment.",
        invariants: [
            "Only attestations from the same validator can form a violation.",
            "A double vote needs the same target epoch and different attestation data.",
            "A surround vote needs both epoch inequalities to be strict.",
        ],
        correctness:
            "The pairwise scan examines every unordered pair of attestations, so no offence can be missed. For a double vote, equal target epochs with differing hashes mean the validator signed two incompatible blocks for the same slot, which is exactly the double-vote condition. For surround voting, the inequalities a.source less than b.source and b.target less than a.target mean a's epoch interval strictly encloses b's; each validator may sign at most one vote per target and must never cast an enclosing vote around another, so detecting either inequality pair is sufficient. Because the check is symmetric it is performed once per unordered pair.",
        complexityRationale:
            "Grouping is linear and the pairwise scan performs O(k squared) constant-time comparisons for k attestations of a validator, so time is O(k squared). The violation list and flagged set hold at most O(k squared) and O(k) entries respectively.",
        uses: [
            "Detecting equivocation in proof-of-stake networks",
            "Computing slashing penalties from signed attestations",
            "Auditing validator behavior after a chain halt",
        ],
        references: [
            "Buterin and Griffith, Casper the Friendly Finality Gadget, 2017",
            "Ethereum Research, Slashing Conditions and Inactivity Leak",
        ],
        workedExample:
            "Alice signs (source 1, target 2) and (source 1, target 3); these are not a double vote because targets differ, nor a surround vote because sources tie. Bob signs (2, 4) and (3, 5); the first does not surround the second because its target 4 is smaller. A pair like (1, 5) and (2, 4) is a surround vote because 1 is less than 2 and 4 is less than 5.",
    },
    id: "slasher",
    name: "Slasher",
    category: "parallel-distributed",
    complexity: { time: "O(k^2)", space: "O(k)" },
    defaultInput: {
        votes: [
            { validator: "alice", source: 1, target: 2, hash: "a1" },
            { validator: "alice", source: 1, target: 3, hash: "a2" },
            { validator: "bob", source: 2, target: 4, hash: "b1" },
            { validator: "bob", source: 3, target: 5, hash: "b2" },
            { validator: "bob", source: 4, target: 6, hash: "b3" },
        ],
    },
    visualType: "grid",
    run,
    pseudocode: [
        "normalize each signed attestation to validator, source, target, hash",
        "group attestations by validator",
        "for every pair of attestations from one validator",
        "flag a double vote when targets match but hashes differ",
        "flag a surround vote when one source is earlier and its target is later",
        "record the offending pair and mark both attestations",
        "stop after all pairs are examined",
        "done: report the double and surround vote counts",
    ],
};

export default module;
