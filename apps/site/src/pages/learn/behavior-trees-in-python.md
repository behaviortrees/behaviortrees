---
layout: ../../layouts/ArticleLayout.astro
title: "Behavior Trees in Python: py_trees Tutorial and ROS 2 Guide"
description: "Build a behavior tree in Python with py_trees: runnable code, blackboards, live tree output, a 40-line version from scratch, and py_trees_ros for ROS 2."
pubDate: "2026-07-28"
updatedDate: "2026-10-19"
order: 10
---

# Behavior Trees in Python

Python won't be ticking the enemies in your 60 fps action game — but for robotics,
simulations, agent prototypes, and *learning how behavior trees actually work*, it's hard
to beat. The ecosystem has one clear standard library, **py_trees**, and a first-class
ROS 2 companion, **py_trees_ros**, maintained from the same lineage as the ROS navigation
work covered in [Behavior Trees in Robotics](/learn/behavior-trees-in-robotics/).

## py_trees in five minutes

```bash
pip install "py_trees>=2.2"
```

Everything in py_trees is a `Behaviour` with an `update()` method returning a status —
the same Success/Failure/Running contract from
[the node reference](/learn/behavior-tree-nodes-explained/). This complete script runs
as-is on py_trees 2.2 and later (tested on 2.6, the version ROS 2 Humble ships): a guard
reads the blackboard, a long-running move takes a few ticks, and a patrol fallback runs
when the guard fails. Older releases, such as the 2.1.x in ROS 2 Foxy, handle `memory`
differently and won't produce the output below.

```python
import py_trees
from py_trees.common import Access, Status


class IsPlayerVisible(py_trees.behaviour.Behaviour):
    def __init__(self, name):
        super().__init__(name)
        self.bb = self.attach_blackboard_client()
        self.bb.register_key("player_visible", access=Access.READ)

    def update(self):
        return Status.SUCCESS if self.bb.player_visible else Status.FAILURE


class MoveToPlayer(py_trees.behaviour.Behaviour):
    def __init__(self, name, steps=2):
        super().__init__(name)
        self.steps = steps

    def initialise(self):
        self.remaining = self.steps

    def update(self):
        self.remaining -= 1
        return Status.SUCCESS if self.remaining <= 0 else Status.RUNNING


def build_tree():
    chase = py_trees.composites.Sequence("Chase", memory=False)
    chase.add_children([IsPlayerVisible("Player visible?"), MoveToPlayer("Move to player")])

    patrol = py_trees.behaviours.Running("Patrol")

    root = py_trees.composites.Selector("Brain", memory=False)
    root.add_children([chase, patrol])
    return py_trees.trees.BehaviourTree(root)


if __name__ == "__main__":
    world = py_trees.blackboard.Client(name="World")
    world.register_key("player_visible", access=Access.WRITE)

    tree = build_tree()
    for tick, visible in enumerate([False, True, True], start=1):
        world.player_visible = visible
        tree.tick()
        print(f"--- tick {tick} (player_visible={visible}) ---")
        print(py_trees.display.ascii_tree(tree.root, show_status=True))
```

Run it and the tree prints its own state after every tick:

```text
--- tick 1 (player_visible=False) ---
[o] Brain [*]
    [-] Chase [x]
        --> Player visible? [x]
        --> Move to player [-]
    --> Patrol [*] -- running

--- tick 2 (player_visible=True) ---
[o] Brain [*]
    [-] Chase [*]
        --> Player visible? [o]
        --> Move to player [*]
    --> Patrol [-]

--- tick 3 (player_visible=True) ---
[o] Brain [o]
    [-] Chase [o]
        --> Player visible? [o]
        --> Move to player [o]
    --> Patrol [-]
```

`[-]` is a Sequence, `[o]` a Selector, `-->` a leaf; the trailing marks are the status
(`o` success, `x` failure, `*` running, `-` invalid: not ticked yet, or reset after being
halted). Tick 2 is the interesting one: the
player appears, the higher-priority Chase branch takes over, and py_trees **halts the
running Patrol** (its status resets to `-`). That's the reactive preemption a
`memory=False` Selector gives you, and seeing it happen is worth more than any diagram.

The pieces map directly onto standard BT vocabulary:

| Concept | py_trees |
|---------|----------|
| Sequence / Selector | `composites.Sequence` / `composites.Selector` |
| Memory variants | The same classes with `memory=True` |
| Parallel | `composites.Parallel` with a success policy |
| Decorators | `decorators.Inverter`, `Retry`, `Timeout`, `OneShot`, … |
| [Blackboard](/learn/behavior-tree-blackboard/) | `blackboard.Client` with per-key read/write registration |
| Long-running actions | Return `RUNNING`; `initialise()`/`terminate()` hooks fire on enter/exit |

