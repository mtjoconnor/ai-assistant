// src/constants/theme.ts
// Minimal theme constants used by starter UI.
// Expand later with tokens from design system.

export const Fonts = {
	// name -> fontFamily (replace with actual font names if you add custom fonts)
	regular: "System",
	medium: "System",
	semibold: "System",
};

export const Colors = {
	light: {
		background: "#ffffff",
		text: "#111111",
		card: "#f7f7f8",
		primary: "#1E90FF",
		accent: "#A1CEDC",
	},
	dark: {
		background: "#000000",
		text: "#ffffff",
		card: "#0f1720",
		primary: "#1E90FF",
		accent: "#1D3D47",
	},
};

// tiny helper if you want to export a default theme shape
export default {
	Fonts,
	Colors,
};

