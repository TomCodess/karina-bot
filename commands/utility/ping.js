const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('karina')
		.setDescription('Replies with so hot!'),
	async execute(interaction) {
		await interaction.reply('is so hot!:fire:');
	},
};