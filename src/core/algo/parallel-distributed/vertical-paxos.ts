/**
 * vertical-paxos.ts - Vertical Paxos (configuration and leader separated)
 *
 * ---------------------------------------------------------------------------
 * What it does
 * ---------------------------------------------------------------------------
 * Vertical Paxos separates the question of which acceptors form a quorum from
 * the question of who leads a round. A configuration master publishes a fresh
 * configuration and its primary; the primary drives prepare and accept rounds
 * inside that configuration. When the configuration changes, the new primary
 * reads the highest-ballot value from a quorum that intersects the old one, so
 * a value already chosen cannot be overwritten by a later configuration.
 *
 * ---------------------------------------------------------------------------
 * Complexity
 * ---------------------------------------------------------------------------
 *   Time:  O(configurations * quorumSize) simulated messages
 *   Space: O(acceptors) for the per-acceptor accepted ballot and value
 *
 * ---------------------------------------------------------------------------
 * Visualization mapping
 * ---------------------------------------------------------------------------
 *   - One bar per acceptor shows the value it accepted (-1 for none).
 *   - A reconfiguration is yellow, a recover step is comparing, a committed
 *     value is green.
 *   - meta carries the active configuration, primary, recovered value, and
 *     the intersection size between consecutive quorums.
 */

import type { AlgorithmModule, EntityState, VisualEntity, VisualFrame } from "@/types";

interface Acceptor {
    ballot: number;
    value: number;
}

interface Config {
    acceptors: number[];
    primary: number;
}

function makeBars(acceptors: Acceptor[], state: EntityState, primary: number): VisualEntity[] {
    return acceptors.map((acceptor, index) => ({
        id: `bar-${index}`,
        type: "bar" as const,
        label: acceptor.ballot === 0 ? "none" : String(acceptor.value),
        value: acceptor.value,
        state: index === primary ? "active" : state,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        metadata: { index, ballot: acceptor.ballot, primary: index === primary },
    }));
}

/** Simulate two configurations of a Vertical Paxos register. */
function* run(input: unknown): Generator<VisualFrame, void, unknown> {
    const task = (input as { acceptors?: number; configs?: Config[]; proposals?: number[] } | null) ?? {};
    const count = typeof task.acceptors === "number" ? Math.max(3, Math.floor(task.acceptors)) : 5;
    const configs: Config[] = Array.isArray(task.configs) && task.configs.length >= 2
        ? task.configs.map((config) => ({
              acceptors: Array.isArray(config?.acceptors) ? config.acceptors.map((value) => Number(value) || 0) : [],
              primary: Number(config?.primary) || 0,
          }))
        : [
              { acceptors: [0, 1, 2], primary: 0 },
              { acceptors: [2, 3, 4], primary: 3 },
          ];
    const proposals: number[] = Array.isArray(task.proposals) && task.proposals.length >= 2
        ? task.proposals.map((value) => Number(value) || 0)
        : [10, 20];

    const state: Acceptor[] = Array.from({ length: count }, () => ({ ballot: 0, value: -1 }));
    const distinct = (values: number[]): number[] => [...new Set(values)].sort((a, b) => a - b);
    const metaBase = (configIndex: number, config: Config, recovered: number, chosen: number, intersection: number) => ({
        config: configIndex,
        primary: config.primary,
        quorum: distinct(config.acceptors),
        recovered,
        chosen,
        intersection,
        accepted: state.map((acceptor) => acceptor.value),
    });

    let step = 0;
    yield {
        stepNumber: step,
        entities: makeBars(state, "idle", configs[0]!.primary),
        edges: [],
        description: `Starting Vertical Paxos with ${count} acceptors and ${configs.length} configurations.`,
        codeLineNumber: 0,
        layout: "array",
        meta: metaBase(0, configs[0]!, -1, -1, 0),
    };
    step += 1;

    let chosen = -1;
    for (let configIndex = 0; configIndex < configs.length; configIndex += 1) {
        const config = configs[configIndex]!;
        const quorum = distinct(config.acceptors);
        const intersection = configIndex === 0 ? quorum.length : quorum.filter((id) => {
            const previous = configs[configIndex - 1]!;
            return previous.acceptors.includes(id);
        }).length;
        const ballot = configIndex + 1;

        if (configIndex > 0) {
            yield {
                stepNumber: step,
                entities: makeBars(state, "comparing", config.primary),
                edges: [],
                description: `Configuration master publishes quorum [${quorum.join(", ")}] with primary ${config.primary}; intersection ${intersection}.`,
                codeLineNumber: 2,
                layout: "array",
                meta: metaBase(configIndex, config, chosen, chosen, intersection),
            };
            step += 1;
        }

        // Prepare: read the highest-ballot value in the new quorum.
        let bestBallot = -1;
        let recovered = -1;
        for (const id of quorum) {
            const acceptor = state[id];
            if (acceptor && acceptor.ballot > bestBallot) {
                bestBallot = acceptor.ballot;
                recovered = acceptor.value;
            }
        }
        if (bestBallot < 0) recovered = proposals[configIndex] ?? -1;
        yield {
            stepNumber: step,
            entities: makeBars(state, "comparing", config.primary),
            edges: [],
            description: `Primary ${config.primary} prepares at ballot ${ballot} and recovers value ${recovered}.`,
            codeLineNumber: 3,
            layout: "array",
            meta: metaBase(configIndex, config, recovered, chosen, intersection),
        };
        step += 1;

        // Accept: the primary must install the recovered value, not a fresh proposal.
        const desired = proposals[configIndex] ?? recovered;
        const installed = recovered >= 0 ? recovered : desired;
        for (const id of quorum) {
            const acceptor = state[id];
            if (!acceptor) continue;
            if (acceptor.ballot < ballot) {
                acceptor.ballot = ballot;
                acceptor.value = installed;
            }
        }
        if (chosen < 0 || recovered < 0) chosen = installed;
        yield {
            stepNumber: step,
            entities: makeBars(state, "sorted", config.primary),
            edges: [],
            description: `Quorum accepts ${installed}; the requested ${desired} is superseded when an older value was recovered.`,
            codeLineNumber: 5,
            layout: "array",
            meta: metaBase(configIndex, config, recovered, chosen, intersection),
        };
        step += 1;
    }

    yield {
        stepNumber: step,
        entities: makeBars(state, "sorted", -1),
        edges: [],
        description: `Chosen value ${chosen} survives all configuration changes.`,
        codeLineNumber: 6,
        layout: "array",
        meta: metaBase(configs.length - 1, configs[configs.length - 1]!, chosen, chosen, 1),
    };
}