Two details are unusually well done. The **blackboard requires behaviours to register
which keys they read and write** — the "treat keys as an API" discipline from
[the blackboard guide](/learn/behavior-tree-blackboard/), enforced by the library. Read a
key you didn't register and py_trees raises instead of silently returning stale data. And
**visualization is built in**: `ascii_tree` above, `unicode_tree` for nicer terminals, and
`py_trees.display.render_dot_tree(root)` to export the tree as a diagram for docs or code
review. That last one needs the Graphviz `dot` program, which pip doesn't install
(`brew install graphviz` or `apt install graphviz`).

## A behavior tree in Python from scratch

If you don't need a library, or want to understand what py_trees is doing, the core of a
behavior tree fits in about 40 lines of plain Python:

```python
from enum import Enum


class Status(Enum):
    SUCCESS = "success"
    FAILURE = "failure"
    RUNNING = "running"


class Sequence:
    def __init__(self, *children):
        self.children = children

    def tick(self, bb):
        for child in self.children:
            status = child.tick(bb)
            if status is not Status.SUCCESS:
                return status
        return Status.SUCCESS


class Selector:
    def __init__(self, *children):
        self.children = children

    def tick(self, bb):
        for child in self.children:
            status = child.tick(bb)
            if status is not Status.FAILURE:
                return status
        return Status.FAILURE


class Condition:
    def __init__(self, check):
        self.check = check

    def tick(self, bb):
        return Status.SUCCESS if self.check(bb) else Status.FAILURE


class Action:
    def __init__(self, run):
        self.run = run

    def tick(self, bb):
        return self.run(bb)


def move_to_player(bb):
    bb["distance"] -= 1
    return Status.SUCCESS if bb["distance"] <= 0 else Status.RUNNING


def patrol(bb):
    return Status.RUNNING


brain = Selector(
    Sequence(Condition(lambda bb: bb["player_visible"]), Action(move_to_player)),
    Action(patrol),
)

bb = {"player_visible": True, "distance": 2}
print(brain.tick(bb))  # Status.RUNNING
print(brain.tick(bb))  # Status.SUCCESS
```

A plain dict stands in for the blackboard and plain functions stand in for leaf classes.
This version leaves out much of what py_trees adds: `initialise()`/`terminate()` hooks
(here, if the player is lost and spotted again, the move resumes from the old distance
instead of starting over), halting a running branch when a higher-priority one takes over,
memory composites, decorators, parallel policies, and visualization.
[How to Write a Behavior Tree from Scratch](/learn/how-to-implement-a-behavior-tree/) builds
the same core in TypeScript, adds memory composites, and explains why interruption cleanup
is the hardest part of a real runtime. Reach for py_trees once you need more than a sketch.

## py_trees_ros: trees on real robots

For ROS 2, **py_trees_ros** wraps the same core with the robotics essentials: behaviours
that call ROS actions and services asynchronously, subscribers that mirror topics into the
blackboard, and snapshot publishing so the **py_trees_ros_viewer** GUI can watch a live
tree over the network — the same "watch the tree run" workflow Groot2 provides for
BehaviorTree.CPP. Python's tick rates (typically 10–50 Hz for mission logic) are a
non-issue for task orchestration; the hard real-time control loops live below the tree in
controllers anyway.

If your stack is C++/Nav2, use [BehaviorTree.CPP](/learn/behavior-trees-in-robotics/); if
it's Python-first — research platforms, quick field tooling, coursework — py_trees is the
standard.

## When Python is the wrong runtime (and it still helps)

For a shipping game you'll execute trees in
[Unity](/learn/behavior-trees-in-unity/), [Unreal](/learn/behavior-trees-in-unreal-engine/),
or [Godot](/learn/behavior-trees-in-godot/) — but a 50-line Python prototype is still the
fastest way to validate tree *logic* before touching engine code. Stub every action with a
counter, tick the tree in a loop, print the ascii tree, and watch whether your priorities
and guards actually do what you intended. Logic bugs cost minutes here and hours in-engine.

The same goes for design: sketch the structure visually first, then write the Python.

<a class="try-editor" href="/?example=robot-pick-and-place">▶ Explore the pick-and-place tree in the editor</a>

## Related guides

- [Behavior Trees in Robotics: BehaviorTree.CPP, ROS 2, and Nav2](/learn/behavior-trees-in-robotics/)
- [How to Write a Behavior Tree from Scratch](/learn/how-to-implement-a-behavior-tree/)
- [Behavior Tree Blackboards](/learn/behavior-tree-blackboard/)
- Comparing engines? [Best Behavior Tree Tools by Engine](/learn/best-behavior-tree-tools/)
