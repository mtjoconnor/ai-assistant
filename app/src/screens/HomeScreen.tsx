import React from "react"
import { ScrollView, View, Text, StyleSheet } from "react-native"

export default function HomeScreen() {
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
				<Text style={styles.panelTitle}>Suggestions</Text>
				<Text style={styles.panelText}>• No suggestions yet</Text>
			</View>
		</ScrollView>
	)
}

const styles = StyleSheet.create({
	container: {
		padding: 24,
		flexGrow: 1,
		backgroundColor: "#fff"
	},
	title: {
		fontSize: 28,
		fontWeight: "700",
		marginBottom: 8
	},
	subtitle: {
		fontSize: 14,
		marginBottom: 20,
		color: "#444"
	},
	panel: {
		padding: 16,
		borderRadius: 12,
		borderWidth: 1,
		borderColor: "#eee",
		marginBottom: 12
	},
	panelTitle: {
		fontWeight: "600",
		marginBottom: 6
	},
	panelText: {
		fontSize: 14,
		color: "#333"
	}
})
