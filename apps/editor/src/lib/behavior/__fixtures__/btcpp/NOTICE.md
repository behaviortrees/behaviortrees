# Nav2 fixtures

The `nav2-*.xml` files are unmodified copies from the ROS 2 Navigation Stack
(https://github.com/ros-navigation/navigation2), licensed under the Apache
License 2.0 by their packages (`nav2_bt_navigator`, `nav2_behavior_tree`).
They are used only as test fixtures for BehaviorTree.CPP XML import/export.

| File | Source | Commit |
| --- | --- | --- |
| `nav2-humble-navigate.xml` | `nav2_bt_navigator/behavior_trees/navigate_to_pose_w_replanning_and_recovery.xml` (branch `humble`) | `3c3db59d6969d8ecee8e68468693d006397f4a0c` |
| `nav2-jazzy-navigate.xml` | `nav2_bt_navigator/behavior_trees/navigate_to_pose_w_replanning_and_recovery.xml` (branch `jazzy`) | `58e4019eb149ed4387938d9cd13f38659b86f754` |
| `nav2-tree-nodes-humble.xml` | `nav2_behavior_tree/nav2_tree_nodes.xml` (branch `humble`) | `3c3db59d6969d8ecee8e68468693d006397f4a0c` |
| `nav2-tree-nodes-jazzy.xml` | `nav2_behavior_tree/nav2_tree_nodes.xml` (branch `jazzy`) | `58e4019eb149ed4387938d9cd13f38659b86f754` |

`multi-subtree.xml` and `v3-legacy.xml` are written for these tests.
