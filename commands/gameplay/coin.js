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
		.setName('coin')
		.setDescription('Work to earn coins. Can be used every 5 minutes.'),
	async execute(interaction) {
		const userId = interaction.user.id;
		const username = interaction.user.username;

		try {
			// Check if the user exists in the database
			const checkUser = await db.query('SELECT * FROM users WHERE user_id = $1', [userId]);
			if (checkUser.rows.length === 0) {
				// If user doesn't exist, initialize their profile (with 0 coins and no claim time)
				await db.query('INSERT INTO users (user_id, username, created_at, coin_balance, last_claimed) VALUES ($1, $2, NOW(), 0, NOW())', [userId, username]);
			}

			// Get the user's last claimed time and coin balance
			const { last_claimed, coin_balance } = checkUser.rows[0];
			const lastClaimTime = new Date(last_claimed);
			const currentTime = new Date();

			// Check if 5 minutes have passed since the last claim
			if (currentTime - lastClaimTime < 5 * 60 * 1000) {
				// If it's been less than 5 minutes
				const timeRemaining = Math.ceil((5 * 60 * 1000 - (currentTime - lastClaimTime)) / 1000);
				return interaction.reply({ content: `⏳ You can claim your coins again in ${timeRemaining} seconds.` });
			}

			// Generate a random number between 1 and 10 for the coin reward
			const coinsToAdd = Math.floor(Math.random() * 10) + 1;

			// Update the user's coin balance and set the last claimed time
			await db.query(
				'UPDATE users SET coin_balance = coin_balance + $1, last_claimed = NOW() WHERE user_id = $2',
				[coinsToAdd, userId],
			);

			return interaction.reply({ content: `🎉 You claimed ${coinsToAdd} coins! Your new balance is ${coin_balance + coinsToAdd} coins.` });
		} catch (error) {
			console.error('Database Error:', error);
			return interaction.channel.send({ content: '❌ An error occurred while using the command.', ephemeral: true });
		}
	},
};
