/**
 * Test Data Generator - Run this in browser console to populate calendar with sample tasks
 * Copy and paste into browser DevTools console at: https://oceano-elias.github.io/weekly-planner/
 */

(function () {
    const STORAGE_KEY = 'weeklyPlanner_v3';

    // Get current week ID
    function getWeekIdentifier(date) {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        const dayOfWeek = d.getDay();
        const diff = d.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(d.setDate(diff));
        const year = weekStart.getFullYear();
        const week = Math.ceil(((weekStart - new Date(year, 0, 1)) / 86400000 + 1) / 7);
        return `${year}-W${String(week).padStart(2, '0')}`;
    }

    const currentWeekId = getWeekIdentifier(new Date());
    console.log('Generating test data for week:', currentWeekId);

    // Load existing data
    let data = {};
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) data = JSON.parse(saved);
    } catch (e) { }

    // Initialize structures
    if (!data.weeklyInstances) data.weeklyInstances = {};
    if (!data.templates) data.templates = [];
    if (!data.nextId) data.nextId = 1;

    // Clear current week for fresh test data
    data.weeklyInstances[currentWeekId] = { tasks: [] };

    // Sample tasks with various durations and hierarchies
    const testTasks = [
        // MONDAY
        { title: 'Morning Meditation', hierarchy: ['HEALTH', 'Wellness', 'Meditation'], duration: 30, day: 'monday', time: '08:00', notes: '[ ] 5min breathing\n[ ] 10min focus\n[ ] 15min silence' },
        { title: 'Email Review', hierarchy: ['WORK', 'Admin'], duration: 60, day: 'monday', time: '09:00', notes: '' },
        { title: 'Project Planning', hierarchy: ['WORK', 'Projects', 'App Dev'], duration: 120, day: 'monday', time: '10:00', notes: '[ ] Review requirements\n[ ] Create timeline\n[ ] Assign tasks\n[ ] Set milestones' },
        { title: 'Lunch Break', hierarchy: ['PERSONAL'], duration: 60, day: 'monday', time: '12:00', notes: '' },
        { title: 'Team Standup', hierarchy: ['WORK', 'Meetings'], duration: 30, day: 'monday', time: '14:00', notes: '' },
        { title: 'Deep Work Session', hierarchy: ['WORK', 'Projects', 'App Dev'], duration: 180, day: 'monday', time: '14:30', notes: '[ ] Feature implementation\n[ ] Code review\n[ ] Testing\n[ ] Documentation' },

        // TUESDAY
        { title: 'Gym Workout', hierarchy: ['HEALTH', 'Fitness', 'Gym'], duration: 90, day: 'tuesday', time: '07:00', notes: '[ ] Warm up\n[ ] Squats 4x8\n[ ] Deadlifts 3x6\n[ ] Core work\n[ ] Cool down' },
        { title: 'Client Call', hierarchy: ['WORK', 'Meetings'], duration: 60, day: 'tuesday', time: '10:00', notes: '' },
        { title: 'Design Review', hierarchy: ['WORK', 'Projects', 'Design'], duration: 90, day: 'tuesday', time: '11:00', notes: '[ ] Review mockups\n[ ] Feedback session\n[ ] Approve final designs' },
        { title: 'Lunch', hierarchy: ['PERSONAL'], duration: 60, day: 'tuesday', time: '13:00', notes: '' },
        { title: 'Spanish Course', hierarchy: ['LEARNING', 'Languages', 'Spanish'], duration: 60, day: 'tuesday', time: '15:00', notes: '[ ] Vocabulary review\n[ ] Grammar exercise\n[ ] Conversation practice' },
        { title: 'Reading Time', hierarchy: ['LEARNING', 'Reading'], duration: 60, day: 'tuesday', time: '18:00', notes: '' },

        // WEDNESDAY
        { title: 'Yoga', hierarchy: ['HEALTH', 'Wellness', 'Yoga'], duration: 60, day: 'wednesday', time: '07:00', notes: '' },
        { title: 'Strategy Meeting', hierarchy: ['WORK', 'Meetings'], duration: 120, day: 'wednesday', time: '09:00', notes: '[ ] Q1 review\n[ ] Q2 planning\n[ ] Budget discussion\n[ ] Action items' },
        { title: 'Coding Session', hierarchy: ['WORK', 'Projects', 'App Dev'], duration: 150, day: 'wednesday', time: '11:30', notes: '[ ] Bug fixes\n[ ] New feature\n[ ] Unit tests' },
        { title: 'Piano Practice', hierarchy: ['PERSONAL', 'Hobbies', 'Music'], duration: 45, day: 'wednesday', time: '16:00', notes: '[ ] Scales\n[ ] New piece\n[ ] Improvisation' },
        { title: 'Evening Walk', hierarchy: ['HEALTH', 'Fitness', 'Cardio'], duration: 30, day: 'wednesday', time: '18:00', notes: '' },

        // THURSDAY
        { title: 'HIIT Workout', hierarchy: ['HEALTH', 'Fitness', 'HIIT'], duration: 45, day: 'thursday', time: '07:00', notes: '[ ] Warm up\n[ ] Circuit 1\n[ ] Circuit 2\n[ ] Circuit 3\n[ ] Cool down' },
        { title: 'Documentation', hierarchy: ['WORK', 'Projects', 'App Dev'], duration: 90, day: 'thursday', time: '09:00', notes: '[ ] API docs\n[ ] User guide\n[ ] README update' },
        { title: 'Marketing Review', hierarchy: ['WORK', 'Marketing'], duration: 60, day: 'thursday', time: '11:00', notes: '' },
        { title: 'Lunch Meeting', hierarchy: ['WORK', 'Meetings'], duration: 90, day: 'thursday', time: '12:00', notes: '' },
        { title: 'YouTube Content', hierarchy: ['WORK', 'Social Media', 'YouTube'], duration: 120, day: 'thursday', time: '14:00', notes: '[ ] Script writing\n[ ] Recording\n[ ] Basic editing' },
        { title: 'German Lesson', hierarchy: ['LEARNING', 'Languages', 'German'], duration: 60, day: 'thursday', time: '17:00', notes: '' },

        // FRIDAY
        { title: 'Morning Run', hierarchy: ['HEALTH', 'Fitness', 'Cardio'], duration: 45, day: 'friday', time: '07:00', notes: '' },
        { title: 'Weekly Review', hierarchy: ['WORK', 'Admin'], duration: 60, day: 'friday', time: '09:00', notes: '[ ] Review completed tasks\n[ ] Update metrics\n[ ] Plan next week' },
        { title: 'Code Deployment', hierarchy: ['WORK', 'Projects', 'App Dev'], duration: 90, day: 'friday', time: '10:30', notes: '[ ] Pre-deploy checklist\n[ ] Deploy to staging\n[ ] Test staging\n[ ] Deploy to production' },
        { title: 'Team Retrospective', hierarchy: ['WORK', 'Meetings'], duration: 60, day: 'friday', time: '13:00', notes: '' },
        { title: 'Creative Writing', hierarchy: ['PERSONAL', 'Hobbies', 'Writing'], duration: 90, day: 'friday', time: '15:00', notes: '[ ] Outline\n[ ] First draft\n[ ] Revision' },

        // SATURDAY
        { title: 'Long Run', hierarchy: ['HEALTH', 'Fitness', 'Cardio'], duration: 90, day: 'saturday', time: '08:00', notes: '[ ] Easy pace 5km\n[ ] Tempo 3km\n[ ] Cool down 2km' },
        { title: 'Grocery Shopping', hierarchy: ['PERSONAL', 'Errands'], duration: 60, day: 'saturday', time: '10:00', notes: '' },
        { title: 'Meal Prep', hierarchy: ['HEALTH', 'Nutrition'], duration: 120, day: 'saturday', time: '11:30', notes: '[ ] Prep vegetables\n[ ] Cook proteins\n[ ] Portion meals\n[ ] Store in fridge' },
        { title: 'Photography', hierarchy: ['PERSONAL', 'Hobbies', 'Photography'], duration: 120, day: 'saturday', time: '14:00', notes: '' },
        { title: 'Date Night', hierarchy: ['PERSONAL', 'Social'], duration: 180, day: 'saturday', time: '18:00', notes: '' },

        // SUNDAY
        { title: 'Sleep In', hierarchy: ['HEALTH', 'Wellness', 'Rest'], duration: 60, day: 'sunday', time: '09:00', notes: '' },
        { title: 'Brunch', hierarchy: ['PERSONAL', 'Social'], duration: 90, day: 'sunday', time: '10:00', notes: '' },
        { title: 'Week Planning', hierarchy: ['WORK', 'Admin'], duration: 60, day: 'sunday', time: '14:00', notes: '[ ] Review calendar\n[ ] Set priorities\n[ ] Block time\n[ ] Prep materials' },
        { title: 'Learning Session', hierarchy: ['LEARNING', 'Online Courses'], duration: 120, day: 'sunday', time: '15:30', notes: '[ ] Watch lectures\n[ ] Take notes\n[ ] Practice exercises' },
        { title: 'Relaxation', hierarchy: ['HEALTH', 'Wellness', 'Rest'], duration: 120, day: 'sunday', time: '18:00', notes: '' }
    ];

    // Add tasks to current week
    testTasks.forEach((task, index) => {
        data.weeklyInstances[currentWeekId].tasks.push({
            instanceId: `inst_${1000 + index}`,
            templateId: null,
            title: task.title,
            goal: '',
            hierarchy: task.hierarchy,
            duration: task.duration,
            completed: false,
            notes: task.notes,
            scheduledDay: task.day,
            scheduledTime: task.time
        });
    });

    // Update nextId
    data.nextId = Math.max(data.nextId, 2000);

    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));

    console.log(`✅ Added ${testTasks.length} test tasks to week ${currentWeekId}`);
    console.log('Refresh the page to see the changes!');

    // Auto-reload
    if (confirm('Test data added! Reload page now?')) {
        location.reload();
    }
})();
