

# Enhanced Scheduling Algorithm with Status-Based Priority

## Summary

This plan completely restructures the scheduling algorithm to enforce a strict workflow: process projects by installation urgency, schedule all TODO tasks first (as early as possible), then schedule HOLD tasks in task number order after their limit phases complete.

## Technical Analysis

### Current Implementation Issues

1. **Mixed TODO/HOLD Processing**: Currently tasks are scheduled based on generic scoring without distinguishing TODO from HOLD status
2. **Limit Task Checking Only on HOLD**: The `canScheduleWithLimits` function checks limit phases but doesn't enforce TODO-before-HOLD ordering
3. **No Task Number Priority**: HOLD tasks aren't strictly ordered by task_number (1-44)
4. **Single-Pass Urgency**: Projects are sorted by urgency, but tasks within projects aren't processed in the correct status-then-number sequence

### Required Algorithm Structure

```text
FOR each project (sorted by installation_date ASC):
  
  STEP 1: Schedule all TODO tasks
    - Sort by task_number
    - Place as early as possible in timeline
    - Respect employee eligibility and workstation capacity
  
  STEP 2: Schedule all HOLD tasks
    - Sort by task_number (1 = highest priority)
    - FOR each HOLD task:
      - Find all limit phases for this task
      - Find the latest scheduled task from limit phases (in this project)
      - Position immediately after that limit task
      - Lock position and continue
  
  Repeat for next project
```

---

## Part 1: Data Preparation Enhancements

### 1.1 Separate Tasks by Status

```typescript
// Split tasks by status for each project
for (const { project, tasks: projectTasks } of sortedProjects) {
  const todoTasks = projectTasks
    .filter(t => t.status === 'TODO')
    .sort((a, b) => getTaskOrder(a.standard_task_id) - getTaskOrder(b.standard_task_id));
  
  const holdTasks = projectTasks
    .filter(t => t.status === 'HOLD')
    .sort((a, b) => getTaskOrder(a.standard_task_id) - getTaskOrder(b.standard_task_id));
}
```

### 1.2 Build Limit Phase Lookup

```typescript
// Pre-compute: For each task, which limit tasks must complete first?
const limitTaskMap = new Map<string, string[]>();
limitPhases.forEach(lp => {
  const limits = limitTaskMap.get(lp.standard_task_id) || [];
  limits.push(lp.limit_standard_task_id);
  limitTaskMap.set(lp.standard_task_id, limits);
});
```

---

## Part 2: New Scheduling Algorithm

### 2.1 Main Loop Structure

The new algorithm in `handleGeneratePlanning()`:

```typescript
// PHASE 1: Schedule by project urgency with status separation
for (const { project, tasks: projectTasks } of sortedProjects) {
  console.log(`Project: ${project.name} (install: ${project.installation_date})`);
  
  // Separate by status
  const todoTasks = projectTasks
    .filter(t => t.status === 'TODO')
    .sort((a, b) => taskOrderMap.get(a.standard_task_id!) - taskOrderMap.get(b.standard_task_id!));
  
  const holdTasks = projectTasks
    .filter(t => t.status === 'HOLD')
    .sort((a, b) => taskOrderMap.get(a.standard_task_id!) - taskOrderMap.get(b.standard_task_id!));
  
  // STEP A: Schedule all TODO tasks first (as early as possible)
  for (const task of todoTasks) {
    if (!tryAssignEarliestSlot(task, timelineStart)) {
      unassignedTasks.push(task);
    }
  }
  
  // STEP B: Schedule HOLD tasks after their limit phases
  for (const task of holdTasks) {
    const minStart = getMinStartFromLimitPhases(task, project.id);
    if (minStart === null) {
      unassignedTasks.push(task); // Limit tasks not yet scheduled
      continue;
    }
    if (!tryAssignEarliestSlot(task, minStart)) {
      unassignedTasks.push(task);
    }
  }
}
```

### 2.2 New Helper: Find Minimum Start from Limit Phases

```typescript
const getMinStartFromLimitPhases = (
  task: ScheduleTask,
  projectId: string
): Date | null => {
  const limitStdIds = limitTaskMap.get(task.standard_task_id) || [];
  
  // No limit phases = can start immediately
  if (limitStdIds.length === 0) {
    return timelineStart;
  }
  
  let maxEndTime = timelineStart;
  
  for (const limitStdId of limitStdIds) {
    // Find the corresponding task in THIS project
    const limitTask = allProjectTasks.find(
      t => t.standard_task_id === limitStdId && t.project?.id === projectId
    );
    
    // If limit task doesn't exist in project, it doesn't block
    if (!limitTask) continue;
    
    // Get scheduled end time
    const endTime = taskEndTimes.get(limitTask.id);
    
    if (!endTime) {
      // Limit task exists but not yet scheduled
      // This HOLD task cannot be scheduled in this pass
      return null;
    }
    
    // Track the latest end time
    if (endTime > maxEndTime) {
      maxEndTime = endTime;
    }
  }
  
  return maxEndTime;
};
```

### 2.3 Modified `tryAssignEarliestSlot`

