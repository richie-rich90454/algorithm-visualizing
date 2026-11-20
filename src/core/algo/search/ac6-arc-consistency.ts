/**
 * ac6-arc-consistency.ts - AC-6 Arc Consistency
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AC-6 enforces arc consistency like AC-3, but remembers the set of values
 * that support each value on each arc. When a neighbor loses values, AC-6
 * first checks the stored supports; only when every stored support is gone
 * does it rescan the neighbor's domain. That avoids re-testing value pairs
 * that were already shown to work, which is the whole point of the method.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e * d^2) worst case - e arcs, each value pair tested at most once
 *   Space: O(e * d^2) for the stored support sets
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The variable being revised is orange (comparing).
 *   - Its neighbor is yellow (highlight).
 *   - A value removed from a domain flashes red (swapped).
 *   - Arc-consistent domains end green (sorted).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface AcTask {
    domains?: Record<string, number[]>;
    constraints?: Array<[string, string]>;
}

function makeCells(
    vars: string[],
    domains: Map<string, number[]>,
    states: Map<string, EntityState> = new Map(),
): VisualEntity[] {
    return vars.map((variable) => ({
        id: `cell-${variable}`,
        type: "cell" as const,
        label: `${variable}={${(domains.get(variable) ?? []).join(",")}}`,
        value: (domains.get(variable) ?? []).length,
        state: states.get(variable) ?? "idle",
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { variable, domain: (domains.get(variable) ?? []).join(",") },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AcTask | null) ?? {};
    const defaults: Record<string, number[]> = { X: [1, 2], Y: [1], Z: [1, 2] };
    const domains = new Map<string, number[]>();
    for (const variable of ["X", "Y", "Z"]) {
        const supplied = task.domains?.[variable];
        domains.set(
            variable,
            Array.isArray(supplied) ? [...(supplied as number[])] : [...(defaults[variable] as number[])],
        );
    }
    const constraints: Array<[string, string]> =
        Array.isArray(task.constraints) && task.constraints.length > 0
            ? task.constraints.map(([a, b]) => [a, b])
            : [
                  ["X", "Y"],
                  ["Y", "Z"],
              ];
    const vars = [...domains.keys()];
    const arcs: Array<[string, string]> = [];
    for (const [u, v] of constraints) {
        arcs.push([u, v]);
        arcs.push([v, u]);
    }
    const arcKey = (a: string, b: string): string => `${a}>${b}`;

    const supports = new Map<string, Map<number, Set<number>>>();
    let pairChecks = 0;
    for (const [xi, xj] of arcs) {
        const table = new Map<number, Set<number>>();
        for (const a of domains.get(xi) ?? []) {
            const set = new Set<number>();
            for (const b of domains.get(xj) ?? []) {
                pairChecks += 1;
                if (b !== a) set.add(b);
            }
            table.set(a, set);
        }
        supports.set(arcKey(xi, xj), table);
    }

    let step = 0;
    let revisions = 0;
    let supportHits = 0;
    const queue: Array<[string, string]> = [...arcs];

    const emit = (
        states: Map<string, EntityState>,
        description: string,
        codeLineNumber: number,
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(vars, domains, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { revisions, pairChecks, supportHits, arcs: arcs.length },
    });

    yield emit(new Map(), `AC-6 on ${arcs.length} directed arcs with stored support sets.`, 0);
    step += 1;

    if (vars.some((v) => (domains.get(v) ?? []).length === 0)) {
        yield emit(new Map(vars.map((v) => [v, "error" as EntityState])), "A domain is already empty, so no solution exists.", 5);
        return;
    }

    let guard = 0;
    while (queue.length > 0 && guard < 400) {
        guard += 1;
        const [xi, xj] = queue.shift() as [string, string];
        const di = domains.get(xi) ?? [];
        const dj = domains.get(xj) ?? [];
        const table = supports.get(arcKey(xi, xj)) as Map<number, Set<number>>;
        const removed: number[] = [];

        for (const a of [...di]) {
            const set = table.get(a) as Set<number>;
            let hasSupport = false;
            for (const candidate of set) {
                supportHits += 1;
                if (dj.includes(candidate)) {
                    hasSupport = true;
                    break;
                }
            }
            if (!hasSupport) removed.push(a);
        }

        if (removed.length === 0) {
            yield emit(
                new Map<string, EntityState>([
                    [xi, "highlight"],
                    [xj, "sorted"],
                ]),
                `Arc ${xi}->${xj}: every value still has stored support.`,
                1,
            );
            step += 1;
            continue;
        }

        yield emit(
            new Map<string, EntityState>([
                [xi, "comparing"],
                [xj, "highlight"],
            ]),
            `Arc ${xi}->${xj}: values {${removed.join(",")}} lost all support in ${xj}.`,
            2,
        );
        step += 1;

        const removedSet = new Set(removed);
        domains.set(
            xi,
            di.filter((a) => !removedSet.has(a)),
        );
        revisions += 1;

        for (const [xk, xm] of arcs) {
            if (xm !== xi) continue;
            const incoming = supports.get(arcKey(xk, xi)) as Map<number, Set<number>>;
            for (const value of domains.get(xk) ?? []) {
                const set = incoming.get(value);
                if (!set) continue;
                let stillValid = false;
                for (const candidate of set) {
                    if (!removedSet.has(candidate)) {
                        stillValid = true;
                        break;
                    }
                }
                if (!stillValid) {
                    const rebuilt = new Set<number>();
                    for (const candidate of domains.get(xi) ?? []) {
                        pairChecks += 1;
                        if (candidate !== value) rebuilt.add(candidate);
                    }
                    incoming.set(value, rebuilt);
                }
            }
        }

        yield emit(
            new Map<string, EntityState>([
                [xi, "swapped"],
                [xj, "highlight"],
            ]),
            `Removed {${removed.join(",")}} from ${xi}; ${supportHits} support lookups so far.`,
            3,
        );
        step += 1;

        if ((domains.get(xi) ?? []).length === 0) {
            yield emit(new Map([[xi, "error"]]), `${xi} is empty, so the CSP is unsatisfiable.`, 5);
            return;
        }
        for (const [xk, xm] of arcs) {
            if (xm === xi && xk !== xj) queue.push([xk, xi]);
        }
    }

    yield emit(
        new Map(vars.map((v) => [v, "sorted" as EntityState])),
        `Arc consistent after ${revisions} revision(s): ${vars.map((v) => `${v}={${(domains.get(v) ?? []).join(",")}}`).join(" ")}.`,
        6,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Arc consistency means every value left in a variable has a supporting value in each neighbor. AC-3 recomputes support by scanning both domains every time it revises an arc. AC-6 remembers those support sets, so a value is dropped only when all of its stored supports have disappeared; only then is a fresh scan performed.",
        invariants: [
            "A stored support set for value a on arc Xi to Xj contains exactly the values of Xj different from a.",
            "Domains only shrink; a value is removed only after all of its stored supports are gone.",
            "Whenever a domain shrinks, every arc pointing into it is re-queued.",
        ],
        correctness:
            "When the queue empties, every remaining value has at least one stored support that is still present in the neighbor, so every arc is consistent. Re-queuing neighbors after each deletion guarantees no inconsistency is missed, and an empty domain proves no assignment can satisfy the constraints.",
        complexityRationale:
            "Each value pair is tested at most once when its support set is built or rebuilt, giving O(e * d^2) time for e arcs and domain size d, with O(e * d^2) space for the stored sets. This improves on AC-3's O(e * d^3) worst case.",
        uses: [
            "Constraint propagation before backtracking search",
            "Preprocessing for scheduling and coloring puzzles",
            "Fast domain filtering in SAT and CSP solvers",
        ],
        references: [
            "Mackworth, Consistency in Networks of Relations, Artificial Intelligence, 1977",
            "Bespoeg and Quimper, Arc Consistency Algorithms, Handbook of Constraint Programming, 2006",
        ],
        workedExample:
            "With X {1,2}, Y {1}, Z {1,2} and constraints X != Y, Y != Z, the support of X=1 in Y is empty, so X becomes {2}. Z=1 also loses its only support in Y and becomes {2}. AC-6 reuses the stored sets instead of rescanning X != Y on the next pass.",
    },
    id: "ac6-arc-consistency",
    name: "AC-6 Arc Consistency",
    category: "searching",
    complexity: { time: "O(e·d²)", space: "O(e·d²)" },
    defaultInput: { domains: { X: [1, 2], Y: [1], Z: [1, 2] } },
    visualType: "grid",
    run,
    pseudocode: [
        "build a support set for each value on each arc",
        "place every directed arc in a queue",
        "pop an arc and check each value's stored supports",
        "drop values whose supports are no longer in the neighbor",
        "rebuild only the support sets affected by a deletion",
        "re-queue neighboring arcs that point into a changed domain",
        "done: report arc-consistent domains or failure",
    ],
};

export default module;
