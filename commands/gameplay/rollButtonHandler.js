const { EmbedBuilder, ActionRowBuilder } = require('discord.js');

module.exports = async function handleButtonClick(interaction, selectedCards) {
	const selectedCard = selectedCards.find(card => `[${card.rarity}] ${card.idol_name}` === interaction.customId);
	if (!selectedCard) return;

	const newEmbed = new EmbedBuilder()
		.setTitle(`${interaction.user.username}'s Selected Card ✨`)
		.setImage(`attachment://${path.basename(selectedCard.image)}`)
		.setDescription(`You selected **${selectedCard.idol_name}** from **${selectedCard.collection}**!`)
		.setColor('#FFD700');

	const updatedButtons = new ActionRowBuilder().addComponents(
		interaction.message.components[0].components.map(button => button.setDisabled(true))
	);

	await interaction.update({ embeds: [newEmbed], files: [selectedCard.image], components: [updatedButtons] });
};