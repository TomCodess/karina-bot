const { SlashCommandBuilder } = require('@discordjs/builders');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Roll for cards. Can be used every 5 minutes.'),
	async execute(interaction) {
		const uri = process.env.MONGODB_CONNECTION_STRING;
		// Connnect to MongoDB
		const client = new MongoClient(uri, {
			serverApi: {
				version: ServerApiVersion.v1,
				strict: true,
				deprecationErrors: true,
			},
		});

		try {
			await client.connect();
			const database = client.db('discordBot');
			const profiles = database.collection('profiles');

			const userId = interaction.user.id;
			const user = await profiles.findOne({ discordId: userId });

			if (!user) {
				return interaction.reply('You need to set up a profile first!');
			}


			await profiles.updateOne({ discordId: userId }, updateDoc);

			return interaction.reply(`You worked and earned ${coins} coins! Your new balance is ${newBalance} coins.`);
		} finally {
			await client.close();
		}
	},
};