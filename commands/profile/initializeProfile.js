/* eslint-disable no-inline-comments */
const { SlashCommandBuilder } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

// Setup PostgreSQL Connection
const db = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT || 5432, // Default to 5432 if not provided
	ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});


/**
 * TODO: Make tables for users and photocards and whatever else i need
 */

db.connect()
	.then(() => console.log('✅ Connected to AWS RDS!'))
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
			await db.query('INSERT INTO users (user_id, username, created_at, last_claimed_coin) VALUES ($1, $2, NOW(), NOW())', [userId, username]);
			return interaction.channel.send({ content: '🎉 Profile successfully initialized! You can now start collecting photocards.', ephemeral: true });
		} catch (error) {
			console.error('Database Error:', error);
			return interaction.channel.send({ content: '❌ An error occurred while initializing your profile.', ephemeral: true });
		}
	},
};
