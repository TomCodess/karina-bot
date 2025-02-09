/* eslint-disable no-inline-comments */
// commands/work.js

const { SlashCommandBuilder } = require('@discordjs/builders');
const { CommandInteraction } = require('discord.js');
const { Users } = require('../models'); // Assuming you have a Users model for your database

module.exports = {
	data: new SlashCommandBuilder()
		.setName('work')
		.setDescription('Work to earn coins. Can be used every 5 minutes.'),
	async execute(interaction) {
		const userId = interaction.user.id;
		const user = await Users.findOne({ where: { userId } });

		if (!user) {
			return interaction.reply('You need to set up a profile first!');
		}

		const lastWork = user.lastWork || 0;
		const now = Date.now();

		if (now - lastWork < 5 * 60 * 1000) {
			return interaction.reply('You can only use this command every 5 minutes.');
		}

		const coins = Math.floor(Math.random() * 51) + 50; // Random amount between 50 and 100
		user.balance += coins;
		user.lastWork = now;

		await user.save();

		return interaction.reply(`You worked and earned ${coins} coins! Your new balance is ${user.balance} coins.`);
	},
};