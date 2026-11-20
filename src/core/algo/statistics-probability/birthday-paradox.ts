/**
 * birthday-paradox.ts - Birthday Paradox Collision Probability
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Among k people whose birthdays are uniform over d days, what is the chance
 * that at least two share a birthday? It is easier to compute the complement:
 * the probability that all k birthdays are distinct is a falling product,
 * multiplied one person at a time. One minus that product gives the collision
 * probability. The result is surprisingly large even for modest k.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(k) for k people
 *   Space: O(1) beyond the displayed frames
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per person shows the collision probability after that person.
 *   - The current person's factor is highlighted during the product update.
 *   - meta carries the exact probability for brute-force comparison.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function probabilityBars(values: number[], current: number): VisualEntity[] {
    return values.map((value, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: `k=${index + 1}:${value.toFixed(3)}`,
        value,
        state: (index === current ? "comparing" : index < current ? "visited" : "idle") as EntityState,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, people: index + 1, probability: value },
    }));
}

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { days?: number; people?: number } | null) ?? {};
    const days = typeof task.days === "number" && Number.isInteger(task.days)
        ? Math.max(1, Math.min(365, task.days))
        : 365;
    const people = typeof task.people === "number" && Number.isInteger(task.people)
        ? Math.max(0, Math.min(days, task.people))
        : 23;

    const allDistinct = new Array<number>(people).fill(1);
    const collision = new Array<number>(people).fill(0);
    let product = 1;
    for (let k = 0; k < people; k += 1) {
        product *= (days - k) / days;
        allDistinct[k] = product;
        collision[k] = 1 - product;
    }

    let step = 0;
    yield {
        stepNumber: step,
        entities: probabilityBars(collision, -1),
        edges: [],
        description: `Birthday problem with ${people} people and ${days} possible birthdays.`,
        codeLineNumber: 0,
        layout: "array",
        meta: { days, people, phase: "setup", probability: people > 0 ? collision[people - 1] : 0 },
    };
    step += 1;

    for (let k = 0; k < people; k += 1) {
        const factor = (days - k) / days;
        yield {
            stepNumber: step,
            entities: probabilityBars(collision, k),
            edges: [],
            description: `Person ${k + 1}: multiply by ${((days - k) / days).toFixed(4)}; distinct chance ${allDistinct[k]?.toFixed(4)}, collision chance ${collision[k]?.toFixed(4)}.`,
            codeLineNumber: 1,
            layout: "array",
            meta: {
                days,
                people,
                phase: "person",
                person: k + 1,
                factor,
                distinctProbability: allDistinct[k],
                collisionProbability: collision[k],
            },
        };
        step += 1;
    }

    const final = people > 0 ? (collision[people - 1] as number) : 0;
    yield {
        stepNumber: step,
        entities: probabilityBars(collision, -1),
        edges: [],
        description: `With ${people} people the chance of a shared birthday is ${(final * 100).toFixed(2)} percent.`,
        codeLineNumber: 2,
        layout: "array",
        meta: { days, people, phase: "done", probability: final, distinctProbability: people > 0 ? allDistinct[people - 1] : 1 },
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "It is hard to count assignments that have a collision, but easy to count assignments with none. The first birthday is unrestricted, the second must avoid one day, the third must avoid two, and so on. Multiplying those shrinking fractions gives the chance every birthday is distinct; one minus that is the chance of at least one match, which grows much faster than intuition suggests.",
        invariants: [
            "The distinct probability after k people is the product of (d - j)/d for j from zero to k-1.",
            "The collision probability is one minus the distinct probability.",
            "Both probabilities stay between zero and one for all k at most d.",
        ],
        correctness:
            "Because birthdays are independent and uniform, the probability that the (j+1)-th person avoids the j days already used is (d - j)/d. Multiplying these conditional probabilities from j = 0 to k-1 gives the exact probability all k birthdays differ, by the chain rule of probability. The complement of that event is 'at least two share a birthday', so one minus the product is the desired probability.",
        complexityRationale:
            "One multiplication per person yields O(k) time, and the running product needs only constant working storage. The displayed bars use O(k) space to show the growing curve.",
        uses: [
            "Estimating hash collision risk for a given key space",
            "Sizing random identifiers and nonce lengths",
            "A standard teaching example for complement counting",
        ],
        references: [
            "Feller, An Introduction to Probability Theory and Its Applications, Volume 1 (birthday problem)",
            "Menezes, Oorschot, and Vanstone, Handbook of Applied Cryptography (birthday attacks)",
        ],
        workedExample:
            "For 23 people and 365 days, the distinct probability is the product of 365/365, 364/365, down to 343/365, which is about 0.493. The collision probability is therefore about 0.507, meaning a group of 23 is more likely than not to contain a shared birthday.",
    },
    id: "birthday-paradox",
    name: "Birthday Paradox",
    category: "statistics-probability",
    complexity: { time: "O(k)", space: "O(1)" },
    defaultInput: { days: 365, people: 23 },
    visualType: "array",
    run,
    pseudocode: [
        "set the distinct probability to one",
        "for each person j from zero to k minus one multiply by (days - j) over days",
        "set the collision probability to one minus the distinct probability",
        "record both probabilities after every person",
        "report the final collision probability",
    ],
};

export default module;
