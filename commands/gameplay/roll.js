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

			const lastRoll = user.lastRoll || 0;
			const now = Date.now();

			// 5 minutes in milliseconds
			const cooldown = 5 * 60 * 1000;

			if (now - lastRoll < cooldown) {
				const remainingTime = cooldown - (now - lastRoll);
				const minutes = Math.floor(remainingTime / 60000);
				const seconds = Math.floor((remainingTime % 60000) / 1000);
				return interaction.reply(`You can work again in ${minutes} minutes and ${seconds} seconds.`);
			}

			// Random amount between 50 and 100
			const coins = Math.floor(Math.random() * 51) + 50;
			const newBalance = (user.balance || 0) + coins;
			const updateDoc = {
				$set: {
					balance: newBalance,
					lastRoll: now,
				},
			};

			await profiles.updateOne({ discordId: userId }, updateDoc);

			return interaction.reply(`You worked and earned ${coins} coins! Your new balance is ${newBalance} coins.`);
		} finally {
			await client.close();
		}
	},
};