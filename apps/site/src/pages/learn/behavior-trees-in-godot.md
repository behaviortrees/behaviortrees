---
layout: ../../layouts/ArticleLayout.astro
title: "Behavior Trees in Godot: LimboAI, Beehave, and Rolling Your Own"
description: "Godot doesn't ship behavior trees, but the ecosystem has strong free options — LimboAI, Beehave, or a small GDScript implementation of your own — compared honestly, with a design-first workflow."
pubDate: "2026-10-18"
order: 8
---

# Behavior Trees in Godot

Unlike [Unreal](/learn/behavior-trees-in-unreal-engine/), Godot has no built-in behavior
tree system — and unlike [Unity's asset store](/learn/behavior-trees-in-unity/), you won't
be weighing paid options: the leading Godot solutions are free and open source. The real
decision is between two very different philosophies, plus the ever-present option of
writing your own. (Still deciding whether behavior trees fit at all? Start with
[Behavior Trees vs Finite State Machines](/learn/behavior-trees-vs-state-machines/).)

## Option 1: LimboAI (the feature-complete one)

**LimboAI** is the most complete behavior tree implementation for Godot 4: a dedicated
visual tree editor inside the Godot editor, a rich built-in task library, a proper
[blackboard](/learn/behavior-tree-blackboard/) with scoping, live in-editor debugging of
running trees, and custom tasks written in GDScript. The core is C++, so it runs as native
code rather than interpreted script, and it comes two ways: a GDExtension you install from
the Asset Library (Godot 4.6+ for the current 1.8 release), or a module compiled into a
custom engine build. The module has a slightly better editor experience, and it's the
route to take if you want to write tasks in C# — C# is only confirmed working with the
.NET module builds.

Two design choices stand out:

- **Trees are resources, not scene nodes.** One `.tres` tree asset can drive any number of
  agents, each with its own blackboard — the same stateless-tree model used by behavior3
  and most production engines.
- **It ships a hierarchical state machine too** (`LimboHSM`), designed to interoperate:
  states can run behavior trees. That's the "FSM at the top, BTs inside" hybrid
  [real games use](/learn/behavior-trees-vs-state-machines/), supported out of the box.
  (State machines are set up in code; only the trees get a visual editor.)
- **Blackboards are scoped.** A tree declares its variables in a blackboard *plan*, each
  agent can override them, and scopes chain to a parent — so a squad of agents can share
  data through a common parent scope while keeping their own.

**Choose it if** you're building a serious project and want the closest thing Godot has to
Unreal's integrated BT tooling. **Watch out for**: it's a bigger dependency with its own
editor conventions, and native builds must match your Godot version.

## Option 2: Beehave (the Godot-native one)

**Beehave** takes the opposite approach: behavior trees are built from ordinary Godot
nodes, right in your scene tree. A `BeehaveTree` node has composite children (sequence,
selector — including memory variants), which have condition/action leaves that are just
GDScript classes overriding a `tick()` method.

The appeal is that it feels like Godot — you compose trees in the scene dock you already
know, no new editor to learn, and the whole library is readable GDScript. It still covers
the essentials: a **Beehave tab in Godot's debugger** shows each tree's live node states
while the game runs, and every tree gets its own [blackboard](/learn/behavior-tree-blackboard/)
(shareable between trees, with built-in leaves to set, check, and compare keys).

The trade-offs follow from the scene-node design: each agent carries its own copy of the
tree as live nodes (heavier at large agent counts), there's no dedicated tree editor beyond
the scene dock, and the blackboard is simpler than LimboAI's plans and scope chains.

**Choose it if** you want the gentlest learning curve, your agent count is modest, and
"just Godot nodes" sounds better than "an embedded AI IDE."

## Option 3: roll your own

A minimal BT core in GDScript is genuinely small — a status enum, a base task with a
`tick()` method, sequence, selector, and a couple of decorators (the
[from-scratch walkthrough](/learn/how-to-implement-a-behavior-tree/) covers the exact
shape, and it ports to GDScript almost line for line). Godot's `Resource` system even
gives you tree serialization for free.

The trap is the same as everywhere: the core is a weekend, the *tooling* — visual
authoring, live inspection — is months. If you go this route, keep design in an external
editor and load a data format rather than hand-building trees in code.

## A design-first workflow for all three

The structure of your tree — priorities, guards, fallbacks — is independent of which
runtime executes it:

1. **Sketch the tree** in the free [online behavior tree editor](/): get the priority
   ladder and conditions right while changes cost nothing.
2. **Walk the design** against the [common patterns](/learn/behavior-tree-examples/) —
   survival override on top? retries around flaky actions?
3. **Translate**: each condition/action leaf in the sketch becomes a LimboAI task, a
   Beehave leaf, or a class in your own runtime; each blackboard key in the design becomes
   a real key.
4. Iterate in the sketch first whenever the logic changes — then mirror it in Godot.

<a class="try-editor" href="/?example=enemy-patrol">▶ Sketch a patrol/chase/attack tree now</a>

## Related guides

- [Sequence, Selector, and Decorator Nodes Explained](/learn/behavior-tree-nodes-explained/)
- [Behavior Tree Blackboards](/learn/behavior-tree-blackboard/)
- Comparing engines? [Best Behavior Tree Tools by Engine](/learn/best-behavior-tree-tools/)
- Shipping on other engines too? [Unity](/learn/behavior-trees-in-unity/) ·
  [Unreal](/learn/behavior-trees-in-unreal-engine/)
