const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path'); // Ensure this is included
require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const cooldowns = new Map();
const ROLL_COOLDOWN = 300000; // 5 minutes

// Load master card list
const masterCardList = JSON.parse(fs.readFileSync('masterCardList.json'));

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Roll for a random photocard!'),
	async execute(interaction) {
		const userId = interaction.user.id;
		const username = interaction.user.username;

		// Cooldown check
		const lastUsed = cooldowns.get(userId);
		if (lastUsed && Date.now() - lastUsed < ROLL_COOLDOWN) {
			return interaction.reply({ content: '⏳ You must wait 5 minutes before rolling again!', ephemeral: true });
		}
		cooldowns.set(userId, Date.now());

		// Select 3 random cards from master list
		const selectedCards = masterCardList.sort(() => 0.5 - Math.random()).slice(0, 3);

		// Create embed for selection
		const embed = new EmbedBuilder()
			.setTitle(`${username}'s Card Roll 🎴`)
			.setDescription('Choose one of the cards below:')
			.setColor('#FFD700');

		const buttons = new ActionRowBuilder();
		const imageFiles = []; // To store the image attachments

		selectedCards.forEach((card, index) => {
			const imagePath = path.join('/Users/tchen/karina-bot/images', `${card.idol_name.toLowerCase().replace(/\s+/g, '_')}_whiplash.jpeg`);

			// Check if the image file exists
			if (fs.existsSync(imagePath)) {
				// Add card details to the embed
				embed.addFields({
					name: `${index + 1}. ${card.idol_name} (${card.collection})`,
					value: `✿ **Group**: ${card.group}\n✿ **Rarity**: ${card.rarity}`,
				});

				// Add the image to the list of files to send
				imageFiles.push({
					attachment: imagePath,
					name: `${card.idol_name.toLowerCase().replace(/\s+/g, '_')}_whiplash.jpeg`,
				});
			} else {
				// If image is not found, notify in the embed
				embed.addFields({
					name: `${index + 1}. ${card.idol_name} (${card.collection})`,
					value: `✿ **Group**: ${card.group}\n✿ **Rarity**: ${card.rarity}\n⚠️ Image not available.`,
				});
			}
		});

		// Reply with the embed and image attachments
		return interaction.reply({
			embeds: [embed],
			files: imageFiles, 
		});
	},
};
