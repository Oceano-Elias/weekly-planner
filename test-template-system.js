/**
 * Test Script for Manual Template System
 * 
 * Copy and paste this into your browser console (F12)
 * to automatically test the template functionality
 */

// Test function to add sample tasks
function testTemplateSystem() {
    console.log('🧪 Starting template system test...');

    // Get current store data
    const data = JSON.parse(localStorage.getItem('weeklyPlanner_v3')) || {
        tasks: [],
        nextId: 1,
        weeklyData: {},
        goals: {},
        templates: [],
        weeklyInstances: {},
        migrated: true
    };

    // Get current week identifier
    const now = new Date('2026-01-07'); // Current date
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay()); // Sunday
    const year = weekStart.getFullYear();
    const weekNumber = Math.ceil((weekStart - new Date(year, 0, 1)) / 604800000);
    const weekId = `${year}-W${String(weekNumber).padStart(2, '0')}`;

    console.log(`📅 Current week: ${weekId}`);

    // Create test tasks in queue
    const testTasks = [
        {
            id: `task_${data.nextId++}`,
            title: 'Morning Workout',
            goal: 'Stay healthy',
            hierarchy: ['HEALTH', 'Exercise'],
            duration: 60,
            notes: '',
            completed: false,
            scheduledDay: 'Monday',
            scheduledTime: '08:00',
            createdAt: Date.now()
        },
        {
            id: `task_${data.nextId++}`,
            title: 'Team Meeting',
            goal: 'Weekly sync',
            hierarchy: ['WORK', 'Meetings'],
            duration: 90,
            notes: '',
            completed: false,
            scheduledDay: 'Wednesday',
            scheduledTime: '10:00',
            createdAt: Date.now()
        },
        {
            id: `task_${data.nextId++}`,
            title: 'Personal Project',
            goal: 'Build skills',
            hierarchy: ['PERSONAL', 'Learning'],
            duration: 120,
            notes: '',
            completed: false,
            scheduledDay: 'Friday',
            scheduledTime: '14:00',
            createdAt: Date.now()
        }
    ];

    // Add to tasks array
    data.tasks.push(...testTasks);

    // Add to current week instances (without templates)
    if (!data.weeklyInstances[weekId]) {
        data.weeklyInstances[weekId] = { tasks: [] };
    }

    testTasks.forEach(task => {
        data.weeklyInstances[weekId].tasks.push({
            templateId: null,  // No template yet
            title: task.title,
            goal: task.goal,
            hierarchy: task.hierarchy,
            duration: task.duration,
            completed: false,
            notes: '',
            scheduledDay: task.scheduledDay,
            scheduledTime: task.scheduledTime
        });
    });

    // Save to localStorage
    localStorage.setItem('weeklyPlanner_v3', JSON.stringify(data));

    console.log('✅ Added 3 test tasks to current week:');
    console.log('  - Morning Workout (Monday 8:00)');
    console.log('  - Team Meeting (Wednesday 10:00)');
    console.log('  - Personal Project (Friday 14:00)');
    console.log('\n📋 Next steps:');
    console.log('  1. Refresh the page (Cmd+R)');
    console.log('  2. You should see 3 tasks on the calendar');
    console.log('  3. Click "Set Template" button');
    console.log('  4. Navigate to next week (→) to verify they appear');

    return data;
}

// Run the test
testTemplateSystem();
