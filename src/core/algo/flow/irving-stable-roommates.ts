/**
 * irving-stable-roommates.ts - Irving's Stable Roommates Algorithm
 *
 * Phase one runs proposals that shorten every preference list to a stable
 * table. Phase two finds all-or-nothing rotations and eliminates them until
 * each list has one entry (a stable matching) or some list empties (no stable
 * matching exists).
 *
 * Time: O(n^2). Space: O(n^2).
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

type Task = { people?: string[]; preferences?: Record<string, string[]> };

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as Task | null) ?? {};
    const people = Array.isArray(task.people)
        ? [...task.people].map(String)
        : ["A", "B", "C", "D"];
    const preferences: Record<string, string[]> = task.preferences ?? {
        A: ["B", "D", "C"],
        B: ["C", "A", "D"],
        C: ["A", "D", "B"],
        D: ["C", "B", "A"],
    };
    const L = new Map<string, string[]>();
    for (const p of people) {
        const list = (preferences[p] ?? []).filter((q) => people.includes(q) && q !== p);
        L.set(p, [...list]);
    }
    const holders = new Map<string, string | null>();
    for (const p of people) {
        holders.set(p, null);
    }
    const free: string[] = [...people];
    const frames: VisualFrame[] = [];
    let step = 0;
    let proposals = 0;
    let rotations = 0;

    const nodes = (hot: Set<string>): VisualEntity[] =>
        people.map((p) => ({
            id: `person-${p}`,
            type: "node",
            label: `${p}:[${(L.get(p) ?? []).join("")}]`,
            value: p,
            state: hot.has(p) ? "comparing" : "idle",
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { person: p, listLength: (L.get(p) ?? []).length },
        }));

    const emit = (hot: Set<string>, description: string, codeLineNumber: number, extra: Record<string, number | string | boolean | Array<number | string>> = {}): void => {
        frames.push({
            stepNumber: step,
            entities: nodes(hot),
            edges: [],
            description,
            codeLineNumber,
            layout: "graph",
            meta: {
                people: people.length,
                proposals,
                rotations,
                ...extra,
            },
        });
        step += 1;
    };

    const deleteAfter = (receiver: string, proposer: string): boolean => {
        const list = L.get(receiver) ?? [];
        const at = list.indexOf(proposer);
        if (at < 0) {
            return false;
        }
        const removed = list.slice(at + 1);
        L.set(receiver, list.slice(0, at + 1));
        for (const z of removed) {
            L.set(z, (L.get(z) ?? []).filter((entry) => entry !== receiver));
            if (holders.get(receiver) === z) {
                holders.set(receiver, null);
                free.push(z);
            }
            if (holders.get(z) === receiver) {
                holders.set(z, null);
                free.push(receiver);
            }
        }
        return removed.length > 0;
    };

    if (people.length === 0) {
        emit(new Set(), "No people - no roommate matching exists.", 0, { stable: true, matching: [] });
        yield* frames;
        return;
    }

    emit(new Set(), `Irving's algorithm on ${people.length} people, phase one proposals.`, 0);

    let guard = 0;
    while (free.length > 0 && guard < 10000) {
        guard += 1;
        const x = free.shift() as string;
        const list = L.get(x) ?? [];
        if (list.length === 0) {
            continue;
        }
        const y = list[0] as string;
        proposals += 1;
        const removed = deleteAfter(y, x);
        holders.set(y, x);
        emit(
            new Set([x, y]),
            `${x} proposed to ${y}; ${y} discarded ${removed ? "its worse options" : "nothing new"} and now holds ${x}.`,
            3,
        );
    }

    const emptyPeople = people.filter((p) => (L.get(p) ?? []).length === 0);
    if (emptyPeople.length > 0) {
        emit(new Set(emptyPeople), `Phase one emptied ${emptyPeople.join(", ")} - no stable matching exists.`, 4, {
            stable: false,
            matching: [],
        });
        yield* frames;
        return;
    }

    emit(new Set(), "Phase one complete: every list is a stable table; phase two seeks rotations.", 5);

    const withChoice = people.filter((p) => (L.get(p) ?? []).length >= 2);
    const stack: string[] = [];
    const position = new Map<string, number>();
    let start = 0;
    let stable = true;

    guard = 0;
    while (guard < 10000) {
        guard += 1;
        let cut = stack.length;
        for (let i = 0; i < stack.length; i += 1) {
            const s = stack[i] as string;
            const list = L.get(s) ?? [];
            const second = list[1];
            const nextIsLast = second !== undefined &&
                (L.get(second) ?? []).at(-1) === stack[i + 1];
            if (list.length < 2 || (i + 1 < stack.length && !nextIsLast)) {
                cut = i;
                break;
            }
        }
        for (const s of stack.slice(cut)) {
            position.delete(s);
        }
        stack.length = cut;

        if (stack.length === 0) {
            while (start < withChoice.length && (L.get(withChoice[start] ?? "") ?? []).length < 2) {
                start += 1;
            }
            if (start >= withChoice.length) {
                break;
            }
            const seed = withChoice[start] as string;
            stack.push(seed);
            position.set(seed, 0);
        }

        let repeated: string | null = null;
        let walkGuard = 0;
        while (repeated === null && walkGuard < 1000) {
            walkGuard += 1;
            const top = stack[stack.length - 1] as string;
            const second = (L.get(top) ?? [])[1];
            if (second === undefined) {
                stable = false;
                break;
            }
            const p = (L.get(second) ?? []).at(-1);
            if (p === undefined) {
                stable = false;
                break;
            }
            if (position.has(p)) {
                repeated = p;
                break;
            }
            position.set(p, stack.length);
            stack.push(p);
        }
        if (!stable || repeated === null) {
            stable = false;
            break;
        }

        const from = position.get(repeated) ?? 0;
        const rho = stack.slice(from);
        for (const p of rho) {
            position.delete(p);
        }
        stack.length = from;
        const pairs = rho
            .map((p) => [p, (L.get(p) ?? [])[1]] as [string, string | undefined])
            .filter((entry): entry is [string, string] => entry[1] !== undefined);
        for (const [p, q] of pairs) {
            deleteAfter(q, p);
        }
        rotations += 1;
        const nowEmpty = people.filter((p) => (L.get(p) ?? []).length === 0);
        if (nowEmpty.length > 0) {
            stable = false;
            emit(new Set(nowEmpty), `Rotation ${rotations} emptied ${nowEmpty.join(", ")} - no stable matching exists.`, 8, {
                stable: false,
                matching: [],
                rotation: rho.join("-"),
            });
            break;
        }
        emit(new Set(rho), `Rotation ${rotations} (${rho.join("-")}) eliminated; every list is still nonempty.`, 8, {
            rotation: rho.join("-"),
        });
    }

    if (stable) {
        const pairs: string[] = [];
        const seen = new Set<string>();
        for (const p of people) {
            const partner = (L.get(p) ?? [])[0];
            if (!partner || seen.has(p) || seen.has(partner)) {
                continue;
            }
            pairs.push(`${p}-${partner}`);
            seen.add(p);
            seen.add(partner);
        }
        emit(new Set(), `Stable matching found: ${pairs.join(", ") || "none"}.`, 8, {
            stable: true,
            matching: pairs,
        });
    } else {
        emit(new Set(), "Irving's algorithm reports that no stable roommate matching exists.", 8, {
            stable: false,
            matching: [],
        });
    }
    yield* frames;
}

const module: AlgorithmModule = {
    id: "irving-stable-roommates",
    name: "Irving's Stable Roommates Algorithm",
    category: "flow",
    complexity: { time: "O(n²)", space: "O(n²)" },
    defaultInput: {
        people: ["A", "B", "C", "D"],
        preferences: {
            A: ["B", "D", "C"],
            B: ["C", "A", "D"],
            C: ["A", "D", "B"],
            D: ["C", "B", "A"],
        },
    },
    visualType: "graph",
    run,
    pseudocode: [
        "build symmetric preference lists for every person",
        "place every person in the free set",
        "while a free person has an untried first choice",
        "let that person propose to its current first choice",
        "the receiver deletes everyone it ranks below the proposer",
        "deleted holders return to the free set",
        "find a rotation in the stable table and eliminate it",
        "stop with a matching when all lists have one entry",
        "report no matching if any list becomes empty",
    ],
    education: {
        intuition:
            "Roommates have no two sides, so Gale-Shapley cannot be applied directly. Irving first lets people propose and permanently delete options that can never appear in a stable pairing. What remains is a stable table; rotations are cyclic shifts of first and second choices that can be eliminated all at once.",
        invariants: [
            "Every deletion is symmetric: if a person is removed from a list, the reverse entry is removed too.",
            "After phase one, the first entry on a person's list is the person who holds them last on theirs.",
            "Eliminating a rotation never creates an empty list unless the instance has no stable matching.",
        ],
        correctness:
            "Phase-one deletions are safe because if y prefers x to z, then z cannot be y's partner in any stable matching once x has proposed. In a stable table, any list of length greater than one contains a rotation, and eliminating it preserves the existence of a stable matching contained in the reduced lists. The process ends either with singleton lists, which define a stable matching, or with an empty list, which proves none exists.",
        complexityRationale:
            "Each ordered pair is deleted at most once, so phase one and all rotations together take O(n^2) time. Preference lists and the holder table use O(n^2) space.",
        uses: [
            "Pairing roommates without gendered sides",
            "Stable pairing in peer-to-peer markets",
            "A canonical example of rotation-based matching algorithms",
        ],
        references: [
            "Robert W. Irving, An Efficient Algorithm for the Stable Roommates Problem, Journal of Algorithms 1985",
            "Gusfield and Irving, The Stable Marriage Problem: Structure and Algorithms, 1989",
        ],
        workedExample:
            "For A: B,D,C; B: C,A,D; C: A,D,B; D: C,B,A, phase one shortens the lists and phase two finds a rotation such as A,D. Eliminating it removes the rejected second choices and leaves singleton lists that specify a stable pairing.",
    },
};

export default module;
