import { Node, NodeCategory, NodePort, PortDirection } from '../../types';

// What BehaviorTree.CPP knows without a TreeNodesModel: its builtin nodes
// (registered in BehaviorTreeFactory's constructor, src/bt_factory.cpp) with
// the ports each declares in providedPorts(), for v4 (master) and v3.8. Port
// names, types and defaults are copied from those headers.

export type BtcppVersion = 3 | 4;

export type BtcppModel = {
  category: NodeCategory;
  ports: Record<string, NodePort>;
  versions: BtcppVersion[];
};

const port = (direction: PortDirection, type?: string, defaultValue?: string): NodePort => ({
  direction,
  ...(type ? { type } : {}),
  ...(defaultValue !== undefined ? { default: defaultValue } : {}),
});
const input = (type?: string, defaultValue?: string) => port('input', type, defaultValue);

const BOTH: BtcppVersion[] = [3, 4];
const V4: BtcppVersion[] = [4];
const V3: BtcppVersion[] = [3];

const model = (category: NodeCategory, versions: BtcppVersion[], ports: Record<string, NodePort> = {}): BtcppModel => ({
  category,
  versions,
  ports,
});

const switchPorts = (cases: number): Record<string, NodePort> => {
  const ports: Record<string, NodePort> = { variable: input('std::string') };
  for (let i = 1; i <= cases; i++) ports[`case_${i}`] = input('std::string');
  return ports;
};

const loopPorts = (type: string): Record<string, NodePort> => ({
  queue: port('inout'),
  if_empty: input('NodeStatus', 'SUCCESS'),
  value: port('output', type),
});

const blackboardCheckPorts = {
  value_A: input(),
  value_B: input(),
  return_on_mismatch: input('NodeStatus'),
};

// Keyed by v4 name; v3 spellings are mapped through V3_TO_V4_NAMES
export const BTCPP_BUILTINS: Record<string, BtcppModel> = {
  // Controls
  Fallback: model('composite', BOTH),
  AsyncFallback: model('composite', V4),
  Sequence: model('composite', BOTH),
  AsyncSequence: model('composite', V4),
  SequenceWithMemory: model('composite', BOTH),
  Parallel: model('composite', BOTH, {
    success_count: input('int', '-1'),
    failure_count: input('int', '1'),
  }),
  ParallelAll: model('composite', V4, { max_failures: input('int', '1') }),
  ReactiveSequence: model('composite', BOTH),
  ReactiveFallback: model('composite', BOTH),
  IfThenElse: model('composite', BOTH),
  WhileDoElse: model('composite', BOTH),
  TryCatch: model('composite', V4, { catch_on_halt: input('bool', 'false') }),
  Switch2: model('composite', BOTH, switchPorts(2)),
  Switch3: model('composite', BOTH, switchPorts(3)),
  Switch4: model('composite', BOTH, switchPorts(4)),
  Switch5: model('composite', BOTH, switchPorts(5)),
  Switch6: model('composite', BOTH, switchPorts(6)),
  ManualSelector: model('composite', V3, { repeat_last_selection: input('bool', 'false') }),

  // Decorators
  Inverter: model('decorator', BOTH),
  RetryUntilSuccessful: model('decorator', BOTH, { num_attempts: input('int') }),
  KeepRunningUntilFailure: model('decorator', BOTH),
  Repeat: model('decorator', BOTH, { num_cycles: input('int') }),
  Timeout: model('decorator', BOTH, { msec: input('unsigned') }),
  Delay: model('decorator', BOTH, { delay_msec: input('unsigned') }),
  RunOnce: model('decorator', V4, { then_skip: input('bool', 'true') }),
  ForceSuccess: model('decorator', BOTH),
  ForceFailure: model('decorator', BOTH),
  Precondition: model('decorator', V4, { if: input('std::string'), else: input('NodeStatus', 'FAILURE') }),
  SkipUnlessUpdated: model('decorator', V4, { entry: input() }),
  WaitValueUpdate: model('decorator', V4, { entry: input() }),
  LoopInt: model('decorator', V4, loopPorts('int')),
  LoopBool: model('decorator', V4, loopPorts('bool')),
  LoopDouble: model('decorator', V4, loopPorts('double')),
  LoopString: model('decorator', V4, loopPorts('std::string')),
  BlackboardCheckInt: model('decorator', V3, blackboardCheckPorts),
  BlackboardCheckDouble: model('decorator', V3, blackboardCheckPorts),
  BlackboardCheckString: model('decorator', V3, blackboardCheckPorts),
  BlackboardCheckBool: model('decorator', V3, blackboardCheckPorts),

  // Leaves
  AlwaysSuccess: model('action', BOTH),
  AlwaysFailure: model('action', BOTH),
  Script: model('action', V4, { code: input('std::string') }),
  ScriptCondition: model('condition', V4, { code: input('std::string') }),
  SetBlackboard: model('action', BOTH, { value: input(), output_key: port('inout') }),
  Sleep: model('action', V4, { msec: input('unsigned') }),
  UnsetBlackboard: model('action', V4, { key: input('std::string') }),
  WasEntryUpdated: model('action', V4, { entry: input() }),

  // A reference to another BehaviorTree in the file, by its ID. Kept as a
  // leaf here: the referenced tree is a separate tree in the project.
  SubTree: model('action', BOTH),
};

