import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Authenticate the caller (user JWT or cron anon key)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await authSupabase.auth.getClaims(token)
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    console.log('🕛 Auto-generate schedule triggered (cron midnight)')

    // Step 1: Count upcoming projects (planned/in_progress with future installation_date)
    const today = new Date().toISOString().split('T')[0]
    
    const { count: projectCount, error: countError } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .in('status', ['planned', 'in_progress'])
      .gte('installation_date', today)

    if (countError) throw countError

    const totalProjects = projectCount || 0
    console.log(`Found ${totalProjects} upcoming projects to schedule`)

    if (totalProjects === 0) {
      return new Response(JSON.stringify({ message: 'No projects to schedule' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 2: Fetch working hours, holidays, employees, tasks, etc.
    // Get working hours
    const { data: workingHoursData } = await supabase
      .from('working_hours')
      .select('*')
      .eq('team', 'production')
      .eq('is_active', true)

    const workingHours = workingHoursData || []

    // Get company holidays
    const { data: holidaysData } = await supabase
      .from('holidays')
      .select('*')
      .eq('team', 'production')

    const holidaySet = new Set((holidaysData || []).map((h: any) => h.date))

    // Get approved employee holiday requests (personal holidays/vacations)
    const { data: holidayRequestsData } = await supabase
      .from('holiday_requests')
      .select('user_id, start_date, end_date')
      .eq('status', 'approved')
      .gte('end_date', today)

    const employeeHolidayRequests = holidayRequestsData || []
    console.log(`Found ${employeeHolidayRequests.length} approved employee holiday requests`)

    // Helper: check if an employee is on personal holiday on a given date
    function isEmployeeOnHoliday(employeeId: string, dateStr: string): boolean {
      return employeeHolidayRequests.some((hr: any) => 
        hr.user_id === employeeId && hr.start_date <= dateStr && hr.end_date >= dateStr
      )
    }

    // Get projects ordered by installation_date
    // Fetch ALL projects (paginated to bypass 1000 limit)
    let projects: any[] = []
    let projectOffset = 0
    const PROJECT_PAGE_SIZE = 1000
    while (true) {
      const { data: batch } = await supabase
        .from('projects')
        .select('id, name, client, installation_date, start_date, status')
        .in('status', ['planned', 'in_progress'])
        .gte('installation_date', today)
        .order('installation_date', { ascending: true })
        .range(projectOffset, projectOffset + PROJECT_PAGE_SIZE - 1)
      
      if (!batch || batch.length === 0) break
      projects.push(...batch)
      if (batch.length < PROJECT_PAGE_SIZE) break
      projectOffset += PROJECT_PAGE_SIZE
    }

    if (projects.length === 0) {
      return new Response(JSON.stringify({ message: 'No projects found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log(`Fetched ${projects.length} projects to schedule`)
    const projectIds = projects.map((p: any) => p.id)

    // Get tasks (paginated per project batch)
    const allTasks: any[] = []
    const BATCH_SIZE = 50
    for (let i = 0; i < projectIds.length; i += BATCH_SIZE) {
      const batchIds = projectIds.slice(i, i + BATCH_SIZE)
      
      // Paginate tasks too
      let taskOffset = 0
      while (true) {
        const { data: tasks } = await supabase
          .from('tasks')
          .select(`
            id, title, duration, status, standard_task_id, phase_id,
            phases!inner (project_id, projects!inner (id, name, installation_date)),
            standard_tasks (task_number, multi_user_task),
            task_workstation_links (workstation_id)
          `)
          .in('status', ['TODO', 'IN_PROGRESS', 'HOLD'])
          .in('phases.project_id', batchIds)
          .range(taskOffset, taskOffset + 999)

        if (tasks) allTasks.push(...tasks)
        if (!tasks || tasks.length < 1000) break
        taskOffset += 1000
      }
    }

    console.log(`Found ${allTasks.length} tasks to schedule`)

    // Get employee eligibility
    const { data: empLinks } = await supabase
      .from('employee_standard_task_links')
      .select('employee_id, standard_task_id, employees (id, name)')

    const employeeMap = new Map<string, { employee_id: string; employee_name: string; standard_task_ids: string[] }>()
    for (const link of empLinks || []) {
      if (!(link as any).employees) continue
      const existing = employeeMap.get(link.employee_id)
      if (existing) {
        existing.standard_task_ids.push(link.standard_task_id)
      } else {
        employeeMap.set(link.employee_id, {
          employee_id: (link as any).employees.id,
          employee_name: (link as any).employees.name,
          standard_task_ids: [link.standard_task_id],
        })
      }
    }
    const employees = Array.from(employeeMap.values())

    // Get limit phases
    const { data: limitPhases } = await supabase
      .from('standard_task_limit_phases')
      .select('standard_task_id, limit_standard_task_id')

    // Get time registrations for affinity
    const { data: timeRegs } = await supabase
      .from('time_registrations')
      .select('task_id, employee_id')
      .not('task_id', 'is', null)
      .order('start_time', { ascending: false })

    const taskAffinityMap = new Map<string, string>()
    for (const reg of timeRegs || []) {
      if (reg.task_id && reg.employee_id && !taskAffinityMap.has(reg.task_id)) {
        taskAffinityMap.set(reg.task_id, reg.employee_id)
      }
    }

    // Build project+workstation affinity
    const projectWsAffinity = new Map<string, string>()
    if (taskAffinityMap.size > 0) {
      const affinityTaskIds = Array.from(taskAffinityMap.keys())
      for (let i = 0; i < affinityTaskIds.length; i += 200) {
        const batch = affinityTaskIds.slice(i, i + 200)
        const { data: affinityTasks } = await supabase
          .from('tasks')
          .select('id, phases!inner(project_id), task_workstation_links(workstation_id)')
          .in('id', batch)

        for (const t of affinityTasks || []) {
          const empId = taskAffinityMap.get(t.id)
          if (!empId) continue
          const projectId = (t as any).phases?.project_id
          const wsIds = ((t as any).task_workstation_links || []).map((l: any) => l.workstation_id).filter(Boolean)
          for (const wsId of wsIds) {
            const key = `${projectId}:${wsId}`
            if (!projectWsAffinity.has(key)) {
              projectWsAffinity.set(key, empId)
            }
          }
        }
      }
    }

    console.log(`Task affinity: ${taskAffinityMap.size}, Project+WS affinity: ${projectWsAffinity.size}`)

    // Load workstation capacity (active_workers = max concurrent employees)
    const { data: workstationsData } = await supabase
      .from('workstations')
      .select('id, active_workers')
    
    const workstationCapacityMap = new Map<string, number>()
    for (const ws of workstationsData || []) {
      workstationCapacityMap.set(ws.id, ws.active_workers || 1)
    }
    console.log(`Loaded capacity for ${workstationCapacityMap.size} workstations`)

    // Load order delivery constraints
    const orderDeliveryConstraints = new Map<string, Date>()
    const { data: constraintOrders } = await supabase
      .from('orders')
      .select('project_id, expected_delivery, task_group_id')
      .not('task_group_id', 'is', null)
      .not('project_id', 'is', null)
      .in('status', ['pending', 'delayed'])

    if (constraintOrders && constraintOrders.length > 0) {
      const groupIds = [...new Set(constraintOrders.map((o: any) => o.task_group_id).filter(Boolean))]
      const { data: groupLinks } = await supabase
        .from('order_task_group_links')
        .select('group_id, standard_task_id')
        .in('group_id', groupIds)

      if (groupLinks && groupLinks.length > 0) {
        const groupTaskMap = new Map<string, string[]>()
        for (const link of groupLinks) {
          const existing = groupTaskMap.get(link.group_id) || []
          existing.push(link.standard_task_id)
          groupTaskMap.set(link.group_id, existing)
        }
        for (const order of constraintOrders) {
          const taskIds = groupTaskMap.get((order as any).task_group_id) || []
          const deliveryDate = new Date((order as any).expected_delivery)
          for (const stId of taskIds) {
            const key = `${(order as any).project_id}:${stId}`
            const existing = orderDeliveryConstraints.get(key)
            if (!existing || deliveryDate > existing) {
              orderDeliveryConstraints.set(key, deliveryDate)
            }
          }
        }
      }
    }
    console.log(`Loaded ${orderDeliveryConstraints.size} order delivery constraints`)

    // Step 3: Build working hours map
    const whMap = new Map<number, any>()
    for (const wh of workingHours) {
      whMap.set(wh.day_of_week, wh)
    }

    // Step 4: Scheduling engine
    const startDate = new Date()
    startDate.setHours(0, 0, 0, 0)

    const employeeTimeBlocks: Array<{ employee_id: string; start: Date; end: Date }> = []
    const workstationTimeBlocks: Array<{ workstation_id: string; employee_id: string; start: Date; end: Date }> = []
    const scheduledTaskEndTimes = new Map<string, Date>()

    function isWorkingDay(date: Date): boolean {
      const day = date.getDay()
      const isWeekend = day === 0 || day === 6
      const dateStr = date.toISOString().split('T')[0]
      return !isWeekend && whMap.has(day) && !holidaySet.has(dateStr)
    }

    function getNextWorkday(date: Date): Date {
      const d = new Date(date)
      d.setDate(d.getDate() + 1)
      let iterations = 0
      while (!isWorkingDay(d) && iterations < 365) {
        d.setDate(d.getDate() + 1)
        iterations++
      }
      return d
    }

    function getWorkHours(date: Date) {
      const wh = whMap.get(date.getDay())
      if (!wh) return null
      const [sh, sm] = wh.start_time.split(':').map(Number)
      const [eh, em] = wh.end_time.split(':').map(Number)
      const s = new Date(date); s.setHours(sh, sm, 0, 0)
      const e = new Date(date); e.setHours(eh, em, 0, 0)
      const breaks = (wh.breaks || []).map((b: any) => {
        const [bsh, bsm] = b.start_time.split(':').map(Number)
        const [beh, bem] = b.end_time.split(':').map(Number)
        const bs = new Date(date); bs.setHours(bsh, bsm, 0, 0)
        const be = new Date(date); be.setHours(beh, bem, 0, 0)
        return { start: bs, end: be }
      }).sort((a: any, b: any) => a.start.getTime() - b.start.getTime())
      return { start: s, end: e, breaks }
    }

    function getTaskSlots(from: Date, duration: number) {
      const res: Array<{ start: Date; end: Date }> = []
      let remaining = duration
      let cur = new Date(from)
      let wh = getWorkHours(cur)
      if (!wh) { cur = getNextWorkday(cur); wh = getWorkHours(cur) }
      if (!wh) return res
      if (cur < wh.start) cur = new Date(wh.start)
      let maxIter = 1000
      while (remaining > 0 && maxIter-- > 0) {
        if (cur >= wh!.end) {
          cur = getNextWorkday(cur); wh = getWorkHours(cur)
          if (!wh) break; cur = new Date(wh.start); continue
        }
        const currentBreak = wh!.breaks.find((b: any) => cur >= b.start && cur < b.end)
        if (currentBreak) { cur = new Date(currentBreak.end); continue }
        const nextBreak = wh!.breaks.find((b: any) => b.start > cur)
        let availableEnd = new Date(wh!.end)
        if (nextBreak && nextBreak.start < wh!.end) availableEnd = new Date(nextBreak.start)
        const availMins = (availableEnd.getTime() - cur.getTime()) / 60000
        if (availMins > 0) {
          const used = Math.min(remaining, availMins)
          const end = new Date(cur.getTime() + used * 60000)
          res.push({ start: new Date(cur), end })
          remaining -= used; cur = end
        } else {
          if (nextBreak) { cur = new Date(nextBreak.end) }
          else { cur = getNextWorkday(cur); wh = getWorkHours(cur); if (!wh) break; cur = new Date(wh.start) }
        }
      }
      return res
    }

    function findAvailableEmployee(
      taskId: string, standardTaskId: string, projectId: string, workstationId: string,
      startTime: Date, endTime: Date
    ) {
      // Determine what dates this slot spans to check employee holidays
      const slotDateStr = startTime.toISOString().split('T')[0]

      // Check task affinity
      const affinityEmpId = taskAffinityMap.get(taskId)
      if (affinityEmpId) {
        const emp = employees.find(e => e.employee_id === affinityEmpId && e.standard_task_ids.includes(standardTaskId))
        if (emp) {
          // Check if employee is on holiday
          if (isEmployeeOnHoliday(emp.employee_id, slotDateStr)) return null
          const conflict = employeeTimeBlocks.some(b => b.employee_id === emp.employee_id && startTime < b.end && endTime > b.start)
          if (!conflict) return emp
          return null // Only this person may do it
        }
      }
      // Check project+ws affinity
      const pwKey = `${projectId}:${workstationId}`
      const pwEmpId = projectWsAffinity.get(pwKey)
      if (pwEmpId) {
        const emp = employees.find(e => e.employee_id === pwEmpId && e.standard_task_ids.includes(standardTaskId))
        if (emp && !isEmployeeOnHoliday(emp.employee_id, slotDateStr)) {
          const conflict = employeeTimeBlocks.some(b => b.employee_id === emp.employee_id && startTime < b.end && endTime > b.start)
          if (!conflict) return emp
        }
      }
      // Normal - filter out employees on holiday
      const eligible = employees.filter(e => 
        e.standard_task_ids.includes(standardTaskId) && 
        !isEmployeeOnHoliday(e.employee_id, slotDateStr)
      )
      for (const emp of eligible) {
        const conflict = employeeTimeBlocks.some(b => b.employee_id === emp.employee_id && startTime < b.end && endTime > b.start)
        if (!conflict) return emp
      }
      return null
    }

    function isWorkstationAtCapacity(wsId: string, empId: string, startTime: Date, endTime: Date): boolean {
      const maxWorkers = workstationCapacityMap.get(wsId) || 1
      const concurrentEmployees = new Set<string>()
      for (const block of workstationTimeBlocks) {
        if (block.workstation_id === wsId && block.start < endTime && block.end > startTime) {
          concurrentEmployees.add(block.employee_id)
        }
      }
      if (concurrentEmployees.has(empId)) return false
      return concurrentEmployees.size >= maxWorkers
    }

    // Map tasks
    const mappedTasks = allTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      duration: t.duration || 60,
      status: t.status,
      standard_task_id: t.standard_task_id,
      phase_id: t.phase_id,
      project_id: t.phases?.projects?.id || '',
      project_name: t.phases?.projects?.name || '',
      installation_date: t.phases?.projects?.installation_date || '',
      task_number: t.standard_tasks?.task_number || '999',
      workstation_ids: (t.task_workstation_links || []).map((l: any) => l.workstation_id).filter(Boolean),
      is_multi_user: t.standard_tasks?.multi_user_task || false,
    }))

    // Group by project
    const tasksByProject = new Map<string, any[]>()
    for (const task of mappedTasks) {
      const existing = tasksByProject.get(task.project_id) || []
      existing.push(task)
      tasksByProject.set(task.project_id, existing)
    }

    const schedules: any[] = []
    const wsEmployeeLaneMap = new Map<string, Map<string, number>>()

    function getEmployeeLaneIndex(wsId: string, empId: string): number {
      if (!wsEmployeeLaneMap.has(wsId)) wsEmployeeLaneMap.set(wsId, new Map())
      const laneMap = wsEmployeeLaneMap.get(wsId)!
      if (!laneMap.has(empId)) laneMap.set(empId, laneMap.size)
      return laneMap.get(empId)!
    }

    // Process projects
    for (const project of projects) {
      const projectTasks = tasksByProject.get(project.id) || []
      if (projectTasks.length === 0) continue
      projectTasks.sort((a: any, b: any) => a.task_number.localeCompare(b.task_number))

      const todoTasks = projectTasks.filter((t: any) => t.status === 'TODO' || t.status === 'IN_PROGRESS')
      const holdTasks = projectTasks.filter((t: any) => t.status === 'HOLD')

      for (const task of [...todoTasks, ...holdTasks]) {
        if (!task.standard_task_id || task.workstation_ids.length === 0) continue
        const wsId = task.workstation_ids[0]

        // For HOLD tasks, check limit phases
        if (task.status === 'HOLD') {
          const taskLimits = (limitPhases || []).filter((lp: any) => lp.standard_task_id === task.standard_task_id)
          let canSchedule = true
          let minStart = new Date(startDate)
          for (const lp of taskLimits) {
            const depTask = projectTasks.find((t: any) => t.standard_task_id === lp.limit_standard_task_id && t.project_id === task.project_id)
            if (depTask) {
              const endTime = scheduledTaskEndTimes.get(depTask.id)
              if (!endTime) { canSchedule = false; break }
              if (endTime > minStart) minStart = endTime
            }
          }
          if (!canSchedule) continue
        }

        // Apply order delivery constraint
        let taskMinStart = new Date(startDate)
        const constraintKey = `${task.project_id}:${task.standard_task_id}`
        const deliveryConstraint = orderDeliveryConstraints.get(constraintKey)
        if (deliveryConstraint && deliveryConstraint > taskMinStart) {
          taskMinStart = deliveryConstraint
        }

        // Check if this is a multi-user task
        if (task.is_multi_user && task.standard_task_id) {
          const eligibleEmps = employees.filter(e => e.standard_task_ids.includes(task.standard_task_id))
          const maxCapacity = workstationCapacityMap.get(wsId) || 1
          const numWorkers = Math.min(eligibleEmps.length, maxCapacity, 4)
          
          if (numWorkers > 1) {
            const perWorkerDuration = Math.ceil(task.duration / numWorkers)
            const assignedEmps: string[] = []
            let overallLatestEnd: Date | null = null
            
            for (let wi = 0; wi < numWorkers; wi++) {
              let workerDate = new Date(taskMinStart)
              let workerFound = false
              let wDaysSearched = 0
              
              while (wDaysSearched < 365 && !workerFound) {
                if (!isWorkingDay(workerDate)) { workerDate = getNextWorkday(workerDate); wDaysSearched++; continue }
                const wwh = getWorkHours(workerDate)
                if (!wwh) { workerDate = getNextWorkday(workerDate); wDaysSearched++; continue }
                
                let wSlotStart = new Date(wwh.start)
                let wAttempts = 100
                while (wSlotStart < wwh.end && wAttempts-- > 0) {
                  const wBrk = wwh.breaks.find((b: any) => wSlotStart >= b.start && wSlotStart < b.end)
                  if (wBrk) { wSlotStart = new Date(wBrk.end); continue }
                  
                  const wTaskSlots = getTaskSlots(wSlotStart, perWorkerDuration)
                  if (wTaskSlots.length === 0) break
                  const wFirstStart = wTaskSlots[0].start
                  const wLastEnd = wTaskSlots[wTaskSlots.length - 1].end
                  const wSlotDateStr = wFirstStart.toISOString().split('T')[0]
                  
                  // Find an eligible employee not yet assigned for this multi-user split, not on holiday
                  const availableEmps = employees.filter(e => 
                    e.standard_task_ids.includes(task.standard_task_id) && 
                    !assignedEmps.includes(e.employee_id) &&
                    !isEmployeeOnHoliday(e.employee_id, wSlotDateStr)
                  )
                  let wEmp = null
                  for (const emp of availableEmps) {
                    const conflict = employeeTimeBlocks.some(b => b.employee_id === emp.employee_id && wFirstStart < b.end && wLastEnd > b.start)
                    if (!conflict && !isWorkstationAtCapacity(wsId, emp.employee_id, wFirstStart, wLastEnd)) {
                      wEmp = emp
                      break
                    }
                  }
                  
                  if (wEmp) {
                    assignedEmps.push(wEmp.employee_id)
                    employeeTimeBlocks.push({ employee_id: wEmp.employee_id, start: wFirstStart, end: wLastEnd })
                    workstationTimeBlocks.push({ workstation_id: wsId, employee_id: wEmp.employee_id, start: wFirstStart, end: wLastEnd })
                    
                    if (!overallLatestEnd || wLastEnd > overallLatestEnd) overallLatestEnd = wLastEnd
                    
                    const wLaneIdx = getEmployeeLaneIndex(wsId, wEmp.employee_id)
                    for (let si = 0; si < wTaskSlots.length; si++) {
                      const slot = wTaskSlots[si]
                      schedules.push({
                        task_id: task.id,
                        workstation_id: wsId,
                        employee_id: wEmp.employee_id,
                        scheduled_date: slot.start.toISOString().split('T')[0],
                        start_time: slot.start.toISOString(),
                        end_time: slot.end.toISOString(),
                        worker_index: wLaneIdx * 100 + si,
                      })
                    }
                    workerFound = true
                    break
                  }
                  wSlotStart = new Date(wSlotStart.getTime() + 15 * 60000)
                }
                if (!workerFound) { workerDate = getNextWorkday(workerDate); wDaysSearched++ }
              }
            }
            
            if (overallLatestEnd) {
              scheduledTaskEndTimes.set(task.id, overallLatestEnd)
            }
            continue // Skip single-user scheduling below
          }
        }

        // Single-user scheduling (default path)
        let currentDate = new Date(taskMinStart)
        let found = false
        let daysSearched = 0

        while (daysSearched < 365 && !found) {
          if (!isWorkingDay(currentDate)) { currentDate = getNextWorkday(currentDate); daysSearched++; continue }
          const wh = getWorkHours(currentDate)
          if (!wh) { currentDate = getNextWorkday(currentDate); daysSearched++; continue }

          let slotStart = new Date(wh.start)
          let attempts = 100
          while (slotStart < wh.end && attempts-- > 0) {
            const brk = wh.breaks.find((b: any) => slotStart >= b.start && slotStart < b.end)
            if (brk) { slotStart = new Date(brk.end); continue }

            const taskSlots = getTaskSlots(slotStart, task.duration)
            if (taskSlots.length === 0) break
            const firstStart = taskSlots[0].start
            const lastEnd = taskSlots[taskSlots.length - 1].end

            const emp = findAvailableEmployee(task.id, task.standard_task_id, task.project_id, wsId, firstStart, lastEnd)
            if (emp && !isWorkstationAtCapacity(wsId, emp.employee_id, firstStart, lastEnd)) {
              employeeTimeBlocks.push({ employee_id: emp.employee_id, start: firstStart, end: lastEnd })
              workstationTimeBlocks.push({ workstation_id: wsId, employee_id: emp.employee_id, start: firstStart, end: lastEnd })
              scheduledTaskEndTimes.set(task.id, lastEnd)
              const laneIdx = getEmployeeLaneIndex(wsId, emp.employee_id)

              for (let si = 0; si < taskSlots.length; si++) {
                const slot = taskSlots[si]
                schedules.push({
                  task_id: task.id,
                  workstation_id: wsId,
                  employee_id: emp.employee_id,
                  scheduled_date: slot.start.toISOString().split('T')[0],
                  start_time: slot.start.toISOString(),
                  end_time: slot.end.toISOString(),
                  worker_index: laneIdx * 100 + si,
                })
              }
              found = true
              break
            }
            slotStart = new Date(slotStart.getTime() + 15 * 60000)
          }
          if (!found) { currentDate = getNextWorkday(currentDate); daysSearched++ }
        }
      }
    }

    console.log(`Generated ${schedules.length} gantt schedule entries`)

    // Step 5: Save to gantt_schedules (clear + insert)
    await supabase.from('gantt_schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000')

    for (let i = 0; i < schedules.length; i += 100) {
      const batch = schedules.slice(i, i + 100)
      const { error: insertErr } = await supabase.from('gantt_schedules').insert(batch)
      if (insertErr) console.error('Error inserting gantt batch:', insertErr)
    }

    // Step 6: Sync to personal planning (schedules + workstation_schedules) — "Generate from Gantt" method
    // Read 7-day window from gantt_schedules
    const endDate = new Date(startDate)
    endDate.setDate(endDate.getDate() + 7)
    const startStr = startDate.toISOString().split('T')[0]
    const endStr = endDate.toISOString().split('T')[0]

    // Paginate gantt_schedules read
    let ganttSchedules: any[] = []
    let gsOffset = 0
    while (true) {
      const { data: gsBatch } = await supabase
        .from('gantt_schedules')
        .select('*, tasks (id, title, description), employees (id, name), workstations (id, name)')
        .gte('scheduled_date', startStr)
        .lt('scheduled_date', endStr)
        .order('scheduled_date')
        .order('start_time')
        .range(gsOffset, gsOffset + 999)
      
      if (gsBatch) ganttSchedules.push(...gsBatch)
      if (!gsBatch || gsBatch.length < 1000) break
      gsOffset += 1000
    }

    console.log(`Read ${ganttSchedules.length} gantt schedules for sync to personal tasks`)

    // Clear existing schedules
    await supabase.from('schedules').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    await supabase.from('workstation_schedules').delete()
      .gte('start_time', startDate.toISOString())
      .lt('start_time', endDate.toISOString())

    const scheduleInserts: any[] = []
    const wsScheduleInserts: any[] = []

    for (const gs of ganttSchedules) {
      if (!gs.employee_id || !gs.tasks) continue
      scheduleInserts.push({
        employee_id: gs.employee_id,
        task_id: gs.task_id,
        title: gs.tasks.title || 'Unknown Task',
        description: gs.tasks.description || '',
        start_time: gs.start_time,
        end_time: gs.end_time,
        is_auto_generated: true,
      })
      if (gs.workstation_id) {
        wsScheduleInserts.push({
          workstation_id: gs.workstation_id,
          task_id: gs.task_id,
          task_title: gs.tasks.title || 'Unknown Task',
          user_name: gs.employees?.name || 'Unknown',
          start_time: gs.start_time,
          end_time: gs.end_time,
        })
      }
    }

    // Also add recurring tasks
    const { data: recurringSchedules } = await supabase
      .from('recurring_task_schedules')
      .select('*')
      .eq('is_active', true)

    if (recurringSchedules && recurringSchedules.length > 0) {
      const stdTaskIds = [...new Set(recurringSchedules.map((r: any) => r.standard_task_id))]
      const { data: stdTasks } = await supabase.from('standard_tasks').select('id, task_name').in('id', stdTaskIds)
      const stdTaskMap = new Map((stdTasks || []).map((t: any) => [t.id, t]))

      const allEmpIds = [...new Set(recurringSchedules.flatMap((r: any) => r.employee_ids))]
      const { data: empData } = await supabase.from('employees').select('id, name').in('id', allEmpIds)
      const empNameMap = new Map((empData || []).map((e: any) => [e.id, e.name]))

      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const currentDate = new Date(startDate)
        currentDate.setDate(currentDate.getDate() + dayOffset)
        const dayOfWeek = currentDate.getDay()

        for (const recurring of recurringSchedules.filter((r: any) => r.day_of_week === dayOfWeek)) {
          const [sh, sm] = recurring.start_time.split(':').map(Number)
          const [eh, em] = recurring.end_time.split(':').map(Number)
          const slotStart = new Date(currentDate); slotStart.setHours(sh, sm, 0, 0)
          const slotEnd = new Date(currentDate); slotEnd.setHours(eh, em, 0, 0)

          const stdTask = stdTaskMap.get(recurring.standard_task_id)
          const taskTitle = stdTask ? `🔄 ${(stdTask as any).task_name}` : '🔄 Recurring Task'

          for (const employeeId of recurring.employee_ids) {
            scheduleInserts.push({
              employee_id: employeeId,
              task_id: null,
              title: taskTitle,
              description: recurring.notes || 'Recurring scheduled task',
              start_time: slotStart.toISOString(),
              end_time: slotEnd.toISOString(),
              is_auto_generated: true,
            })
            if (recurring.workstation_id) {
              wsScheduleInserts.push({
                workstation_id: recurring.workstation_id,
                task_id: null,
                task_title: taskTitle,
                user_name: empNameMap.get(employeeId) || 'Unknown',
                start_time: slotStart.toISOString(),
                end_time: slotEnd.toISOString(),
              })
            }
          }
        }
      }
    }

    // Insert schedules in batches
    for (let i = 0; i < scheduleInserts.length; i += 100) {
      await supabase.from('schedules').insert(scheduleInserts.slice(i, i + 100))
    }
    for (let i = 0; i < wsScheduleInserts.length; i += 100) {
      await supabase.from('workstation_schedules').insert(wsScheduleInserts.slice(i, i + 100))
    }

    const result = {
      message: 'Schedule auto-generated successfully',
      projects_scheduled: projects.length,
      gantt_entries: schedules.length,
      personal_schedules: scheduleInserts.length,
      workstation_schedules: wsScheduleInserts.length,
    }

    console.log('✅ Auto-generation complete:', result)

    // Log success to automation_logs
    try {
      await supabase.from('automation_logs').insert({
        action_type: 'midnight_scheduler',
        status: 'success',
        summary: `Scheduled ${projects.length} projects, ${schedules.length} gantt entries`,
        details: result,
      })
    } catch (logErr) {
      console.error('Failed to log automation result:', logErr)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in auto-generate-schedule:', error)

    // Log error to automation_logs and send alert
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const errorSupabase = createClient(supabaseUrl, serviceRoleKey)
      
      await errorSupabase.from('automation_logs').insert({
        action_type: 'midnight_scheduler',
        status: 'error',
        summary: 'Midnight scheduler failed',
        error_message: error.message,
      })

      // Send error alert
      await errorSupabase.functions.invoke('send-error-alert', {
        body: {
          action_type: 'midnight_scheduler',
          error_message: error.message,
          summary: 'Midnight scheduler failed completely',
        }
      })
    } catch (alertErr) {
      console.error('Failed to send error alert:', alertErr)
    }

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