const module: AlgorithmModule = {
    education: {
        intuition:
            "Vertical Paxos runs two decisions at right angles. The horizontal axis is the usual sequence of prepare and accept rounds that picks a value; the vertical axis is a configuration master that decides which acceptors and which primary are allowed to participate. Changing the configuration is safe as long as the new quorum overlaps the old one, because the overlap remembers the chosen value.",
        invariants: [
            "Each configuration has a quorum and a distinguished primary.",
            "Consecutive quorums intersect, so at least one acceptor remembers the chosen value.",
            "A primary always proposes the highest-ballot value it recovers, never an arbitrary new one.",
        ],
        correctness:
            "Paxos safety says a value chosen at one ballot is the only value that can be chosen at any later ballot. A configuration change does not alter the acceptors' stored ballots, so when the new primary prepares it reads the highest-ballot value from a quorum that intersects the quorum which chose the old value. By the intersection argument that read must return the chosen value, and the primary is forced to re-propose it. Therefore a later configuration cannot overwrite an already chosen value.",
        complexityRationale:
            "Each configuration runs one prepare and one accept pass over its quorum, costing O(quorum size) messages per pass and O(configurations times quorum size) overall. The acceptors' ballots and values need O(number of acceptors) space.",
        uses: [
            "Reconfigurable consensus in production replicated logs",
            "Membership changes without stopping a Paxos deployment",
            "Separating leasing and configuration from the core consensus protocol",
        ],
        references: [
            "Lamport, Mazieres, and Prasad, Vertical Paxos and Primary-Backup Replication, 2009",
            "Lamport, Paxos Made Simple, 2001",
        ],
        workedExample:
            "Configuration one uses acceptors zero, one and two and chooses value 10. The master publishes configuration two with acceptors two, three and four. The new primary reads acceptor two, recovers 10, and must install 10 even though its proposer asked for 20. The chosen value therefore remains 10.",
    },
    id: "vertical-paxos",
    name: "Vertical Paxos",
    category: "parallel-distributed",
    complexity: { time: "O(configurations * quorumSize)", space: "O(acceptors)" },
    defaultInput: {
        acceptors: 5,
        configs: [
            { acceptors: [0, 1, 2], primary: 0 },
            { acceptors: [2, 3, 4], primary: 3 },
        ],
        proposals: [10, 20],
    },
    visualType: "array",
    run,
    pseudocode: [
        "initialize every acceptor with no accepted ballot or value",
        "for each configuration published by the master",
        "send prepare from the primary and read the highest-ballot value",
        "fall back to the requested value only when no prior value exists",
        "send accept and install that value across the quorum",
        "carry the chosen value into the next configuration",
        "done: report the chosen value and the quorum intersections",
    ],
};

export default module;
