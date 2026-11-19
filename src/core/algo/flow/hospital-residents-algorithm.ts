/**
 * hospital-residents-algorithm.ts - Hospital/Residents Stable Matching
 *
 * The many-to-one generalization of Gale-Shapley. Residents propose down their
 * preference lists; each hospital keeps its best applicants up to its capacity
 * and rejects the rest. The result is the resident-optimal stable matching.
 *
 * Time: O(R * H) proposals. Space: O(R + H).
 */

import type { AlgorithmModule, EntityState, VisualEdge, VisualEntity, VisualFrame } from "@/types";

type Task = {
    residents?: string[];
    hospitals?: string[];
    preferences?: Record<string, string[]>;
    hospitalPreferences?: Record<string, string[]>;
    capacities?: Record<string, number>;
};

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const residents = Array.isArray(task.residents)
        ? [...task.residents].map(String)
        : ["r1", "r2", "r3", "r4"];
    const hospitals = Array.isArray(task.hospitals)
        ? [...task.hospitals].map(String)
        : ["A", "B"];
    const preferences: Record<string, string[]> = task.preferences ?? {
        r1: ["A", "B"],
        r2: ["B", "A"],
        r3: ["A", "B"],
        r4: ["B", "A"],
    };
    const hospitalPreferences: Record<string, string[]> = task.hospitalPreferences ?? {
        A: ["r2", "r4", "r1", "r3"],
        B: ["r1", "r3", "r2", "r4"],
    };
    const capacities: Record<string, number> = task.capacities ?? { A: 2, B: 2 };

    const proposalIndex = new Map<string, number>();
    for (const r of residents) {
        proposalIndex.set(r, 0);
    }
    const held = new Map<string, string[]>();
    for (const h of hospitals) {
        held.set(h, []);
    }
    const assigned = new Map<string, string>();
    const rank = new Map<string, Map<string, number>>();
    for (const h of hospitals) {
        rank.set(h, new Map((hospitalPreferences[h] ?? []).map((r, i) => [r, i])));
    }
    const free = [...residents];
    const frames: VisualFrame[] = [];
    let step = 0;
    let proposals = 0;

    const entities = (hot: string | null): VisualEntity[] => {
        const nodes: VisualEntity[] = residents.map((r) => ({
            id: `resident-${r}`,
            type: "node",
            label: r,
            value: r,
            state: hot === r ? "comparing" : assigned.has(r) ? "sorted" : "unvisited",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { kind: "resident", partner: assigned.get(r) ?? "" },
        }));
        for (const h of hospitals) {
            const seats = held.get(h) ?? [];
            nodes.push({
                id: `hospital-${h}`,
                type: "node",
                label: `${h} (${seats.length}/${capacities[h] ?? 0})`,
                value: h,
                state: hot === h ? "comparing" : "idle",
                x: 0,
                y: 0,
                width: 0,
                height: 0,
                metadata: { kind: "hospital", capacity: capacities[h] ?? 0 },
            });
        }
        return nodes;
    };
    const edges = (hotResident: string | null): VisualEdge[] => {
        const result: VisualEdge[] = [];
        for (const [r, h] of assigned) {
            result.push({
                id: `match-${r}-${h}`,
                sourceId: `resident-${r}`,
                targetId: `hospital-${h}`,
                label: "held",
                state: hotResident === r ? "active" : "path",
                directed: true,
            });
        }
        return result;
    };
    const emit = (hot: string | null, description: string, codeLineNumber: number, extra: Record<string, number | string | boolean> = {}): void => {
        frames.push({
            stepNumber: step,
            entities: entities(hot),
            edges: edges(hot),
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                residents: residents.length,
                hospitals: hospitals.length,
                proposals,
                matched: assigned.size,
                ...extra,
            },
        });
        step += 1;
    };

    if (residents.length === 0 || hospitals.length === 0) {
        emit(null, "No residents or no hospitals - the matching is empty.", 0);
        yield* frames;
        return;
    }

    emit(null, `Resident-proposing matching for ${residents.length} residents and ${hospitals.length} hospitals.`, 0);

    let guard = 0;
    while (free.length > 0 && guard < 10000) {
        guard += 1;
        const r = free.shift() as string;
        const list = preferences[r] ?? [];
        const at = proposalIndex.get(r) ?? 0;
        if (at >= list.length) {
            continue;
        }
        const h = list[at] as string;
        proposalIndex.set(r, at + 1);
        proposals += 1;
        if (!hospitals.includes(h)) {
            free.push(r);
            emit(r, `${r} proposed to unknown hospital ${h} and must try again.`, 2);
            continue;
        }
        const seats = held.get(h) ?? [];
        const hRank = rank.get(h) ?? new Map<string, number>();
        seats.push(r);
        seats.sort((a, b) => (hRank.get(a) ?? Infinity) - (hRank.get(b) ?? Infinity));
        const capacity = Math.max(0, capacities[h] ?? 0);
        const rejected = seats.splice(capacity);
        held.set(h, seats);
        for (const previous of seats) {
            assigned.set(previous, h);
        }
        for (const rejectedResident of rejected) {
            assigned.delete(rejectedResident);
            free.push(rejectedResident);
        }
        emit(
            r,
            rejected.length > 0
                ? `${r} proposed to ${h}; ${h} kept ${seats.join(", ") || "nobody"} and rejected ${rejected.join(", ")}.`
                : `${r} proposed to ${h} and was held (${seats.length}/${capacity} seats filled).`,
            rejected.length > 0 ? 4 : 3,
            { rejected: rejected.length },
        );
    }

    emit(null, `Stable matching found with ${assigned.size} resident(s) matched after ${proposals} proposals.`, 5, {
        matched: assigned.size,
    });
    yield* frames;
}

