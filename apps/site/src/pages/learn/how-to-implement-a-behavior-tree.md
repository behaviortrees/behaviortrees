---
layout: ../../layouts/ArticleLayout.astro
title: "How to Write a Behavior Tree from Scratch (~100 Lines)"
description: "Implement a working behavior tree runtime yourself: the status enum, sequence, selector, memory variants, and decorators in about 100 lines of TypeScript that port directly to C#, GDScript, or C++."
pubDate: "2026-07-28"
books: [gameAiPro, millington, buckland]
order: 13
---

# How to Write a Behavior Tree from Scratch

<div class="disclosure">Disclosure: some links on this page are affiliate links. If you buy
through them we may earn a commission at no extra cost to you.</div>

The core of a behavior tree runtime is famously small — small enough that writing one is
the single best way to *actually* understand tick semantics. This guide builds a complete,
working core in about 100 lines of TypeScript. It ports almost line-for-line to C#,
GDScript, or C++; there's nothing language-specific in it. (If sequences and selectors
aren't second nature yet, read [the node reference](/learn/behavior-tree-nodes-explained/)
first — this article implements exactly what that one describes.)

## The contract: one method, three answers

Everything is a node with a `tick()` method returning one of three statuses:

```ts
enum Status { Success, Failure, Running }

interface Node {
  tick(agent: Agent): Status;
}
```

Leaves do work; composites route ticks. That's the whole architecture.

## Leaves: conditions and actions

```ts
class Condition implements Node {
  constructor(private check: (agent: Agent) => boolean) {}
  tick(agent: Agent): Status {
    return this.check(agent) ? Status.Success : Status.Failure;
  }
}

class Action implements Node {
  constructor(private act: (agent: Agent) => Status) {}
  tick(agent: Agent): Status {
    return this.act(agent);
  }
}
```

The `Action` callback returning `Status` — not boolean — is load-bearing: a `moveTo` that
isn't there yet returns `Running`, and the tree waits. Skipping `Running` is
[classic mistake #5](/learn/debugging-behavior-trees/).

## Composites: sequence and selector

```ts
class Sequence implements Node {
  constructor(private children: Node[]) {}
  tick(agent: Agent): Status {
    for (const child of this.children) {
      const status = child.tick(agent);
      if (status !== Status.Success) return status;  // Failure or Running stops the walk
    }
    return Status.Success;
  }
}

class Selector implements Node {
  constructor(private children: Node[]) {}
  tick(agent: Agent): Status {
    for (const child of this.children) {
      const status = child.tick(agent);
      if (status !== Status.Failure) return status;  // Success or Running stops the walk
    }
    return Status.Failure;
  }
}
```

Notice they're mirror images — sequence bails on non-Success, selector on non-Failure.
Every tick restarts the walk from child zero, which is what makes these *reactive*: a
higher-priority selector branch reclaims control the instant its guard passes.

## Memory variants and decorators

A memory sequence resumes where it left off instead of restarting — the fix for
procedural checklists:

```ts
class MemSequence implements Node {
  private current = 0;
  constructor(private children: Node[]) {}
  tick(agent: Agent): Status {
    while (this.current < this.children.length) {
      const status = this.children[this.current].tick(agent);
      if (status === Status.Running) return status;
      if (status === Status.Failure) { this.current = 0; return status; }
      this.current++;
    }
    this.current = 0;
    return Status.Success;
  }
}
```

Decorators wrap one child and transform its result:

```ts
class Inverter implements Node {
  constructor(private child: Node) {}
  tick(agent: Agent): Status {
    const status = this.child.tick(agent);
    if (status === Status.Success) return Status.Failure;
    if (status === Status.Failure) return Status.Success;
    return Status.Running;
  }
}
```

`Repeater`, `UntilSuccess`, `Cooldown` and friends are each 5–10 lines in the same shape.

## Assemble and run

The [patrol/chase/attack ladder](/learn/behavior-tree-examples/), verbatim:

```ts
const brain = new Selector([
  new Sequence([new Condition(inRange), new Action(attack)]),
  new Sequence([new Condition(canSee),  new Action(chase)]),
  new MemSequence([new Action(moveToWaypoint), new Action(wait2s), new Action(nextWaypoint)]),
]);

// game loop
for (const agent of agents) brain.tick(agent);
```

That's a working behavior tree. Total: about 100 lines.

## What production adds (and why you shouldn't hand-code trees)

Three things separate this from a production runtime:

1. **A [blackboard](/learn/behavior-tree-blackboard/).** Note the sneaky bug above:
   `MemSequence` stores `current` on the node, so *sharing one tree across agents breaks*.
   Production runtimes keep per-node state in a per-agent blackboard
   (`blackboard.get(key, treeId, nodeId)`), keeping the tree itself stateless and shareable.
2. **Enter/exit hooks.** When a higher branch preempts a running action, that action needs
   an `onExit`/`halt` callback to stop the animation, cancel the path request, release the
   claimed resource. Interruption cleanup is the hardest 20% of a real runtime.
3. **Data-driven trees.** Building trees in code (like the snippet above) buries your AI
   design in constructor calls. Real pipelines load trees from data — which is exactly
   what the [free online editor](/) exports: behavior3-format JSON listing nodes,
   properties, and children, ready for a loader that maps node names to your classes.

Design the tree visually, export JSON, and let your hundred lines execute it:

<a class="try-editor" href="/?example=enemy-patrol">▶ Open the tree this article implements</a>

## Going further

"The Behavior Tree Starter Kit" by Alex Champandard and Philip Dunstan does this same
exercise in C++, then goes past it. Their "second generation" design splits shared node
data from per-agent runtime state (the fix for the shared-tree bug above), packs a tree's
nodes into one block of memory, and switches to event-driven traversal. The
chapter is a [free PDF](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter06_The_Behavior_Tree_Starter_Kit.pdf),
the code is [on GitHub](https://github.com/aigamedev/btsk), and it comes from the first
*Game AI Pro* book
([Amazon](https://www.amazon.com/dp/1466565969?tag=behaviortrees-20)), whose other
chapters are written by working game AI programmers.

## Related guides

- [Sequence, Selector, and Decorator Nodes Explained](/learn/behavior-tree-nodes-explained/)
- [Debugging Behavior Trees](/learn/debugging-behavior-trees/)
- [Behavior Trees in Python](/learn/behavior-trees-in-python/) — the same exercise with py_trees
