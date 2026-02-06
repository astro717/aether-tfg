// Simple event system for task-related updates
// This allows components to communicate task changes without prop drilling

const TASK_CREATED_EVENT = "aether:task-created";
const TASK_UPDATED_EVENT = "aether:task-updated";

export const taskEvents = {
  // Emit when a task is created
  emitTaskCreated: () => {
    window.dispatchEvent(new CustomEvent(TASK_CREATED_EVENT));
  },

  // Emit when a task is updated
  emitTaskUpdated: () => {
    window.dispatchEvent(new CustomEvent(TASK_UPDATED_EVENT));
  },

  // Subscribe to task created events
  onTaskCreated: (callback: () => void) => {
    window.addEventListener(TASK_CREATED_EVENT, callback);
    return () => window.removeEventListener(TASK_CREATED_EVENT, callback);
  },

  // Subscribe to task updated events
  onTaskUpdated: (callback: () => void) => {
    window.addEventListener(TASK_UPDATED_EVENT, callback);
    return () => window.removeEventListener(TASK_UPDATED_EVENT, callback);
  },

  // Subscribe to any task change
  onTaskChange: (callback: () => void) => {
    window.addEventListener(TASK_CREATED_EVENT, callback);
    window.addEventListener(TASK_UPDATED_EVENT, callback);
    return () => {
      window.removeEventListener(TASK_CREATED_EVENT, callback);
      window.removeEventListener(TASK_UPDATED_EVENT, callback);
    };
  },
};