```typescript
const tryAssignEarliestSlot = (task: ScheduleTask, minStart: Date): boolean => {
  if (!task.standard_task_id) return false;
  
  // Find eligible employees
  const eligible = employees.filter(e => 
    e.standardTasks.includes(task.standard_task_id!)
  );
  if (eligible.length === 0) return false;
  
  // Get task workstations
  const taskWsIds = task.workstations?.map(w => w.id) || [];
  if (taskWsIds.length === 0) return false;
  
  // Score employees by workload (least loaded first)
  const scored = eligible.map(emp => {
    const slots = employeeSchedule.get(emp.id) || [];
    const workload = slots.reduce((sum, s) => 
      sum + differenceInMinutes(s.end, s.start), 0
    );
    return { emp, workload };
  }).sort((a, b) => a.workload - b.workload);
  
  // Try each employee, find slot AFTER minStart
  for (const { emp } of scored) {
    for (const wsId of taskWsIds) {
      const slot = findSlot(emp.id, task.duration, wsId, minStart);
      if (slot) {
        scheduleTask(task, emp.id, emp.name, wsId, slot.start, slot.end, slot.dateStr);
        return true;
      }
    }
  }
  
  return false;
};
```

---

## Part 3: Iterative Resolution for Pending HOLD Tasks

After the first pass, some HOLD tasks may be pending because their limit tasks weren't scheduled yet.

```typescript
// PHASE 2: Retry pending HOLD tasks
let iterations = 0;
const MAX_ITERATIONS = 100;

while (unassignedTasks.length > 0 && iterations < MAX_ITERATIONS) {
  iterations++;
  let madeProgress = false;
  
  // Sort by project urgency, then task number
  unassignedTasks.sort((a, b) => {
    const dateA = a.project ? new Date(a.project.installation_date).getTime() : Infinity;
    const dateB = b.project ? new Date(b.project.installation_date).getTime() : Infinity;
    if (dateA !== dateB) return dateA - dateB;
    
    return (taskOrderMap.get(a.standard_task_id!) ?? Infinity) - 
           (taskOrderMap.get(b.standard_task_id!) ?? Infinity);
  });
  
  const stillPending: ScheduleTask[] = [];
  
  for (const task of unassignedTasks) {
    if (scheduledTasks.has(task.id)) continue;
    
    // For HOLD tasks, check limit phases
    if (task.status === 'HOLD') {
      const minStart = getMinStartFromLimitPhases(task, task.project?.id);
      if (minStart === null) {
        stillPending.push(task);
        continue;
      }
      if (tryAssignEarliestSlot(task, minStart)) {
        madeProgress = true;
      } else {
        stillPending.push(task);
      }
    } else {
      // TODO task - schedule as early as possible
      if (tryAssignEarliestSlot(task, timelineStart)) {
        madeProgress = true;
      } else {
        stillPending.push(task);
      }
    }
  }
  
  unassignedTasks.length = 0;
  unassignedTasks.push(...stillPending);
  
  if (!madeProgress) break;
}
```

---

## Part 4: Algorithm Flow Diagram

```text
START
  |
  v
[Load all TODO/HOLD tasks]
  |
  v
[Group by project]
  |
  v
[Sort projects by installation_date ASC]
  |
  v
FOR each project:
  |
  +---> [Separate TODO and HOLD tasks]
  |
  +---> [Sort each group by task_number]
  |
  +---> FOR each TODO task:
  |       |
  |       v
  |     [Find earliest slot from timeline start]
  |       |
  |       v
  |     [Schedule if possible, else add to pending]
  |
  +---> FOR each HOLD task:
          |
          v
        [Get limit phases for this standard_task_id]
          |
          v
        [Find corresponding tasks in THIS project]
          |
          v
        [Get MAX(end_time) of all scheduled limit tasks]
          |
          v
        [If any limit task not scheduled: add to pending]
          |
          v
        [Else: find earliest slot AFTER max end time]
          |
          v
        [Schedule if possible]
  |
  v
[PHASE 2: Retry pending tasks in iterative loop]
  |
  v
[Build completion timeline]
  |
  v
[Save to database]
  |
  v
END
```

---

## Part 5: Files to Modify

| File | Changes |
|------|---------|
| `src/components/WorkstationGanttChart.tsx` | Complete rewrite of scheduling algorithm in `handleGeneratePlanning()` |

### Key Algorithm Changes

1. **Task Separation**: Split `projectTasks` into `todoTasks` and `holdTasks` arrays
2. **Status-Based Ordering**: Process all TODO tasks before any HOLD task for each project
3. **Limit Phase Enforcement**: HOLD tasks must wait until ALL their limit phases are scheduled
4. **Minimum Start Time**: HOLD task start >= MAX(limit task end times)
5. **Task Number Priority**: Within TODO and HOLD groups, process by task_number ascending

---

## Part 6: Validation Rules

After scheduling completes, validate:

1. **No overlapping tasks** for any employee
2. **HOLD tasks scheduled after limit phases**: For each HOLD task, verify start >= limit task end
3. **Task number order respected**: Lower task numbers scheduled before higher (within same project and status)
4. **All projects processed**: Every project with TODO/HOLD tasks has been attempted

---

## Part 7: Edge Cases

| Scenario | Handling |
|----------|----------|
| Limit task not in project | Does not block - skip that limit |
| Limit task excluded from project | Check `wasStandardTaskExcludedFromProject()` - if excluded, doesn't block |
| Circular dependencies | Max iteration limit (100) prevents infinite loop |
| No eligible employee | Task added to unassigned list with warning |
| Insufficient capacity | Final warning shows which projects can't meet deadlines |

---

## Implementation Summary

The new algorithm enforces:

1. Projects processed by **installation urgency** (earliest first)
2. **TODO tasks scheduled first** - as early as possible in the timeline
3. **HOLD tasks scheduled after** - positioned immediately after their limit phases complete
4. **Task number priority** - lower numbers (1) scheduled before higher (44)
5. **Strict limit phase enforcement** - HOLD tasks cannot start before ALL limit phases are done
6. **Complete scheduling** - all tasks must be scheduled; unschedulable tasks generate warnings

