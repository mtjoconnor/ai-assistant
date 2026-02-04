// src/screens/HomeScreen.tsx
import React, { useEffect, useState, useRef } from 'react'
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	ActivityIndicator,
	FlatList,
	TouchableOpacity,
	Alert,
	Animated,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { generateRemindersDemo, SuggestedReminder } from '../services/reminderService'

const UPCOMING_KEY = 'ai_native_upcoming_v1'
const UNDO_DURATION_MS = 8000 // allow 8s to undo

type LastAction =
	| { kind: 'accept'; item: SuggestedReminder }
	| { kind: 'dismiss'; itemId: string }
	| { kind: 'remove'; item: SuggestedReminder }
	| { kind: 'snooze'; item: SuggestedReminder; previousWhen: string }
	| null

export default function HomeScreen() {
	const [loading, setLoading] = useState(false)
	const [suggestions, setSuggestions] = useState<SuggestedReminder[]>([])
	const [upcoming, setUpcoming] = useState<SuggestedReminder[]>([])
	const [lastAction, setLastAction] = useState<LastAction>(null)
	const undoTimerRef = useRef<number | null>(null)
	const undoAnim = useRef(new Animated.Value(0)).current

	useEffect(() => {
		// load persisted upcoming items
		;(async () => {
			try {
				const raw = await AsyncStorage.getItem(UPCOMING_KEY)
				if (raw) {
					const parsed = JSON.parse(raw)
					if (Array.isArray(parsed)) setUpcoming(parsed)
				}
			} catch (e) {
				console.warn('failed to load upcoming from storage', e)
			}
		})()
		// cleanup on unmount
		return () => {
			if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
		}
	}, [])

	async function persistUpcoming(list: SuggestedReminder[]) {
		try {
			await AsyncStorage.setItem(UPCOMING_KEY, JSON.stringify(list))
		} catch (e) {
			console.warn('failed to save upcoming to storage', e)
		}
	}

	async function loadSuggestions() {
		setLoading(true)
		try {
			const s = await generateRemindersDemo()
			setSuggestions(s)
		} catch (err) {
			Alert.alert('Error', 'Failed to load suggestions')
		} finally {
			setLoading(false)
		}
	}

	// Utility: show undo banner for the given action
	function showUndoBanner(action: LastAction) {
		// clear previous timer
		if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
		setLastAction(action)
		Animated.timing(undoAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
		// schedule hide
		undoTimerRef.current = (setTimeout(() => {
			hideUndoBanner()
		}, UNDO_DURATION_MS) as unknown) as number
	}

	function hideUndoBanner() {
		Animated.timing(undoAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
			setLastAction(null)
			if (undoTimerRef.current) {
				clearTimeout(undoTimerRef.current)
				undoTimerRef.current = null
			}
		})
	}

	// Accept: add to upcoming and remove from suggestions
	async function handleAccept(item: SuggestedReminder) {
		setUpcoming(prev => {
			const next = [...prev, item].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
			persistUpcoming(next)
			return next
		})
		setSuggestions(prev => prev.filter(p => p.id !== item.id))

		showUndoBanner({ kind: 'accept', item })
	}

	// Dismiss suggestion
	function handleDismiss(id: string) {
		const dismissed = suggestions.find(s => s.id === id) || null
		setSuggestions(prev => prev.filter(p => p.id !== id))
		if (dismissed) showUndoBanner({ kind: 'dismiss', itemId: id })
	}

	// Remove upcoming (delete)
	function handleRemoveUpcoming(item: SuggestedReminder) {
		setUpcoming(prev => prev.filter(p => p.id !== item.id))
		persistUpcoming(upcoming.filter(p => p.id !== item.id))
		showUndoBanner({ kind: 'remove', item })
	}

	// Snooze upcoming by minutes (creates new when)
	function handleSnoozeUpcoming(item: SuggestedReminder, minutes: number) {
		const previousWhen = item.when
		const newWhen = new Date(new Date(item.when).getTime() + minutes * 60 * 1000).toISOString()
		setUpcoming(prev => {
			const next = prev.map(p => (p.id === item.id ? { ...p, when: newWhen } : p)).sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
			persistUpcoming(next)
			return next
		})
		showUndoBanner({ kind: 'snooze', item, previousWhen })
	}

	// Undo lastAction
	function handleUndo() {
		if (!lastAction) return
		const action = lastAction
		// clear banner now
		hideUndoBanner()
		switch (action.kind) {
			case 'accept': {
				// remove the accepted item from upcoming, and put it back into suggestions at front
				const item = action.item
				setUpcoming(prev => {
					const next = prev.filter(p => p.id !== item.id)
					persistUpcoming(next)
					return next
				})
				setSuggestions(prev => [action.item, ...prev])
				return
			}
			case 'dismiss': {
				// cannot fully reconstruct dismissed content unless we kept it; try noop but inform user
				Alert.alert('Undo', 'Dismiss undo not supported for this demo.')
				return
			}
			case 'remove': {
				// re-add the removed upcoming item
				const item = action.item
				setUpcoming(prev => {
					const next = [...prev, item].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
					persistUpcoming(next)
					return next
				})
				return
			}
			case 'snooze': {
				// restore previous time
				const { item, previousWhen } = action
				setUpcoming(prev => {
					const next = prev.map(p => (p.id === item.id ? { ...p, when: previousWhen } : p)).sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
					persistUpcoming(next)
					return next
				})
				return
			}
			default:
				return
		}
	}

	function renderSuggestion({ item }: { item: SuggestedReminder }) {
		return (
			<View style={styles.card}>
				<View style={{ flex: 1 }}>
					<Text style={styles.cardText}>{item.text}</Text>
					<Text style={styles.cardSub}>
						{new Date(item.when).toLocaleString()} • {item.priority}
					</Text>
				</View>

				<View style={styles.cardButtons}>
					<TouchableOpacity onPress={() => handleAccept(item)} style={[styles.button, styles.acceptButton]}>
						<Text style={styles.buttonText}>Accept</Text>
					</TouchableOpacity>

					<TouchableOpacity onPress={() => handleDismiss(item.id)} style={[styles.button, styles.dismissButton]}>
						<Text style={styles.buttonText}>Dismiss</Text>
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	function renderUpcoming({ item }: { item: SuggestedReminder }) {
		return (
			<View style={styles.upcomingItem}>
				<View style={{ flex: 1 }}>
					<Text style={styles.cardText}>{item.text}</Text>
					<Text style={styles.cardSub}>{new Date(item.when).toLocaleString()}</Text>
				</View>

				<View style={{ marginLeft: 12, alignItems: 'flex-end' }}>
					<View style={{ marginBottom: 8, flexDirection: 'row' }}>
						<TouchableOpacity onPress={() => handleSnoozeUpcoming(item, 10)} style={[styles.smallButton]}>
							<Text style={styles.smallButtonText}>+10m</Text>
						</TouchableOpacity>
						<TouchableOpacity onPress={() => handleSnoozeUpcoming(item, 30)} style={[styles.smallButton]}>
							<Text style={styles.smallButtonText}>+30m</Text>
						</TouchableOpacity>
						<TouchableOpacity onPress={() => handleSnoozeUpcoming(item, 60)} style={[styles.smallButton]}>
							<Text style={styles.smallButtonText}>+1h</Text>
						</TouchableOpacity>
					</View>

					<TouchableOpacity onPress={() => handleRemoveUpcoming(item)} style={[styles.button, styles.dismissButton]}>
						<Text style={styles.buttonText}>Remove</Text>
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	return (
		<View style={{ flex: 1 }}>
			<ScrollView contentContainerStyle={styles.container}>
				<Text style={styles.title}>Today</Text>
				<Text style={styles.subtitle}>
					Your accepted reminders appear under Upcoming. Suggestions are AI-generated nudges.
				</Text>

				<View style={styles.panel}>
					<Text style={styles.panelTitle}>Upcoming</Text>

					{upcoming.length === 0 ? (
						<Text style={styles.panelText}>• No upcoming reminders</Text>
					) : (
						<FlatList
							data={upcoming}
							keyExtractor={i => i.id}
							renderItem={renderUpcoming}
							scrollEnabled={false}
							style={{ marginTop: 8 }}
						/>
					)}
				</View>

				<View style={styles.panel}>
					<View style={styles.panelHeader}>
						<Text style={styles.panelTitle}>Suggestions</Text>
						<TouchableOpacity onPress={loadSuggestions} style={styles.refresh}>
							{loading ? <ActivityIndicator /> : <Text style={styles.refreshText}>Refresh</Text>}
						</TouchableOpacity>
					</View>

					{loading && suggestions.length === 0 ? (
						<ActivityIndicator style={{ marginTop: 12 }} />
					) : suggestions.length === 0 ? (
						<Text style={styles.panelText}>• No suggestions yet</Text>
					) : (
						<FlatList
							data={suggestions}
							keyExtractor={i => i.id}
							renderItem={renderSuggestion}
							scrollEnabled={false}
							style={{ marginTop: 8 }}
						/>
					)}
				</View>
			</ScrollView>

			{/* Undo banner */}
			{lastAction ? (
				<Animated.View
					style={[
						styles.undoBanner,
						{
							opacity: undoAnim,
							transform: [
								{
									translateY: undoAnim.interpolate({
										inputRange: [0, 1],
										outputRange: [40, 0],
									}),
								},
							],
						},
					]}>
					<Text style={styles.undoText}>
						{lastAction.kind === 'accept' && 'Added to Upcoming'}
						{lastAction.kind === 'dismiss' && 'Suggestion dismissed'}
						{lastAction.kind === 'remove' && 'Removed from Upcoming'}
						{lastAction.kind === 'snooze' && 'Snoozed'}
					</Text>
					<TouchableOpacity onPress={handleUndo} style={styles.undoButton}>
						<Text style={styles.undoButtonText}>Undo</Text>
					</TouchableOpacity>
				</Animated.View>
			) : null}
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 24,
		flexGrow: 1,
		backgroundColor: '#fff',
		paddingBottom: 96, // leave space for undo banner
	},
	title: {
		fontSize: 28,
		fontWeight: '700',
		marginBottom: 8,
	},
	subtitle: {
		fontSize: 14,
		marginBottom: 20,
		color: '#444',
	},
	panel: {
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: '#eee',
		marginBottom: 12,
	},
	panelHeader: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	panelTitle: {
		fontWeight: '600',
		marginBottom: 6,
		fontSize: 16,
	},
	panelText: {
		fontSize: 14,
		color: '#333',
	},
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		padding: 12,
		borderRadius: 8,
		backgroundColor: '#fafafa',
		marginBottom: 8,
	},
	cardText: {
		fontWeight: '600',
		marginBottom: 4,
	},
	cardSub: {
		fontSize: 12,
		color: '#666',
	},
	cardButtons: {
		marginLeft: 12,
		justifyContent: 'space-between',
		alignItems: 'flex-end',
	},
	button: {
		paddingVertical: 6,
		paddingHorizontal: 10,
		borderRadius: 8,
		marginBottom: 6,
	},
	acceptButton: {
		backgroundColor: '#1E90FF',
	},
	dismissButton: {
		backgroundColor: '#e0e0e0',
	},
	buttonText: {
		color: '#fff',
		fontWeight: '600',
		fontSize: 13,
	},
	refresh: {
		paddingHorizontal: 8,
		paddingVertical: 6,
	},
	refreshText: {
		color: '#1E90FF',
		fontWeight: '600',
	},
	upcomingItem: {
		padding: 12,
		borderRadius: 8,
		backgroundColor: '#fff',
		borderWidth: 1,
		borderColor: '#f0f0f0',
		marginBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
	},
	smallButton: {
		paddingHorizontal: 8,
		paddingVertical: 6,
		borderRadius: 8,
		backgroundColor: '#f3f4f6',
		marginRight: 8,
	},
	smallButtonText: {
		color: '#333',
		fontWeight: '600',
		fontSize: 12,
	},
	undoBanner: {
		position: 'absolute',
		bottom: 18,
		left: 16,
		right: 16,
		backgroundColor: '#111',
		paddingHorizontal: 12,
		paddingVertical: 10,
		borderRadius: 12,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	undoText: {
		color: '#fff',
		fontWeight: '600',
	},
	undoButton: {
		backgroundColor: '#fff',
		paddingHorizontal: 10,
		paddingVertical: 6,
		borderRadius: 8,
	},
	undoButtonText: {
		color: '#111',
		fontWeight: '700',
	},
})
