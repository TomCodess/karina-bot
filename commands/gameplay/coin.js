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
			if (checkUser.rows.length <= 0) {
				return interaction.reply({ content: 'You are not registered! Please use /initializeprofile to begin. ', ephemeral: true });
			}

			// Get the user's last claimed time and coin balance
			const { last_claimed_coin, coin_balance } = checkUser.rows[0];
			const lastClaimTime = new Date(last_claimed_coin);
			const currentTime = new Date();

			// Check if 10 seconds have passed since the last claim
			if (currentTime - lastClaimTime > 10 * 1000) {
				// If it's been less than 10 seconds
				const timeRemaining = Math.ceil((10 * 1000 - (currentTime - lastClaimTime)) / 1000);
				return interaction.reply({ content: `⏳ You can claim your coins again in ${timeRemaining} seconds.` });
			}

			// Generate a random number between 1 and 10 for the coin reward
			const coinsToAdd = Math.floor(Math.random() * 10) + 1;

			// Update the user's coin balance and set the last claimed time
			await db.query(
				'UPDATE users SET coin_balance = coin_balance + $1, last_claimed_coin = NOW() WHERE user_id = $2',
				[coinsToAdd, userId],
			);

			return interaction.reply({ content: `🎉 You claimed ${coinsToAdd} coins! Your new balance is ${coin_balance + coinsToAdd} coins.` });
		} catch (error) {
			console.error('Database Error:', error);
			return interaction.channel.send({ content: '❌ An error occurred while using the command.', ephemeral: true });
		}
	},
};
