// src/screens/HomeScreen.tsx
import React, { useEffect, useState } from 'react'
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	ActivityIndicator,
	FlatList,
	TouchableOpacity,
	Alert,
} from 'react-native'
import { generateRemindersDemo, SuggestedReminder } from '../services/reminderService'

export default function HomeScreen() {
	const [loading, setLoading] = useState(false)
	const [suggestions, setSuggestions] = useState<SuggestedReminder[]>([])

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

	useEffect(() => {
		// initial fetch (optional)
		// loadSuggestions()
	}, [])

	function handleAccept(item: SuggestedReminder) {
		// temporary behaviour: remove from list and confirm
		setSuggestions(prev => prev.filter(p => p.id !== item.id))
		Alert.alert('Accepted', `Accepted: ${item.text}`)
		// TODO: schedule local notification or persist accepted suggestion
	}

	function handleDismiss(id: string) {
		setSuggestions(prev => prev.filter(p => p.id !== id))
	}

	function renderItem({ item }: { item: SuggestedReminder }) {
		return (
			<View style={styles.card}>
				<View style={{ flex: 1 }}>
					<Text style={styles.cardText}>{item.text}</Text>
					<Text style={styles.cardSub}>
						{new Date(item.when).toLocaleString()} • {item.priority}
					</Text>
				</View>

				<View style={styles.cardButtons}>
					<TouchableOpacity
						onPress={() => handleAccept(item)}
						style={[styles.button, styles.acceptButton]}>
						<Text style={styles.buttonText}>Accept</Text>
					</TouchableOpacity>

					<TouchableOpacity
						onPress={() => handleDismiss(item.id)}
						style={[styles.button, styles.dismissButton]}>
						<Text style={styles.buttonText}>Dismiss</Text>
					</TouchableOpacity>
				</View>
			</View>
		)
	}

	return (
		<ScrollView contentContainerStyle={styles.container}>
			<Text style={styles.title}>Today</Text>
			<Text style={styles.subtitle}>
				No reminders yet — your AI assistant will suggest helpful nudges here.
			</Text>

			<View style={styles.panel}>
				<Text style={styles.panelTitle}>Upcoming</Text>
				<Text style={styles.panelText}>• No events scheduled</Text>
			</View>

			<View style={styles.panel}>
				<View style={styles.panelHeader}>
					<Text style={styles.panelTitle}>Suggestions</Text>
					<TouchableOpacity onPress={loadSuggestions} style={styles.refresh}>
						{loading ? (
							<ActivityIndicator />
						) : (
							<Text style={styles.refreshText}>Refresh</Text>
						)}
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
						renderItem={renderItem}
						scrollEnabled={false}
						style={{ marginTop: 8 }}
					/>
				)}
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 24,
		flexGrow: 1,
		backgroundColor: '#fff',
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
})
