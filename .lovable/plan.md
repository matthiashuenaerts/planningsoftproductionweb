
# Enhanced Planning Algorithm with Limit Task Enforcement

## Summary

This plan enhances the scheduling algorithm to strictly enforce limit task dependencies, prioritize projects by installation urgency, and persist the Production Completion Timeline to the database for consistent display alongside the Gantt chart.

## Technical Overview

### Current State

1. **Scheduling Algorithm**: Currently schedules tasks based on a priority score but does NOT check if limit tasks (prerequisites) are completed before scheduling dependent tasks
2. **Production Completion Timeline**: Lives only in React state, passed via `onPlanningGenerated` callback - not persisted
3. **Limit Phases**: Stored in `standard_task_limit_phases` table linking `standard_task_id` to `limit_standard_task_id`

### Core Changes Required

---

## Part 1: Database Schema for Timeline Persistence

A new table will store the Production Completion Timeline data:

```sql
CREATE TABLE project_production_completion (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  client TEXT,
  installation_date TIMESTAMPTZ NOT NULL,
  last_production_step_end TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('on_track', 'at_risk', 'overdue', 'pending')),
  days_remaining INTEGER NOT NULL,
  last_production_step_name TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## Part 2: Enhanced Scheduling Algorithm

### 2.1 Limit Task Dependency Checking

The core scheduling changes in `WorkstationGanttChart.tsx`:

**New Helper Functions:**

1. `getLimitTasksForProject(projectId, standardTaskId)` - Returns all limit tasks that must be completed for a specific task in a project
2. `areAllLimitTasksCompleted(projectId, standardTaskId)` - Returns true only if ALL prerequisite tasks for this project are scheduled AND completed before the candidate slot
3. `getMinimumStartTime(projectId, standardTaskId)` - Returns the earliest possible start time based on when all limit tasks finish

**Algorithm Flow:**

```text
FOR each project (sorted by installation_date ASC - most urgent first):
  FOR each task in project (sorted by task_number 1-44):
    
    1. Get limit tasks for this task's standard_task_id
    2. For each limit task:
       - Find the corresponding task for THIS project
       - Check if it's already scheduled
       - Get its end time
    
    3. If ANY limit task is not scheduled:
       - SKIP this task (cannot schedule yet)
       - Add to "pending" queue for retry
    
    4. Calculate minimum start time = MAX(all limit task end times)
    
    5. Find earliest slot for employee AFTER minimum start time
    
    6. Schedule the task
```

### 2.2 Project Urgency Prioritization

**New Scoring Logic:**

```typescript
// Projects sorted by installation urgency (ascending - soonest first)
const projectsByUrgency = [...projects].sort((a, b) => 
  new Date(a.installation_date).getTime() - new Date(b.installation_date).getTime()
);

// Process one project at a time, completing all its tasks before moving to next
for (const project of projectsByUrgency) {
  const projectTasks = tasks.filter(t => t.project?.id === project.id);
  const sortedByTaskNumber = projectTasks.sort((a, b) => 
    getTaskOrder(a.standard_task_id) - getTaskOrder(b.standard_task_id)
  );
  
  // Schedule each task sequentially with limit checking
  for (const task of sortedByTaskNumber) {
    scheduleWithLimitCheck(task);
  }
}
```

### 2.3 Iterative Scheduling with Dependency Resolution

Since limit tasks may not be scheduled immediately, the algorithm will run multiple passes:

```text
REPEAT until no progress:
  unscheduledBefore = unscheduledTasks.length
  
  FOR each project (by urgency):
    FOR each unscheduled task:
      IF canSchedule(task) based on limit tasks:
        schedule(task)
        remove from unscheduled
  
  unscheduledAfter = unscheduledTasks.length
  IF unscheduledBefore == unscheduledAfter:
    BREAK (no more progress possible)
```

---

## Part 3: Service Layer for Timeline Persistence

### New Service: `projectCompletionService.ts`

```typescript
export const projectCompletionService = {
  // Save completion data after planning generation
  async saveCompletionData(data: ProjectCompletionData[]): Promise<void>;
  
  // Get latest completion data for display
  async getCompletionData(): Promise<ProjectCompletionData[]>;
  
  // Clear old completion data
  async clearCompletionData(): Promise<void>;
  
  // Subscribe to real-time updates
  subscribeToCompletionData(callback): RealtimeChannel;
}
```

---

## Part 4: UI Integration

### 4.1 Button Loading State

In `WorkstationGanttChart.tsx`, the "Genereer Planning" button will show a loading spinner:

```tsx
<Button 
  onClick={handleGeneratePlanning} 
  disabled={generatingPlanning}
>
  {generatingPlanning ? (
    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Berekenen...</>
  ) : (
    <><Wand2 className="h-4 w-4 mr-2" /> Genereer Planning</>
  )}
