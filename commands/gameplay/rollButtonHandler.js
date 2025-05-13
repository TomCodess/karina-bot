const { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const handleSellCard = require('./sellCardHandler');


module.exports = async function handleButtonClick(interaction, selectedCards, userId) {
	const selectedCard = selectedCards.find(card => `[${card.rarity}] ${card.idol_name}` === interaction.customId);
	if (!selectedCard) return;

	const newEmbed = new EmbedBuilder()
		.setTitle(`${interaction.user.username}'s Selected Card ✨`)
		.setImage(`attachment://${path.basename(selectedCard.image)}`)
		.setDescription(`You selected **${selectedCard.idol_name}** from **${selectedCard.collection}**!`)
		.setColor('#FFD700');

	/**
	 * NEED TO ADD HERE LATER Logic for binder system.
	 * Might need to abstract this function out as well
	 * Make new file, make new table on DB
	 * Going to call invenotry system, binder system
	 * 		- Add card to binder
	 * 		- Remove card from binder
	 * 		- View binder
	 * 		- Sell card from binder
	 * 		- View all cards in binder
	 * 
	 */

	const sellButton = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId('sell_card')
			.setLabel('💰 Sell Card')
			.setStyle(ButtonStyle.Success),
	);

	await interaction.update({ embeds: [newEmbed], files: [selectedCard.image], components: [sellButton] });

	const message = await interaction.fetchReply();

	// **Listen for button interactions in the same function**
	const filter = (btnInteraction) => {
		return btnInteraction.isButton() && btnInteraction.message.id === message.id && btnInteraction.user.id === userId;
	};

	// 1-minute time to decide to sell
	const sell = message.createMessageComponentCollector({ filter, time: 60000 });

	// When sell is selected, on collect is discord equivalent of on click.
	sell.on('collect', async (btnInteraction) => {
		console.log('Selling card...');
		await handleSellCard(btnInteraction, selectedCard);
	});


};