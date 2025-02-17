/* eslint-disable no-inline-comments */
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

// Setup PostgreSQL Connection
const db = new Pool({ connectionString: process.env.DATABASE_URL });

// Cooldown tracking
const cooldowns = new Map();
const COOLDOWN_TIME = 5000; // 5 seconds

module.exports = {
	data: new SlashCommandBuilder()
		.setName('coin')
		.setDescription('Earn coins every 5 seconds (10-50 coins per use).'),
	async execute(interaction) {
		const userId = interaction.user.id;
		const username = interaction.user.username;
		const avatarUrl = interaction.user.displayAvatarURL();

		// Check cooldown
		const lastUsed = cooldowns.get(userId);
		if (lastUsed && Date.now() - lastUsed < COOLDOWN_TIME) {
			const timeRemainingMs = COOLDOWN_TIME - (Date.now() - lastUsed);
			const minutes = Math.floor(timeRemainingMs / 60000);
			const seconds = Math.ceil((timeRemainingMs % 60000) / 1000);

			return interaction.reply({
				content: `⏳ You must wait ${minutes}m ${seconds}s before using /coin again!`,
				ephemeral: true,
			});
		}
		cooldowns.set(userId, Date.now());

		// Generate random coin amount (10-50)
		const coinsEarned = Math.floor(Math.random() * 41) + 10;

		try {
			// Ensure user exists in the database
			await db.query('INSERT INTO users (user_id, username, coin_balance) VALUES ($1, $2, 0) ON CONFLICT (user_id) DO NOTHING;', [userId, username]);

			// Update coin balance
			await db.query('UPDATE users SET coin_balance = coin_balance + $1 WHERE user_id = $2;', [coinsEarned, userId]);

			// Get updated balance
			const result = await db.query('SELECT coin_balance FROM users WHERE user_id = $1;', [userId]);
			const newBalance = result.rows[0].coin_balance;

			// Create embedded message
			const embed = new EmbedBuilder()
				.setColor('#FFD700')
				.setTitle('💰 Coin Earned!')
				.setDescription(`${username} has worked and earned **${coinsEarned}** coins!`)
				.setThumbnail(avatarUrl)
				.addFields(
					{ name: 'New Balance', value: `${newBalance} coins`, inline: true },
				)
				.setTimestamp();

			return interaction.reply({ embeds: [embed] });
		} catch (error) {
			console.error('Database Error:', error);
			return interaction.reply({ content: '❌ An error occurred while earning coins.', ephemeral: true });
		}
	},
};