</Button>
```

### 4.2 Timeline Display

The `ProductionCompletionTimeline` component will:
1. Load initial data from the database on mount
2. Update when new planning is generated
3. Subscribe to real-time changes
4. Display consistently like the Gantt chart (persisted, not just in-memory)

### 4.3 Resolver Integration

When resolving deadlines (reschedule functions), the timeline will be recalculated:
- After `handleRescheduleForDeadlines()`
- After `handleRescheduleProject(projectId)`
- Save updated completion data to database

---

## Part 5: Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/[timestamp]_project_production_completion.sql` | Create persistence table |
| `src/services/projectCompletionService.ts` | CRUD operations for completion data |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/WorkstationGanttChart.tsx` | Enhanced algorithm with limit task checking, urgency-based scheduling, loading states, save to DB |
| `src/components/planning/ProductionCompletionTimeline.tsx` | Load from DB, real-time subscription |
| `src/pages/Planning.tsx` | Use persisted timeline data |

---

## Part 6: Algorithm Pseudocode

```text
FUNCTION generateOptimalPlanning():
  
  // SETUP
  projects = getActiveProjects().sortBy(installation_date ASC)
  limitMap = buildLimitTaskMap() // standard_task_id -> [limit_standard_task_ids]
  taskOrder = buildTaskOrderMap() // standard_task_id -> numeric order (1-44)
  lastProductionStep = getLastProductionStep()
  
  scheduledTasks = new Set()
  taskEndTimes = new Map() // taskId -> endDate
  unscheduledTasks = []
  
  // PHASE 1: Schedule by project urgency with limit checking
  FOR project IN projects:
    projectTasks = getAllTasksForProject(project.id)
                   .filter(isProductionTask) // up to last production step
                   .sortBy(taskOrder)
    
    FOR task IN projectTasks:
      // Get limit tasks for this standard_task_id
      limitStdIds = limitMap.get(task.standard_task_id) || []
      
      // Find corresponding tasks in THIS project
      minStartTime = timelineStart
      allLimitsScheduled = true
      
      FOR limitStdId IN limitStdIds:
        limitTask = projectTasks.find(t => t.standard_task_id == limitStdId)
        IF limitTask AND scheduledTasks.has(limitTask.id):
          limitEndTime = taskEndTimes.get(limitTask.id)
          minStartTime = MAX(minStartTime, limitEndTime)
        ELSE:
          allLimitsScheduled = false
      
      IF NOT allLimitsScheduled:
        unscheduledTasks.push(task)
        CONTINUE
      
      // Try to schedule
      slot = findSlotAfter(task, minStartTime)
      IF slot:
        scheduleTask(task, slot)
        scheduledTasks.add(task.id)
        taskEndTimes.set(task.id, slot.end)
      ELSE:
        unscheduledTasks.push(task)
  
  // PHASE 2: Retry unscheduled tasks (dependencies may now be met)
  iterations = 0
  WHILE unscheduledTasks.length > 0 AND iterations < 100:
    iterations++
    madeProgress = false
    
    FOR task IN [...unscheduledTasks]:
      IF canScheduleWithLimits(task):
        slot = findSlotAfter(task, getMinStart(task))
        IF slot:
          scheduleTask(task, slot)
          remove task from unscheduledTasks
          madeProgress = true
    
    IF NOT madeProgress:
      BREAK
  
  // PHASE 3: Calculate completion timeline
  completionData = []
  FOR project IN projects:
    lastEnd = getLastProductionTaskEnd(project.id)
    status = calculateStatus(lastEnd, project.installation_date)
    completionData.push({
      projectId: project.id,
      projectName: project.name,
      installationDate: project.installation_date,
      lastProductionStepEnd: lastEnd,
      status: status,
      daysRemaining: daysBetween(now, project.installation_date)
    })
  
  // PHASE 4: Save to database
  saveCompletionData(completionData)
  saveSchedulesToGantt(taskAssignments)
  
  RETURN completionData
```

---

## Validation Criteria

1. **Limit Task Enforcement**: A task cannot be scheduled before ALL its limit tasks are completed
2. **Timeline Constraint**: Task start time >= MAX(limit task end times)
3. **Urgency Priority**: Most urgent projects (earliest installation date) are scheduled first
4. **Sequential Completion**: Each project's tasks are scheduled in order (1 to 44)
5. **Persistence**: Timeline data survives page refresh and is visible like Gantt chart
6. **Real-time Updates**: Timeline updates when planning changes
7. **Loading Feedback**: Button shows spinner during calculation

---

## Risk Mitigation

- **Infinite Loop Prevention**: Maximum 100 iterations for dependency resolution
- **Unschedulable Tasks**: Clear feedback for tasks that cannot be scheduled due to capacity
- **Performance**: Task order map and limit map built once at start, not per-task
- **Data Integrity**: Foreign key constraint on project_id with CASCADE delete