// v3 names read on import. v3.8 registers both Retry spellings, so exports
// always use the correct one.
export const V3_TO_V4_NAMES: Record<string, string> = {
  SequenceStar: 'SequenceWithMemory',
  RetryUntilSuccesful: 'RetryUntilSuccessful',
  SubTreePlus: 'SubTree',
};

export const V4_TO_V3_NAMES: Record<string, string> = {
  SequenceWithMemory: 'SequenceStar',
};

// Ports renamed between v3.8 and v4, per node
export const V3_TO_V4_PORTS: Record<string, Record<string, string>> = {
  Parallel: { success_threshold: 'success_count', failure_threshold: 'failure_count' },
};

// Categories from Nav2's nav2_tree_nodes.xml (Humble + Jazzy), so plain Nav2
// trees, which ship no TreeNodesModel, import with the right node types
const NAV2_BY_CATEGORY: Record<Exclude<NodeCategory, 'root'>, string[]> = {
  composite: ['PipelineSequence', 'RecoveryNode', 'RoundRobin'],
  decorator: [
    'DistanceController', 'GoalUpdatedController', 'GoalUpdater', 'PathLongerOnApproach',
    'RateController', 'SingleTrigger', 'SpeedController',
  ],
  condition: [
    'AreErrorCodesPresent', 'ArePosesNear', 'DistanceTraveled', 'GlobalUpdatedGoal', 'GoalReached',
    'GoalUpdated', 'InitialPoseReceived', 'IsBatteryCharging', 'IsBatteryLow', 'IsPathValid', 'IsStuck',
    'PathExpiringTimer', 'TimeExpired', 'TransformAvailable', 'WouldAControllerRecoveryHelp',
    'WouldAPlannerRecoveryHelp', 'WouldASmootherRecoveryHelp',
  ],
  action: [
    'AssistedTeleop', 'BackUp', 'CancelAssistedTeleop', 'CancelBackUp', 'CancelComputeAndTrackRoute',
    'CancelControl', 'CancelDriveOnHeading', 'CancelSpin', 'CancelWait', 'ClearCostmapAroundPose',
    'ClearCostmapAroundRobot', 'ClearCostmapExceptRegion', 'ClearEntireCostmap', 'ComputeAndTrackRoute',
    'ComputePathThroughPoses', 'ComputePathToPose', 'ComputeRoute', 'ConcatenatePaths', 'ControllerSelector',
    'DockRobot', 'DriveOnHeading', 'FollowPath', 'GetCurrentPose', 'GetPoseFromPath', 'GoalCheckerSelector',
    'NavigateThroughPoses', 'NavigateToPose', 'PlannerSelector', 'ProgressCheckerSelector',
    'ReinitializeGlobalLocalization', 'RemovePassedGoals', 'SmoothPath', 'SmootherSelector', 'Spin',
    'TruncatePath', 'TruncatePathLocal', 'UndockRobot', 'Wait',
  ],
};

export const NAV2_CATEGORIES: Record<string, NodeCategory> = Object.fromEntries(
  Object.entries(NAV2_BY_CATEGORY).flatMap(([category, names]) =>
    names.map((name) => [name, category as NodeCategory])
  )
);

// behavior3 defaults that have a BT.CPP equivalent. `props` renames
// properties to ports; anything not listed here is exported under its own
// name with a warning.
export type B3Translation = {
  name: string;
  v3Name?: string;
  props?: Record<string, string>;
  v4Only?: boolean;
};

export const B3_TO_BTCPP: Record<string, B3Translation> = {
  Priority: { name: 'Fallback' },
  MemSequence: { name: 'SequenceWithMemory', v3Name: 'SequenceStar' },
  MaxTime: { name: 'Timeout', props: { maxTime: 'msec' } },
  Repeater: { name: 'Repeat', props: { maxLoop: 'num_cycles' } },
  RepeatUntilSuccess: { name: 'RetryUntilSuccessful', props: { maxLoop: 'num_attempts' } },
  Succeeder: { name: 'AlwaysSuccess' },
  Failer: { name: 'AlwaysFailure' },
  // Only behavior3's Wait (properties ⊆ {milliseconds}); Nav2 has its own Wait
  Wait: { name: 'Sleep', props: { milliseconds: 'msec' }, v4Only: true },
};

// A palette entry for a builtin, with each port's default as its property
export function catalogNode(name: string): Node | undefined {
  const builtin = BTCPP_BUILTINS[name];
  if (!builtin) return undefined;
  const properties: Record<string, unknown> =
    name === 'SubTree'
      ? { ID: '' }
      : Object.fromEntries(
          Object.entries(builtin.ports)
            .filter(([, p]) => p.direction !== 'output')
            .map(([key, p]) => [key, p.default ?? ''])
        );
  return {
    name,
    title: name,
    category: builtin.category,
    description: '',
    properties,
    ports: { ...builtin.ports },
    isDefault: false,
  };
}
