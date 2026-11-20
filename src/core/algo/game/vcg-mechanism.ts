/**
 * vcg-mechanism.ts - Vickrey-Clarke-Groves Mechanism
 *
 * VCG chooses the outcome that maximizes total reported welfare and charges
 * each participant the externality they impose on everyone else. For a public
 * project with a fixed cost, the group builds when total value exceeds cost,
 * and a pivotal participant pays the surplus they would otherwise have
 * contributed or the loss their blocking would cause. Truthful reporting is
 * a dominant strategy because a bidder's payment never depends on their own
 * reported value except through the social decision.
 *
 * Time:  O(n); Space: O(n)
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { values?: number[]; cost?: number } | null) ?? {};
    const values = task.values ?? [8, 5, 4, 2];
    const cost = typeof task.cost === "number" ? task.cost : 12;
    const n = values.length;
    const total = values.reduce((a, b) => a + b, 0);
    const build = total >= cost;

    let step = 0;
    const payments: number[] = [];
    for (let i = 0; i < n; i += 1) {
        const others = total - (values[i] ?? 0);
        if (build && others < cost) payments.push(cost - others);
        else if (!build && others >= cost) payments.push(others - cost);
        else payments.push(0);
    }

    const frame = (message: string, line: number, hot: number): VisualFrame => {
        const entities: VisualEntity[] = values.map((value, i) => ({
            id: `agent-${i}`,
            type: "bar" as const,
            label: `v${i}=${value}, pay=${payments[i]}`,
            value,
            state: (i === hot ? "comparing" : build ? "sorted" : "idle") as EntityState,
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            metadata: { agent: i, value, payment: payments[i] ?? 0 },
        }));
        return {
            stepNumber: step,
            entities,
            edges: [],
            description: message,
            codeLineNumber: line,
            layout: "array",
            meta: {
                build,
                welfare: total - (build ? cost : 0),
                totalValue: total,
                cost,
                payments: payments.slice(),
                collected: payments.reduce((a, b) => a + b, 0),
            },
        };
    };

    yield frame(`Public project costing ${cost} with ${n} reported values.`, 0, -1);
    step += 1;
    yield frame(`Total value ${total} ${build ? "reaches" : "misses"} the cost; decision is ${build ? "build" : "do not build"}.`, 2, -1);
    step += 1;

    for (let i = 0; i < n; i += 1) {
        const others = total - (values[i] ?? 0);
        yield frame(
            `Agent ${i}: without them others value ${others}; VCG payment ${payments[i]}.`,
            4,
            i,
        );
        step += 1;
    }

    yield frame(
        `Done: ${build ? "build" : "reject"} with welfare ${total - (build ? cost : 0)} and payments [${payments.join(", ")}].`,
        6,
        -1,
    );
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "VCG makes honest reporting the best move by charging each person the harm their presence causes others. For a shared project, first decide whether the group's total value justifies the cost. Then ask what would happen without each person: if their vote flips the decision, they pay exactly the surplus at stake; otherwise they pay nothing. Nobody can benefit by exaggerating because the charge tracks the decision they change.",
        invariants: [
            "The project is built exactly when total reported value meets the cost.",
            "A payment is positive only when that agent is pivotal.",
            "Each payment equals the welfare loss imposed on all other agents.",
        ],
        correctness:
            "VCG charges agent i the difference between the optimal welfare of the others when i is present and when i is absent. For a public project that difference is zero unless i's participation flips the build decision, in which case it is the cost gap that i alone closes or the surplus that i alone blocks. Because an agent's payment depends only on others' reports through the social choice, maximizing reported welfare truthfully is a dominant strategy.",
        complexityRationale:
            "Computing the total and each social welfare without one agent happens in one pass with prefix subtraction, so all decisions and payments take O(n) time. Storing the values and payments uses O(n) space.",
        uses: [
            "Public-good funding and cost-sharing decisions",
            "Spectrum and advertising auctions",
            "Truthful mechanism design in distributed systems",
        ],
        references: [
            "Vickrey, Counterspeculation, Auctions, and Competitive Sealed Tenders, 1961",
            "Clarke, Multipart Pricing of Public Goods, 1971",
            "Groves, Incentives in Teams, 1973",
        ],
        workedExample:
            "Values 8,5,4,2 sum to 19 against a cost of 12, so the project is built. Without the first agent the others total 11, which is below 12, so that agent is pivotal and pays 12 minus 11, or 1. Removing any other agent still leaves a total above 12, so those agents pay nothing.",
    },
    id: "vcg-mechanism",
    name: "VCG Mechanism",
    category: "game",
    complexity: { time: "O(n)", space: "O(n)" },
    defaultInput: { values: [8, 5, 4, 2], cost: 12 },
    visualType: "array",
    run,
    pseudocode: [
        "read reported values and the project cost",
        "compute total value across all agents",
        "build when total value is at least the cost",
        "for each agent compute total value of the others",
        "charge the externality when that agent is pivotal",
        "record all payments and resulting welfare",
        "done: report decision, welfare, and payments",
    ],
};

export default module;
