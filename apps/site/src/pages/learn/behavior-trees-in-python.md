---
layout: ../../layouts/ArticleLayout.astro
title: "Behavior Trees in Python: py_trees, ROS 2, and Quick Prototypes"
description: "How to build behavior trees in Python with py_trees — behaviours, composites, blackboards, and ASCII visualization — plus py_trees_ros for ROS 2 robots and when Python is (and isn't) the right runtime."
pubDate: "2026-07-28"
order: 10
---

# Behavior Trees in Python

Python won't be ticking the enemies in your 60 fps action game — but for robotics,
simulations, agent prototypes, and *learning how behavior trees actually work*, it's hard
to beat. The ecosystem has one clear standard library, **py_trees**, and a first-class
ROS 2 companion, **py_trees_ros**, maintained from the same lineage as the ROS navigation
work covered in [Behavior Trees in Robotics](/learn/behavior-trees-in-robotics/).

## py_trees in five minutes

Everything in py_trees is a `Behaviour` with an `update()` method returning a status —
the same Success/Failure/Running contract from
[the node reference](/learn/behavior-tree-nodes-explained/):

```python
import py_trees

class IsPlayerVisible(py_trees.behaviour.Behaviour):
    def update(self):
        return (py_trees.common.Status.SUCCESS
                if self.blackboard.visible
                else py_trees.common.Status.FAILURE)

class MoveToPlayer(py_trees.behaviour.Behaviour):
    def update(self):
        arrived = step_toward(self.blackboard.player_position)
        return (py_trees.common.Status.SUCCESS if arrived
                else py_trees.common.Status.RUNNING)

chase = py_trees.composites.Sequence("Chase", memory=False)
chase.add_children([IsPlayerVisible("Visible?"), MoveToPlayer("Move")])

root = py_trees.composites.Selector("Brain", memory=False)
root.add_children([chase, build_patrol_subtree()])

tree = py_trees.trees.BehaviourTree(root)
while True:
    tree.tick()
```

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
[the blackboard guide](/learn/behavior-tree-blackboard/), enforced by the library. And
**visualization is built in**: `py_trees.display.ascii_tree(root)` prints the tree with
live per-node status, which makes the tick semantics visible in a way no amount of reading
achieves.

```text
[o] Brain [*]
    [-] Chase [*]
        --> Visible? [o]
        --> Move [*]      ← Running
    [-] Patrol
```

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
