
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.23.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if we already have data
    const { data: existingProjects } = await supabaseClient
      .from('projects')
      .select('id')
      .limit(1)

    if (existingProjects && existingProjects.length > 0) {
      return new Response(
        JSON.stringify({
          message: 'Database already initialized with sample data'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        }
      )
    }

    // Insert sample projects
    const now = new Date()
    const startDate = new Date()
    startDate.setDate(now.getDate() - 15)
    
    const installDate = new Date()
    installDate.setDate(now.getDate() + 30)

    // Insert projects
    const { data: projectsData, error: projectsError } = await supabaseClient
      .from('projects')
      .insert([
        {
          name: 'Office Building Renovation',
          client: 'ABC Corp',
          description: 'Complete renovation of 3-story office building with new furniture and fixtures',
          start_date: startDate.toISOString().split('T')[0],
          installation_date: installDate.toISOString().split('T')[0],
          progress: 0,
          status: 'in_progress'
        },
        {
          name: 'Restaurant Kitchen Equipment',
          client: 'Fine Dining LLC',
          description: 'Custom stainless steel kitchen equipment for new restaurant',
          start_date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          installation_date: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          progress: 0,
          status: 'planned'
        }
      ])
      .select()

    if (projectsError) {
      throw projectsError
    }

    // Define standard phases from the list
    const standardPhases = [
      { id: '01', name: 'Prog. Vectorworks', workstation: 'productievoorbereiding' },
      { id: '02', name: 'Bestellen E&S + WB', workstation: 'productievoorbereiding' },
      { id: '03', name: 'Prog. Korpus', workstation: 'productiesturing' },
      { id: '04', name: 'Bestellen lades', workstation: '' },
      { id: '05', name: 'Klaarleggen', workstation: 'beslag, toebehoren, platen, kanten' },
      { id: '06', name: 'Bestel Toebehoren', workstation: '' },
      { id: '07', name: 'Bestel Plaatmateriaal en kanten', workstation: '' },
      { id: '08', name: 'Bestel Fronten', workstation: '' },
      { id: '09', name: 'Levering Kantenband', workstation: '' },
      { id: '10', name: 'Levering Korpusmateriaal', workstation: '' },
      { id: '11', name: 'Levering Frontmateriaal', workstation: '' },
      { id: '12', name: 'Korpusmateriaal Zagen', workstation: 'Opdeelzaag 1' },
      { id: '13', name: 'Korpusmateriaal Zagen', workstation: 'Opdeelzaag 2' },
      { id: '14', name: 'Frontmateriaal Zagen', workstation: 'Opdeelzaag 1' },
      { id: '15', name: 'Frontmateriaal Zagen', workstation: 'Opdeelzaag 2' }
    ]
    
    // Define phases for each project
    const phases: any[] = []
    
    // Project 1 phases
    if (projectsData && projectsData[0]) {
      const project1 = projectsData[0]
      
      // Calculate days between start and installation for project 1
      const project1Start = new Date(project1.start_date)
      const project1Installation = new Date(project1.installation_date)
      const totalDays = Math.ceil(
        (project1Installation.getTime() - project1Start.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      // Create 6 phases with standard phase names
      const phasesToUse = standardPhases.slice(0, 6) // Use first 6 phases
      const daysPerPhase = Math.max(1, Math.floor(totalDays / phasesToUse.length))
      
      phasesToUse.forEach((phaseInfo, index) => {
        const phaseStartDate = new Date(project1Start)
        phaseStartDate.setDate(project1Start.getDate() + (index * daysPerPhase))
        
        const phaseEndDate = new Date(phaseStartDate)
        if (index === phasesToUse.length - 1) {
          phaseEndDate.setTime(project1Installation.getTime())
        } else {
          phaseEndDate.setDate(phaseStartDate.getDate() + daysPerPhase - 1)
        }
        
        phases.push({
          project_id: project1.id,
          name: `${phaseInfo.id} - ${phaseInfo.name}${phaseInfo.workstation ? ` - ${phaseInfo.workstation}` : ''}`,
          start_date: phaseStartDate.toISOString().split('T')[0],
          end_date: phaseEndDate.toISOString().split('T')[0],
          progress: index === 0 ? 100 : index === 1 ? 50 : 0
        })
      })
    }
    
    // Project 2 phases - similar approach
    if (projectsData && projectsData[1]) {
      const project2 = projectsData[1]
      
      // Calculate days between start and installation for project 2
      const project2Start = new Date(project2.start_date)
      const project2Installation = new Date(project2.installation_date)
      const totalDays = Math.ceil(
        (project2Installation.getTime() - project2Start.getTime()) / (1000 * 60 * 60 * 24)
      )
      
      // Create phases with standard phase names (use a different range of phases)
      const phasesToUse = standardPhases.slice(6, 12) // Use phases 7-12
      const daysPerPhase = Math.max(1, Math.floor(totalDays / phasesToUse.length))
      
      phasesToUse.forEach((phaseInfo, index) => {
        const phaseStartDate = new Date(project2Start)
        phaseStartDate.setDate(project2Start.getDate() + (index * daysPerPhase))
        
        const phaseEndDate = new Date(phaseStartDate)
        if (index === phasesToUse.length - 1) {
          phaseEndDate.setTime(project2Installation.getTime())
        } else {
          phaseEndDate.setDate(phaseStartDate.getDate() + daysPerPhase - 1)
        }
        
        phases.push({
          project_id: project2.id,
          name: `${phaseInfo.id} - ${phaseInfo.name}${phaseInfo.workstation ? ` - ${phaseInfo.workstation}` : ''}`,
          start_date: phaseStartDate.toISOString().split('T')[0],
          end_date: phaseEndDate.toISOString().split('T')[0],
          progress: index === 0 ? 100 : 0
        })
      })
    }
    
    // Insert all phases
    const { data: phasesData, error: phasesError } = await supabaseClient
      .from('phases')
      .insert(phases)
      .select()

    if (phasesError) {
      throw phasesError
    }

    // Create sample tasks for the first few phases
    const tasks = []
    
    // Sample tasks for the first project's phases
    if (phasesData) {
      // Get first two phases from project 1
      const projectOnePhases = phasesData.filter(p => p.project_id === projectsData[0].id);
      const firstPhase = projectOnePhases[0];
      const secondPhase = projectOnePhases[1];
      
      if (firstPhase) {
        tasks.push({
          phase_id: firstPhase.id,
          title: 'Site inspection',
          description: 'Inspect site and document existing conditions',
          workstation: 'CUTTING',
          status: 'COMPLETED',
          priority: 'High',
          due_date: new Date(firstPhase.start_date).toISOString().split('T')[0]
        })
        
        tasks.push({
          phase_id: firstPhase.id,
          title: 'Requirements gathering',
          description: 'Meet with client to determine project requirements',
          workstation: 'ASSEMBLY',
          status: 'COMPLETED',
          priority: 'Medium',
          due_date: new Date(firstPhase.end_date).toISOString().split('T')[0]
        })
      }
      
      if (secondPhase) {
        tasks.push({
          phase_id: secondPhase.id,
          title: 'Create blueprints',
          description: 'Design layout and furniture placement',
          workstation: 'ASSEMBLY',
          status: 'COMPLETED',
          priority: 'High',
          due_date: new Date(secondPhase.start_date).toISOString().split('T')[0]
        })
        
        tasks.push({
          phase_id: secondPhase.id,
          title: 'Material selection',
          description: 'Choose materials for furniture and fixtures',
          workstation: 'CUTTING',
          status: 'IN_PROGRESS',
          priority: 'Medium',
          due_date: new Date(secondPhase.end_date).toISOString().split('T')[0]
        })
      }
      
      // Add a task for a production phase
      const productionPhase = projectOnePhases[2];
      if (productionPhase) {
        const today = new Date().toISOString().split('T')[0]
        
        tasks.push({
          phase_id: productionPhase.id,
          title: 'Cut desk frames',
          description: 'Cut metal frames for 20 desks',
          workstation: 'CUTTING',
          status: 'TODO',
          priority: 'High',
          due_date: today
        })
        
        tasks.push({
          phase_id: productionPhase.id,
          title: 'Prepare wood tops',
          description: 'Cut and sand wooden desk tops',
          workstation: 'CUTTING',
          status: 'TODO',
          priority: 'Medium',
          due_date: today
        })
        
        tasks.push({
          phase_id: productionPhase.id,
          title: 'Weld desk frames',
          description: 'Weld metal frames for 20 desks',
          workstation: 'WELDING',
          status: 'TODO',
          priority: 'High',
          due_date: today
        })
      }
    }

    // Insert all tasks
    const { data: tasksData, error: tasksError } = await supabaseClient
      .from('tasks')
      .insert(tasks)
      .select()

    if (tasksError) {
      throw tasksError
    }

    return new Response(
      JSON.stringify({
        message: 'Database initialized with sample data',
        projects: projectsData.length,
        phases: phasesData.length,
        tasks: tasksData.length
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as any).message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
