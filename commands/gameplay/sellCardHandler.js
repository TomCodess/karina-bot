const { EmbedBuilder } = require('discord.js');
const { Pool } = require('pg');
require('dotenv').config();

// Setup PostgreSQL Connection
const db = new Pool({ connectionString: process.env.DATABASE_URL });

module.exports = async function handleSellCard(interaction, selectedCards) {
    console.log('THE CARD SLECTED IS ', selectedCards);
	const userId = interaction.user.id;
	const username = interaction.user.username;
	const avatarUrl = interaction.user.displayAvatarURL();

	// Generate random sell price (50-70 coins)
	const sellPrice = Math.floor(Math.random() * 21) + 50;

	try {
		// Ensure user exists in the database
		await db.query('INSERT INTO users (user_id, username, coin_balance) VALUES ($1, $2, 0) ON CONFLICT (user_id) DO NOTHING;', [userId, username]);

		// Update coin balance
		await db.query('UPDATE users SET coin_balance = coin_balance + $1 WHERE user_id = $2;', [sellPrice, userId]);

		// Get updated balance
		const result = await db.query('SELECT coin_balance FROM users WHERE user_id = $1;', [userId]);
		const newBalance = result.rows[0].coin_balance;

		// Create embedded message
		const embed = new EmbedBuilder()
			.setColor('#00FF00')
			.setTitle('Card Sold!')
			.setDescription(`${username} has sold a card for **${sellPrice}** coins!`)
			.setThumbnail(avatarUrl)
			.addFields(
				{ name: 'New Balance', value: `${newBalance} coins`, inline: true },
			)
			.setTimestamp();

		// files: [] is needed to remove the image attachment, components: [] is needed to remove the button
		await interaction.update({ embeds: [embed], files:[], components: [] });
	} catch (error) {
		console.error('Database Error:', error);
		return interaction.reply({ content: '❌ An error occurred while selling the card.', ephemeral: true });
	}
};
