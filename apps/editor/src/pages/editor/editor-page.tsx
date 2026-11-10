import React, { useEffect, useRef } from 'react';
import BehaviorTreeEditor from '../../components/editor/behavior-tree-editor';
import { useProjectStore } from '../../stores/useProjectStore';

const hasStoredProjects = (): boolean => {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('bt-project-')) return true;
  }
  return false;
};

const EditorPage: React.FC = () => {
  const project = useProjectStore(state => state.project);
  const createProject = useProjectStore(state => state.createProject);
  const initialized = useRef(false);

  // First-ever visit gets a starter project; anyone who closed their
  // project on purpose gets the "No Project Open" screen instead
  useEffect(() => {
    if (project || initialized.current) return;
    initialized.current = true;
    if (!hasStoredProjects()) {
      createProject('Demo Project', 'A demo behavior tree project');
    }
  }, [project, createProject]);

  // BehaviorTreeEditor renders the No Project Open screen when project is null
  return <BehaviorTreeEditor />;
};

export default EditorPage;
