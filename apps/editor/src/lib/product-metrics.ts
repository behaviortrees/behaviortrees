import type { Project } from '../types';
import {
  track,
  type ProjectOrigin,
} from './analytics';

const ORIGIN_PREFIX = 'bt-analytics-origin-';
const SUBSTANTIAL_PREFIX = 'bt-analytics-substantial-';
const ACTIVATED_PREFIX = 'bt-analytics-activated-';

export const SUBSTANTIAL_NODE_COUNT = 5;
export const SUBSTANTIAL_CONNECTION_COUNT = 4;

export type ProjectMetrics = {
  project_id: string;
  node_count: number;
  connection_count: number;
  tree_count: number;
  custom_node_count: number;
  origin: ProjectOrigin;
};

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Analytics must not affect editor behavior.
  }
}

export function setProjectOrigin(projectId: string, origin: ProjectOrigin): void {
  writeStorage(`${ORIGIN_PREFIX}${projectId}`, origin);
}

export function getProjectOrigin(projectId: string): ProjectOrigin {
  const stored = readStorage(`${ORIGIN_PREFIX}${projectId}`);
  if (
    stored === 'new' ||
    stored === 'import' ||
    stored === 'example' ||
    stored === 'guide_example' ||
    stored === 'shared_link' ||
    stored === 'restored'
  ) {
    return stored;
  }
  return projectId === 'examples' ? 'example' : 'unknown';
}

export function measureProject(project: Project): ProjectMetrics {
  const trees = Object.values(project.trees);
  const nodeCount = trees.reduce(
    (total, tree) =>
      total + Object.values(tree.blocks).filter((block) => block.category !== 'root').length,
    0
  );
  const connectionCount = trees.reduce(
    (total, tree) => total + Object.keys(tree.connections).length,
    0
  );
  const customNodeCount = Object.values(project.nodes).filter((node) => !node.isDefault).length;

  return {
    project_id: project.id,
    node_count: nodeCount,
    connection_count: connectionCount,
    tree_count: trees.length,
    custom_node_count: customNodeCount,
    origin: getProjectOrigin(project.id),
  };
}

export function isSubstantialProject(project: Project): boolean {
  const metrics = measureProject(project);
  return (
    metrics.node_count >= SUBSTANTIAL_NODE_COUNT &&
    metrics.connection_count >= SUBSTANTIAL_CONNECTION_COUNT
  );
}

export function recordSubstantialProject(project: Project): boolean {
  if (!isSubstantialProject(project)) return false;
  const key = `${SUBSTANTIAL_PREFIX}${project.id}`;
  if (readStorage(key) === '1') return false;

  writeStorage(key, '1');
  track('project_became_substantial', measureProject(project));
  return true;
}

export function recordActivation(project: Project, trigger: 'save' | 'export'): boolean {
  if (!isSubstantialProject(project)) return false;

  recordSubstantialProject(project);
  const key = `${ACTIVATED_PREFIX}${project.id}`;
  if (readStorage(key) === '1') return false;

  writeStorage(key, '1');
  track('activation_completed', { ...measureProject(project), trigger });
  return true;
}

export function hasActivatedProject(): boolean {
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (
        key?.startsWith(ACTIVATED_PREFIX) &&
        localStorage.getItem(key) === '1'
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}
