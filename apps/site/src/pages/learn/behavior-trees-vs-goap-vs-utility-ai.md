---
layout: ../../layouts/ArticleLayout.astro
title: "Behavior Trees vs GOAP vs Utility AI: Picking an Architecture"
description: "The three mainstream game AI architectures compared honestly — authored behavior trees, GOAP planners, and utility scoring — with the trade-offs, famous examples, and the hybrids real games actually ship."
pubDate: "2026-07-28"
draft: true
books: [millington, mark, gameAiPro]
order: 5
---

# Behavior Trees vs GOAP vs Utility AI

<div class="disclosure">Disclosure: some links on this page are affiliate links. If you buy
through them we may earn a commission at no extra cost to you. It helps keep the free editor
running.</div>

Once you've ruled out a plain state machine (see
[Behavior Trees vs Finite State Machines](/learn/behavior-trees-vs-state-machines/)), three
architectures dominate the conversation: behavior trees, GOAP, and utility AI. All three
have shipped in acclaimed games. They differ on one axis that matters more than any feature
list: **who decides the sequence of actions — you, at design time, or the system, at
runtime?**

## The 30-second versions

A **behavior tree** is an *authored* priority structure: you write down what to try and in
what order, and the tree reactively picks the highest-priority branch whose conditions
hold. ([Full introduction here](/learn/what-is-a-behavior-tree/).)

**GOAP** (Goal-Oriented Action Planning) gives the agent a *goal* ("player is dead") and a
pile of actions, each with preconditions and effects ("Shoot: requires loaded weapon,
causes damage"). A planner then *searches* for an action sequence that reaches the goal —
at runtime, per situation. Jeff Orkin's AI for *F.E.A.R.* (2005) made the technique famous,
and its soldiers' flanking and improvisation are still cited today.

**Utility AI** scores every possible action continuously — each action gets a curve-driven
number from current state (hunger, distance, ammo, threat) and the best score wins. It's
how *The Sims* weighs a Sim's needs, and Dave Mark's "Infinite Axis" formulation of it is
widely used for ambient and sim-heavy AI.

## What each one buys you — and costs you

**Behavior trees** buy *legibility and control*. The tree is the documentation; designers
can read it, tooling can visualize it, and QA can reproduce it. The cost: a BT will never
surprise you. If you didn't author a branch for a situation, the agent has no answer to it.

**GOAP** buys *emergence*. The planner finds action chains you never explicitly wrote,
which is magic when it works — and the problem when it doesn't. Debugging means asking
"why did the planner choose this chain?", planning has a real CPU cost, and tuning behavior
means indirectly nudging costs and world-state modeling rather than editing a structure.
Most games that tried GOAP discovered their design actually wanted *authored* behavior:
predictable enemies that telegraph and can be learned. It shines when improvisation is the
point.

**Utility AI** buys *smooth prioritization over many competing motives*. Where a BT
expresses "flee beats fight" as a hard ordering, utility expresses "flee gradually becomes
more attractive as health drops and distance closes" — no thresholds, no branch flapping.
The cost is tuning and explainability: behavior lives in curve shapes and weight tables,
and "why did he do that?" turns into spreadsheet archaeology.

## Head to head

| Dimension | Behavior tree | GOAP | Utility AI |
|-----------|---------------|------|------------|
| Who sequences actions | Author | Runtime planner | Neither — continuous re-scoring |
| Predictability | **High** | Low | Medium |
| Emergent solutions | None | **The whole point** | Some |
| Debugging | Read the tree | Inspect planner search | Inspect scores/curves |
| Designer tooling | **Mature visual editors** | Rare | Spreadsheets + custom UIs |
| CPU cost | Low–medium | Planning spikes | Scoring every option, often |
| Sweet spot | Enemies, bosses, NPCs, robots | Improvising agents, sim sandboxes | Ambient life, colony/sim games |

## The hybrids real games ship

These compose more often than they compete:

- **Utility selector inside a BT.** The tree stays the skeleton, but one selector picks
  its child by score instead of fixed order — top-N attacks scored by range, ammo, and
  cooldown. You keep the tree's legibility and get smooth choice where it counts.
- **Utility/GOAP picks the goal, a BT executes it.** A scorer or planner decides *what* to
  pursue ("raid the larder"); an authored subtree handles *how*, with all the retry and
  fallback patterns from [the examples catalog](/learn/behavior-tree-examples/).
- **BT with planned leaves.** The tree is in charge, but one leaf invokes a planner for a
  genuinely open-ended sub-problem (multi-step manipulation is common in
  [robotics](/learn/behavior-trees-in-robotics/)).

## So which should you use?

- **Default to a behavior tree.** For enemies, companions, bosses, and mission logic,
  authored, readable, tool-supported control wins — which is why BTs are the mainstream
  choice in [Unity](/learn/behavior-trees-in-unity/),
  [Unreal](/learn/behavior-trees-in-unreal-engine/), and robotics alike.
- **Reach for utility** when many soft motives compete continuously — colony sims, ambient
  crowds, needs-driven characters — or as a scoring selector inside your tree.
- **Reach for GOAP** when emergent improvisation *is* the design pillar and you'll budget
  real time for planner debugging.

For the theory behind all three, **Ian Millington's *AI for Games***
([Amazon](https://www.amazon.com/dp/1138483974?tag=behaviortrees-20)) covers
the field, and **Dave Mark's *Behavioral Mathematics for Game AI***
([Amazon](https://www.amazon.com/dp/1584506849?tag=behaviortrees-20))
is the standard utility text. The free [Game AI Pro chapters](https://www.gameaipro.com/)
include first-hand writeups of every architecture above.

If a behavior tree is your pick, sketch your agent in the
[free online editor](/) before writing any code:

<a class="try-editor" href="/?example=enemy-patrol">▶ Start from the enemy AI example</a>

## Related guides

- [Behavior Trees vs Finite State Machines](/learn/behavior-trees-vs-state-machines/)
- [What Is a Behavior Tree?](/learn/what-is-a-behavior-tree/)
- [Behavior Tree Examples: Common Game AI Patterns](/learn/behavior-tree-examples/)
