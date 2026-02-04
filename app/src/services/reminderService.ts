// src/services/reminderService.ts
export type SuggestedReminder = {
	id: string
	text: string
	when: string // ISO timestamp
	priority?: 'low' | 'medium' | 'high'
}

/**
 * Simulate an async call to generate reminder suggestions.
 * Returns a small array of SuggestedReminder after a short delay.
 */
export async function generateRemindersDemo(): Promise<SuggestedReminder[]> {
	// simulate network / AI latency
	await new Promise(resolve => setTimeout(resolve, 650))

	const now = Date.now()
	return [
		{
			id: `demo-${now + 1}`,
			text: 'Prepare slides for tomorrow’s meeting',
			when: new Date(now + 1000 * 60 * 60 * 24).toISOString(),
			priority: 'high',
		},
		{
			id: `demo-${now + 2}`,
			text: 'Charge laptop + pack charger',
			when: new Date(now + 1000 * 60 * 60 * 2).toISOString(),
			priority: 'medium',
		},
		{
			id: `demo-${now + 3}`,
			text: 'Send agenda to attendees',
			when: new Date(now + 1000 * 60 * 60 * 6).toISOString(),
			priority: 'low',
		},
	]
}