const module: AlgorithmModule = {
    id: "hospital-residents-algorithm",
    name: "Hospital/Residents Algorithm",
    category: "flow",
    complexity: { time: "O(R·H)", space: "O(R + H)" },
    defaultInput: {
        residents: ["r1", "r2", "r3", "r4"],
        hospitals: ["A", "B"],
        preferences: {
            r1: ["A", "B"],
            r2: ["B", "A"],
            r3: ["A", "B"],
            r4: ["B", "A"],
        },
        hospitalPreferences: {
            A: ["r2", "r4", "r1", "r3"],
            B: ["r1", "r3", "r2", "r4"],
        },
        capacities: { A: 2, B: 2 },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "initialize every resident free and every hospital empty",
        "while some free resident still has an untried hospital",
        "let that resident propose to the next hospital on its list",
        "add the applicant to the hospital's held set",
        "keep only the best applicants up to the hospital capacity",
        "reject the remaining applicants and return them to the free set",
        "record each held applicant as matched to that hospital",
        "report the resident-optimal stable matching",
    ],
    education: {
        intuition:
            "This is Gale-Shapley with hospitals that have several seats. Residents propose in preference order; a hospital compares all applicants it holds and keeps only the best ones up to its capacity. Rejected residents keep proposing until every unmatched resident has exhausted its list.",
        invariants: [
            "A hospital never holds more residents than its capacity.",
            "Once a hospital holds a resident, later applicants can only displace worse held residents.",
            "A resident's proposal index only moves forward along its preference list.",
        ],
        correctness:
            "Hospitals only improve their held set over time, and residents only move down their lists. If a resident r prefers hospital h to its final assignment, then r proposed to h and was eventually rejected, meaning h always held enough residents it preferred to r. Therefore no resident-hospital pair blocks the final matching, and the outcome is resident-optimal because every rejection is forced by a hospital's true preferences.",
        complexityRationale:
            "Each resident proposes to each hospital at most once, giving at most R times H proposals. Storing lists, ranks, held sets, and capacities uses O(R + H) space.",
        uses: [
            "Assigning medical graduates to residency programs",
            "School choice with multi-seat schools",
            "Stable allocation in labor markets with capacities",
        ],
        references: [
            "Gale and Shapley, College Admissions and the Stability of Marriage, American Mathematical Monthly 1962",
            "Roth and Peranson, The Redesign of the Matching Market for American Physicians, 1999",
        ],
        workedExample:
            "With two hospitals A and B each holding two seats, r1 and r3 prefer A while r2 and r4 prefer B. Hospital A's list favors r2 and r4, so when they propose A swaps out weaker held residents, who then try B. The final matching gives each resident its best hospital consistent with stability.",
    },
};

export default module;
