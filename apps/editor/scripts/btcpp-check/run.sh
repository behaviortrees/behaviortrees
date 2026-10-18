#!/usr/bin/env bash
# Checks the editor's BehaviorTree.CPP export against the real library.
#
#   1. Downloads Nav2's trees and node models (Humble = BT.CPP v3.8, Jazzy = v4)
#      at pinned commits into .cache/.
#   2. Imports and re-exports them, plus the behavior3 examples translated to
#      v3 and v4, with the editor's own code (export-corpus.ts) into .out/.
#   3. Loads every file with BT.CPP in Docker (check.cpp). Nav2's original
#      files run first as a control: if they fail, the checker is wrong.
#
# Needs Docker. Usage: pnpm check:btcpp   (from apps/editor)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
EDITOR="$(cd "$HERE/../.." && pwd)"
CACHE="$HERE/.cache"
OUT="$HERE/.out"

NAV2_HUMBLE=3c3db59d6969d8ecee8e68468693d006397f4a0c
NAV2_JAZZY=58e4019eb149ed4387938d9cd13f38659b86f754
TREES=(
  follow_point
  nav_to_pose_with_consistent_replanning_and_if_path_becomes_invalid
  navigate_through_poses_w_replanning_and_recovery
  navigate_to_pose_w_replanning_and_recovery
  navigate_to_pose_w_replanning_goal_patience_and_recovery
  navigate_w_recovery_and_replanning_only_if_path_becomes_invalid
  navigate_w_replanning_distance
  navigate_w_replanning_only_if_goal_is_updated
  navigate_w_replanning_only_if_path_becomes_invalid
  navigate_w_replanning_speed
  navigate_w_replanning_time
  odometry_calibration
)

fetch() {
  [ -s "$2" ] || curl -fsSL --create-dirs -o "$2" "$1"
}

echo "Fetching the Nav2 corpus…"
for distro in humble jazzy; do
  sha=$([ "$distro" = humble ] && echo "$NAV2_HUMBLE" || echo "$NAV2_JAZZY")
  base="https://raw.githubusercontent.com/ros-navigation/navigation2/$sha"
  fetch "$base/nav2_behavior_tree/nav2_tree_nodes.xml" "$CACHE/nav2-$distro/nav2_tree_nodes.xml"
  for tree in "${TREES[@]}"; do
    fetch "$base/nav2_bt_navigator/behavior_trees/$tree.xml" "$CACHE/nav2-$distro/trees/$tree.xml"
  done
done
# Not included: nav2_docking's application_example.xml, which BT.CPP v4 itself
# rejects (a lowercase <inverter> and no BTCPP_format), so it can't be a control.

echo "Exporting with the editor…"
rm -rf "$OUT"
(cd "$EDITOR" && BTCPP_CORPUS="$CACHE" BTCPP_OUT="$OUT" npx vitest run --config scripts/btcpp-check/vitest.config.ts --reporter=dot --silent=false)

status=0
for distro in jazzy humble; do
  if [ "$distro" = jazzy ]; then version=4; package=behaviortree-cpp; v3=OFF; else version=3; package=behaviortree-cpp-v3; v3=ON; fi
  echo "Building the BT.CPP v$version checker (ROS 2 $distro)…"
  docker build -q -t "btcpp-check:$distro" \
    --build-arg DISTRO="$distro" --build-arg BT_PACKAGE="$package" --build-arg BTCPP_V3="$v3" "$HERE" >/dev/null

  run() { docker run --rm -v "$CACHE:/corpus:ro" -v "$OUT:/out:ro" -v "$HERE:/fixes:ro" "btcpp-check:$distro" "$@" || status=1; }
  models=(--models "/corpus/nav2-$distro/nav2_tree_nodes.xml")
  # Nav2's model is incomplete in places; corrections load first (first ID wins)
  [ -f "$HERE/nav2-$distro-overrides.xml" ] && models=(--models "/fixes/nav2-$distro-overrides.xml" "${models[@]}")
  run --label "Nav2 $distro originals (control)" "${models[@]}" "/corpus/nav2-$distro/trees"
  run --label "Nav2 $distro exported as v$version" "${models[@]}" "/out/v$version/nav2"
  run --label "behavior3 examples exported as v$version" "/out/v$version/examples"
done

exit $status
