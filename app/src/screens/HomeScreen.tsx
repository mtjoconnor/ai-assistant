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
	Modal,
	TextInput,
	Platform,
} from 'react-native'
import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import AsyncStorage from '@react-native-async-storage/async-storage'
import DateTimePicker from '@react-native-community/datetimepicker'
import { generateRemindersDemo, SuggestedReminder } from '../services/reminderService'

const UPCOMING_KEY = 'ai_native_upcoming_v1'
const UNDO_DURATION_MS = 8000

type UpcomingWithNotification = SuggestedReminder & { notificationId?: string }

type LastAction =
	| { kind: 'accept'; item: UpcomingWithNotification }
	| { kind: 'dismiss'; itemId: string }
	| { kind: 'remove'; item: UpcomingWithNotification }
	| { kind: 'snooze'; item: UpcomingWithNotification; previousWhen: string }
	| { kind: 'edit'; before: UpcomingWithNotification; after: UpcomingWithNotification }
	| null

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldShowBanner: true,
		shouldShowList: false,
		shouldPlaySound: false,
		shouldSetBadge: false,
	}),
})

export default function HomeScreen() {
	const [loading, setLoading] = useState(false)
	const [suggestions, setSuggestions] = useState<SuggestedReminder[]>([])
	const [upcoming, setUpcoming] = useState<UpcomingWithNotification[]>([])
	const [lastAction, setLastAction] = useState<LastAction>(null)
	const undoTimerRef = useRef<number | null>(null)
	const undoAnim = useRef(new Animated.Value(0)).current

	// Edit modal state
	const [editingItem, setEditingItem] = useState<UpcomingWithNotification | null>(null)
	const [editText, setEditText] = useState('')
	const [editDate, setEditDate] = useState<Date>(new Date())
	const [showDatePicker, setShowDatePicker] = useState(false)

	useEffect(() => {
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

		requestNotificationPermissions().catch(e => console.warn('perm request failed', e))
		return () => {
			if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
		}
	}, [])

	async function requestNotificationPermissions() {
		if (!Device.isDevice) {
			console.warn('Notifications: physical device recommended for scheduling')
		}
		const { status: existingStatus } = await Notifications.getPermissionsAsync()
		let finalStatus = existingStatus
		if (existingStatus !== 'granted') {
			const { status } = await Notifications.requestPermissionsAsync()
			finalStatus = status
		}
		if (finalStatus !== 'granted') {
			Alert.alert('Permission required', 'Enable notifications to receive reminders.')
		}
	}

	async function persistUpcoming(list: UpcomingWithNotification[]) {
		try {
			await AsyncStorage.setItem(UPCOMING_KEY, JSON.stringify(list))
		} catch (e) {
			console.warn('failed to save upcoming to storage', e)
		}
	}

	async function scheduleNotificationForItem(item: SuggestedReminder): Promise<string | undefined> {
        try {
            const whenDate = new Date(item.when)
            const deltaSeconds = Math.max(Math.ceil((whenDate.getTime() - Date.now()) / 1000), 1)
   
            // Build a time-interval trigger. The 'type' discriminant is required by TS.
            // We cast to `any` (or NotificationTriggerInput) because the d.ts expects a discriminated union.
            const trigger = {
                type: 'timeInterval',
                seconds: deltaSeconds,
                repeats: false,
            } as any
   
            const id = await Notifications.scheduleNotificationAsync({
                content: {
                    title:
                        'Upcoming: ' +
                        (item.text.length > 30 ? item.text.slice(0, 30) + '…' : item.text),
                    body: item.text,
                    data: { itemId: item.id },
                },
                trigger,
            })
            return id
        } catch (e) {
            console.warn('failed to schedule notification', e)
            return undefined
        }
   }
   

	async function cancelNotificationById(id?: string) {
		if (!id) return
		try {
			await Notifications.cancelScheduledNotificationAsync(id)
		} catch (e) {
			console.warn('failed to cancel notification', e)
		}
	}

	const loadSuggestions = async () => {
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

	function showUndoBanner(action: LastAction) {
		if (undoTimerRef.current) clearTimeout(undoTimerRef.current)
		setLastAction(action)
		Animated.timing(undoAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
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

	async function handleAccept(item: SuggestedReminder) {
		const notificationId = await scheduleNotificationForItem(item)
		const itemWithNotif: UpcomingWithNotification = { ...item, notificationId }

		setUpcoming(prev => {
			const next = [...prev, itemWithNotif].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
			persistUpcoming(next)
			return next
		})

		setSuggestions(prev => prev.filter(p => p.id !== item.id))
		showUndoBanner({ kind: 'accept', item: itemWithNotif })
	}

	function handleDismiss(id: string) {
		const dismissed = suggestions.find(s => s.id === id) || null
		setSuggestions(prev => prev.filter(p => p.id !== id))
		if (dismissed) showUndoBanner({ kind: 'dismiss', itemId: id })
	}

	async function handleRemoveUpcoming(item: UpcomingWithNotification) {
		if (item.notificationId) {
			await cancelNotificationById(item.notificationId)
		}

		setUpcoming(prev => {
			const next = prev.filter(p => p.id !== item.id)
			persistUpcoming(next)
			return next
		})

		showUndoBanner({ kind: 'remove', item })
	}

	async function handleSnoozeUpcoming(item: UpcomingWithNotification, minutes: number) {
		const previousWhen = item.when
		const newWhen = new Date(new Date(item.when).getTime() + minutes * 60 * 1000).toISOString()

		if (item.notificationId) {
			await cancelNotificationById(item.notificationId)
		}

		const newNotifId = await scheduleNotificationForItem({ ...item, when: newWhen })
		const updated: UpcomingWithNotification = { ...item, when: newWhen, notificationId: newNotifId }

		setUpcoming(prev => {
			const next = prev.map(p => (p.id === item.id ? updated : p)).sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
			persistUpcoming(next)
			return next
		})

		showUndoBanner({ kind: 'snooze', item: updated, previousWhen })
	}

	async function handleEditSave() {
		if (!editingItem) return
		// prepare new object
		const before = editingItem
		const after: UpcomingWithNotification = { ...before, text: editText, when: editDate.toISOString() }

		// cancel previous notif if any
		if (before.notificationId) {
			await cancelNotificationById(before.notificationId)
		}
		// schedule new notif
		const newNotifId = await scheduleNotificationForItem(after)
		after.notificationId = newNotifId

		// update list
		setUpcoming(prev => {
			const next = prev.map(p => (p.id === after.id ? after : p)).sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
			persistUpcoming(next)
			return next
		})

		// show undo with before/after payload
		showUndoBanner({ kind: 'edit', before, after })
		// close modal
		setEditingItem(null)
	}

	async function handleUndo() {
		if (!lastAction) return
		const action = lastAction
		hideUndoBanner()
		switch (action.kind) {
			case 'accept': {
				const item = action.item
				if (item.notificationId) {
					await cancelNotificationById(item.notificationId)
				}
				setUpcoming(prev => {
					const next = prev.filter(p => p.id !== item.id)
					persistUpcoming(next)
					return next
				})
				setSuggestions(prev => [{ id: item.id, text: item.text, when: item.when, priority: item.priority }, ...prev])
				return
			}
			case 'dismiss': {
				Alert.alert('Undo', 'Dismiss undo not supported for this demo.')
				return
			}
			case 'remove': {
				const item = action.item
				const restored = { ...item }
				const newNotifId = await scheduleNotificationForItem(restored)
				const restoredWithNotif = { ...restored, notificationId: newNotifId }
				setUpcoming(prev => {
					const next = [...prev, restoredWithNotif].sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
					persistUpcoming(next)
					return next
				})
				return
			}
			case 'snooze': {
				const { item, previousWhen } = action
				if (item.notificationId) await cancelNotificationById(item.notificationId)
				const oldNotifId = await scheduleNotificationForItem({ ...item, when: previousWhen })
				setUpcoming(prev => {
					const next = prev.map(p => (p.id === item.id ? { ...p, when: previousWhen, notificationId: oldNotifId } : p)).sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
					persistUpcoming(next)
					return next
				})
				return
			}
			case 'edit': {
				const { before, after } = action
				// cancel current (after) notification
				if (after.notificationId) await cancelNotificationById(after.notificationId)
				// reschedule previous
				const oldNotifId = await scheduleNotificationForItem(before)
				const restored = { ...before, notificationId: oldNotifId }
				setUpcoming(prev => {
					const next = prev.map(p => (p.id === restored.id ? restored : p)).sort((a, b) => new Date(a.when).getTime() - new Date(b.when).getTime())
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

	function openEditModal(item: UpcomingWithNotification) {
		setEditingItem(item)
		setEditText(item.text)
		setEditDate(new Date(item.when))
	}

	function renderUpcoming({ item }: { item: UpcomingWithNotification }) {
		return (
			<TouchableOpacity onPress={() => openEditModal(item)} activeOpacity={0.8}>
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
			</TouchableOpacity>
		)
	}

	return (
		<View style={{ flex: 1 }}>
			<ScrollView contentContainerStyle={styles.container}>
				<Text style={styles.title}>Today</Text>
				<Text style={styles.subtitle}>
					Tap an Upcoming reminder to edit its text and time.
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

			{/* Edit modal */}
			<Modal visible={!!editingItem} animationType="slide" transparent>
				<View style={styles.modalOverlay}>
					<View style={styles.modalCard}>
						<Text style={{ fontWeight: '700', marginBottom: 8 }}>Edit reminder</Text>

						<TextInput
							value={editText}
							onChangeText={setEditText}
							placeholder="Reminder text"
							style={styles.input}
						/>

						<TouchableOpacity
							onPress={() => setShowDatePicker(true)}
							style={{ paddingVertical: 8, marginBottom: 6 }}>
							<Text style={{ color: '#1E90FF' }}>{editDate.toLocaleString()}</Text>
						</TouchableOpacity>

						{showDatePicker && (
							<DateTimePicker
								value={editDate}
								mode="datetime"
								display={Platform.OS === 'ios' ? 'inline' : 'default'}
								onChange={(e, d) => {
									setShowDatePicker(Platform.OS === 'ios') // keep open on iOS inline
									if (d) setEditDate(d)
								}}
							/>
						)}

						<View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
							<TouchableOpacity onPress={() => setEditingItem(null)} style={{ marginRight: 12 }}>
								<Text style={{ color: '#666' }}>Cancel</Text>
							</TouchableOpacity>

							<TouchableOpacity
								onPress={handleEditSave}
								style={[styles.button, styles.acceptButton]}>
								<Text style={[styles.buttonText]}>Save</Text>
							</TouchableOpacity>
						</View>
					</View>
				</View>
			</Modal>

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
						{lastAction.kind === 'edit' && 'Reminder edited'}
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
		paddingBottom: 96,
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

	/* modal */
	modalOverlay: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.35)',
		justifyContent: 'center',
		padding: 16,
	},
	modalCard: {
		backgroundColor: '#fff',
		borderRadius: 12,
		padding: 16,
	},
	input: {
		borderWidth: 1,
		borderColor: '#eee',
		borderRadius: 8,
		padding: 8,
		marginBottom: 8,
	},
})
