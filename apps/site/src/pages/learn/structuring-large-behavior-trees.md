---
layout: ../../layouts/ArticleLayout.astro
title: "Structuring Large Behavior Trees: Subtrees, Reuse, and Scale"
description: "How to keep behavior trees readable past 30 nodes — priority layering, extracting subtrees, parameterized leaves, naming conventions, and knowing when logic shouldn't live in the tree at all."
pubDate: "2026-07-28"
books: [gameAiPro, millington, colledanchise]
order: 14
---

# Structuring Large Behavior Trees

Every behavior tree starts readable. Then the boss needs a phase two, the designer wants a
taunt, QA finds an edge case near ledges — and eighteen months later the tree is 200 nodes
of archaeology. Trees don't scale automatically; they scale when you apply the same
discipline you'd apply to code. These are the techniques that keep big trees legible, in
the order you'll need them.

## 1. Make the root read like a table of contents

The top level of the tree should be a plain selector of *complete, named behaviors* in
priority order — and nothing else:

```text
Selector "Brain"
├── Subtree "Survive"      (health/ammo emergencies)
├── Subtree "Combat"       (attack ladder)
├── Subtree "Investigate"  (heard something)
├── Subtree "Work"         (the agent's day job)
└── Subtree "Idle"         (unconditional fallback)
```

Anyone — including you in six months — should learn the agent's whole personality from
five lines. If raw conditions and actions are poking through at the root, push them down.
The [survival-override and priority-ladder patterns](/learn/behavior-tree-examples/) slot
directly into this frame.

## 2. Extract subtrees like you extract functions

The same signal applies: when a branch is big enough to *name*, extract it. A subtree with
a clear name and a clear contract can be understood, tested, and reused without reading its
internals — grafting "Take Cover" into a new agent should be one edit, the way it was one
edit to add a Flee branch in [the FSM comparison](/learn/behavior-trees-vs-state-machines/).

The contract part is what people skip. A subtree's inputs and outputs are
[blackboard keys](/learn/behavior-tree-blackboard/): "Take Cover" *reads*
`threatPosition`, *writes* `inCover`. Document that next to the subtree. An undocumented
subtree is coupled to every tree that uses it in ways nobody can see — robotics
frameworks solve this with explicit port remapping at subtree boundaries
([BehaviorTree.CPP](/learn/behavior-trees-in-robotics/)), and that's the discipline to
imitate even when your framework doesn't enforce it.

## 3. Keep leaves few, generic, and parameterized

Big trees usually aren't big because the *logic* is big — they're big because leaves
multiplied. `MoveToPlayer`, `MoveToCover`, `MoveToWaypoint`, `MoveToLeader` is one
`MoveTo(targetKey)` wearing four costumes. A tight, parameterized leaf vocabulary (a few
dozen leaves for a whole game is realistic) means new behaviors are new *arrangements*,
not new code — and designers can build them without a programmer.

Naming keeps the tree scannable: **questions for conditions** (`Is Target Visible?`),
**imperative verbs for actions** (`Reload Weapon`), **noun phrases for subtrees**
(`Ranged Attack`). Mixed naming is a small tax on every single read.

## 4. Guard branches at the top, not inside

Put each branch's entry conditions as the first children of the branch (or as decorators
on it), not scattered through its interior. A reader deciding "is this branch relevant to
my bug?" should answer at the branch's first line. Interior guards also re-run on every
tick the branch is active — which is where
[condition-with-side-effects bugs](/learn/debugging-behavior-trees/) love to hide.

## 5. Vary agents by grafting, not copying

When the sniper needs 80% of the grunt's brain, don't copy the tree — share the subtrees
and compose different top levels. Shared "Survive," shared "Investigate," different
"Combat." Fixes to shared subtrees then propagate to every agent type at once. (This is
also the argument for keeping trees as data rather than code — one subtree file, many
trees referencing it.)

## 6. Know what doesn't belong in the tree

The fastest way to shrink a tree is to remove what shouldn't be there:

- **Animation and locomotion details** belong in an animation state machine the tree's
  actions *drive* — "BT for decisions, FSM for execution."
- **Smooth many-way choices** ("which of nine attacks?") may want a utility-scored
  selector rather than nine hand-ordered branches — see
  [BTs vs GOAP vs Utility](/learn/behavior-trees-vs-goap-vs-utility-ai/).
- **Expensive perception** belongs in sensors that write the blackboard on their own
  schedule, not in tree conditions.

A tree that only makes *decisions* stays small enough to read.

## Test subtrees the way you test functions

Extracted subtrees can run standalone: stub the blackboard keys they read, tick them, and
assert what they write. Most structural bugs are cheaper to catch in a five-node harness
than a two-hundred-node brain — and when something does break in the full tree,
[the usual six suspects](/learn/debugging-behavior-trees/) apply.

The editor is a good place to feel these techniques out: the
[pick-and-place example](/?example=robot-pick-and-place) shows guarded, escalating
structure in miniature, and multi-tree projects let you sketch subtrees separately before
composing them.

<a class="try-editor" href="/?example=robot-pick-and-place">▶ Study a well-structured tree in the editor</a>

## Related guides

- [Behavior Tree Examples: Common Game AI Patterns](/learn/behavior-tree-examples/)
- [Behavior Tree Blackboards](/learn/behavior-tree-blackboard/)
- [Debugging Behavior Trees](/learn/debugging-behavior-trees/)
