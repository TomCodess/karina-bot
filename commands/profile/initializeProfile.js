const { SlashCommandBuilder } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

// Setup PostgreSQL Connection
const db = new Pool({ connectionString: process.env.DATABASE_URL });

db.connect()
	.then(() => console.log('✅ Connected to Neon PostgreSQL'))
	.catch(err => console.error('❌ Database Connection Error:', err));

module.exports = {
	data: new SlashCommandBuilder()
		.setName('initializeprofile')
		.setDescription('Initializes your profile for the photocard trading system.'),
	async execute(interaction) {
		const userId = interaction.user.id;
		const username = interaction.user.username;

		try {
			// Check if the user already exists
			const checkUser = await db.query('SELECT * FROM users WHERE user_id = $1', [userId]);
			if (checkUser.rows.length > 0) {
				return interaction.reply({ content: '✅ You are already registered!', ephemeral: true });
			}

			// Insert new user into database
			await db.query('INSERT INTO users (user_id, username, created_at) VALUES ($1, $2, NOW())', [userId, username]);
			return interaction.reply({ content: '🎉 Profile successfully initialized! You can now start collecting photocards.', ephemeral: true });
		} catch (error) {
			console.error('Database Error:', error);
			return interaction.reply({ content: '❌ An error occurred while initializing your profile.', ephemeral: true });
		}
	},
};
