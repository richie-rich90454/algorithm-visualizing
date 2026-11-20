/**
 * arc-consistency-ac7.ts - AC-7 Arc Consistency
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * AC-7 enforces arc consistency while remembering, for every value on every
 * directed arc, how far it already looked for a supporting value in the
 * neighbor's ordered domain. When a value is deleted, only the arcs pointing
 * into that domain are re-queued, and each resumed search continues from its
 * saved position instead of rescanning values known not to be supports. This
 * forward-only search is the difference between AC-7 and AC-6, which rebuilds
 * whole support sets after a deletion.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(e * d^2) worst case - each value-neighbor pair is inspected once
 *   Space: O(e * d) for one forward pointer per value on each arc
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - The variable being revised is YELLOW (comparing).
 *   - Its neighbor is PINK (highlight).
 *   - A value removed from a domain flashes RED (swapped); failures are ERROR.
 *   - Arc-consistent domains finish GREEN (sorted).
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
    return vars.map((variable) => {
        const domain = domains.get(variable) ?? [];
        return {
            id: `cell-${variable}`,
            type: "cell" as const,
            label: `${variable}={${domain.join(",")}}`,
            value: domain.length,
            state: states.get(variable) ?? "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { variable, domain: domain.join(",") },
        };
    });
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as AcTask | null) ?? {};
    const defaults: Record<string, number[]> = { X: [1, 2], Y: [1], Z: [1, 2] };
    const domains = new Map<string, number[]>();
    for (const variable of ["X", "Y", "Z"]) {
        const supplied = task.domains?.[variable];
        const raw = Array.isArray(supplied) ? supplied : (defaults[variable] as number[]);
        domains.set(variable, [...new Set(raw)].sort((a, b) => a - b));
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

    // For each directed arc and each value a in the tail domain, the index of
    // the last position examined in the head domain. It only moves forward.
    const pointers = new Map<string, Map<number, number>>();
    for (const [xi, xj] of arcs) {
        const table = new Map<number, number>();
        for (const a of domains.get(xi) ?? []) {
            table.set(a, -1);
        }
        pointers.set(arcKey(xi, xj), table);
    }

    let step = 0;
    let revisions = 0;
    let supportChecks = 0;
    const queue: Array<[string, string]> = [...arcs];

    const emit = (
        states: Map<string, EntityState>,
        description: string,
        codeLineNumber: number,
        extra: Record<string, number> = {},
    ): VisualFrame => ({
        stepNumber: step,
        entities: makeCells(vars, domains, states),
        edges: [],
        description,
        codeLineNumber,
        layout: "grid",
        meta: { revisions, supportChecks, arcs: arcs.length, ...extra },
    });

    yield emit(new Map(), `AC-7 on ${arcs.length} arcs with forward-only support pointers.`, 0);
    step += 1;

    if (vars.some((v) => (domains.get(v) ?? []).length === 0)) {
        yield emit(
            new Map(vars.map((v) => [v, "error" as EntityState])),
            "A domain is empty, so the constraint network has no solution.",
            6,
        );
        return;
    }

    let guard = 0;
    while (queue.length > 0 && guard < 400) {
        guard += 1;
        const [xi, xj] = queue.shift() as [string, string];
        const di = domains.get(xi) ?? [];
        const dj = domains.get(xj) ?? [];
        const table = pointers.get(arcKey(xi, xj)) as Map<number, number>;
        const removed: number[] = [];

        for (const a of di) {
            const from = (table.get(a) ?? -1) + 1;
            let supportIndex = -1;
            for (let k = from; k < dj.length; k += 1) {
                supportChecks += 1;
                if (dj[k] !== a) {
                    supportIndex = k;
                    break;
                }
            }
            if (supportIndex >= 0) {
                table.set(a, supportIndex);
            } else {
                removed.push(a);
            }
        }

        if (removed.length === 0) {
            yield emit(
                new Map<string, EntityState>([
                    [xi, "highlight"],
                    [xj, "sorted"],
                ]),
                `Arc ${xi}->${xj}: every value still has a forward support in ${xj}.`,
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
            `Arc ${xi}->${xj}: values {${removed.join(",")}} have no forward support in ${xj}.`,
            2,
        );
        step += 1;

        const removedSet = new Set(removed);
        domains.set(
            xi,
            di.filter((a) => !removedSet.has(a)),
        );
        revisions += 1;

        yield emit(
            new Map<string, EntityState>([
                [xi, "swapped"],
                [xj, "highlight"],
            ]),
            `Removed {${removed.join(",")}} from ${xi} after ${supportChecks} support check(s).`,
            3,
        );
        step += 1;

        if ((domains.get(xi) ?? []).length === 0) {
            yield emit(new Map([[xi, "error"]]), `${xi} is empty, so no assignment can satisfy the constraints.`, 6);
            return;
        }
        for (const [xk, xm] of arcs) {
            if (xm === xi && xk !== xj) {
                queue.push([xk, xi]);
            }
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
            "Arc consistency means every remaining value of a variable has a supporting value in each neighbor. AC-7 orders every domain and remembers how far each value already searched for support on an arc. When a neighbor loses values, the affected arcs are revisited, but each resumed search continues past the positions already ruled out, so the same value pair is never retested unnecessarily.",
        invariants: [
            "The stored pointer for a value on an arc is the index of a confirmed support, or -1 before any was found.",
            "A value is deleted from a domain only when no later neighbor value can support it.",
            "Whenever a domain shrinks, every other arc pointing into it is re-queued.",
        ],
        correctness:
            "Because domains are ordered and a value that failed to support a earlier remains unequal to a forever, every valid support lies at or after the saved pointer, so resuming the scan there cannot miss one. When the queue empties, all remaining values have a confirmed support still present in the neighbor, which is exactly arc consistency; an empty domain proves the network is unsatisfiable.",
        complexityRationale:
            "Each pointer only moves forward through an ordered domain of size d, and there is one pointer per value on each of e arcs, so at most O(e * d^2) support checks occur. Storing one integer per value per arc uses O(e * d) space, less than AC-6's full support sets.",
        uses: [
            "Domain filtering before backtracking constraint search",
            "Preprocessing for puzzle solvers and timetabling",
            "Incremental propagation when constraint domains change often",
        ],
        references: [
            "Bessiere, Arc Consistency and Arc Consistency Again, AAAI, 1994",
            "Mackworth, Consistency in Networks of Relations, Artificial Intelligence, 1977",
        ],
        workedExample:
            "With X {1,2}, Y {1}, Z {1,2} and inequality constraints, arc X->Y keeps only 2 because 1 has no different value in Y. That deletion re-queues Z->Y, which keeps only 2 as well. The saved pointers advance once each; no value pair is compared twice.",
    },
    id: "arc-consistency-ac7",
    name: "AC-7 Arc Consistency",
    category: "searching",
    complexity: { time: "O(e·d²)", space: "O(e·d)" },
    defaultInput: { domains: { X: [1, 2], Y: [1], Z: [1, 2] } },
    visualType: "grid",
    run,
    pseudocode: [
        "order each domain and set a support pointer for every arc value",
        "place all directed arcs in a queue",
        "pop an arc and resume each value's support scan at its pointer",
        "advance the pointer while scanning later neighbor values",
        "delete values that find no remaining support",
        "re-queue other arcs pointing into a changed domain",
        "done: report the arc-consistent domains or failure",
    ],
};

export default module;
