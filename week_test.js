const PlannerService = {
    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        return monday;
    },
    getWeekIdentifier(date) {
        const monday = this.getWeekStart(date);
        const year = monday.getFullYear();
        const yearStart = new Date(year, 0, 1);
        const dayOffset = (monday - yearStart) / 86400000;
        const week = Math.floor(dayOffset / 7) + 1;
        return `${year}-W${String(week).padStart(2, '0')}`;
    },
    getPreviousWeekId(weekId) {
        const [year, weekStr] = weekId.split('-W');
        const targetWeek = parseInt(weekStr);
        const yearInt = parseInt(year);

        // Initial guess: Jan 1 + (week * 7) days
        let date = new Date(yearInt, 0, 1 + targetWeek * 7);

        // Align to Monday
        let monday = this.getWeekStart(date);

        // Check what week this date actually is
        let foundId = this.getWeekIdentifier(monday);

        let attempts = 0;
        while (foundId !== weekId && attempts < 10) {
            const [fYear, fWeek] = foundId.split('-W');
            if (parseInt(fYear) !== yearInt && targetWeek > 5 && targetWeek < 50) break;
            const fWeekInt = parseInt(fWeek);

            // Handle cross-year logic roughly or just simple compare
            // For this test, simplistic compare is enough for intra-year
            if (fWeekInt > targetWeek) {
                monday.setDate(monday.getDate() - 7);
            } else if (fWeekInt < targetWeek) {
                monday.setDate(monday.getDate() + 7);
            }
            foundId = this.getWeekIdentifier(monday);
            attempts++;
        }

        monday.setDate(monday.getDate() - 7);
        return this.getWeekIdentifier(monday);
    },
};

const current = '2026-W06';
const prev = PlannerService.getPreviousWeekId(current);
console.log(`Current: ${current}, Previous: ${prev}`);

const yearTransition = '2026-W01';
const prevYear = PlannerService.getPreviousWeekId(yearTransition);
console.log(`Current: ${yearTransition}, Previous: ${prevYear}`);
