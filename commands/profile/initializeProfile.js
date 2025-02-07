const { SlashCommandBuilder } = require('@discordjs/builders');
const { MongoClient } = require('mongodb');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('initializeprofile')
		.setDescription('Initializes your profile in the database'),
	async execute(interaction) {
		const uri = process.env.MONGODB_CONNECTION_STRING;
		const client = new MongoClient(uri, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			}
		});

		try {
			await client.connect();
			const database = client.db('discordBot');
			const profiles = database.collection('profiles');

			const userId = interaction.user.id;
			const existingProfile = await profiles.findOne({ discordId: userId });

			if (existingProfile) {
				await interaction.reply('You already have a profile!');
			} else {
				const newProfile = {
					discordId: userId,
					joinedBotDate: new Date(),
					bio: '',
					balance: 0,
					inventory: [],
				};

				await profiles.insertOne(newProfile);
				await interaction.reply('Your profile has been initialized!');
			}
		} catch (error) {
			console.error(error);
			await interaction.reply('There was an error initializing your profile.');
		} finally {
			await client.close();
		}
	},
};