/* eslint-disable no-inline-comments */
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

require('dotenv').config();

const db = new Pool({ connectionString: process.env.DATABASE_URL });
const cooldowns = new Map();
const ROLL_COOLDOWN = 300000; // 5 minutes

const outputFolder = path.join(__dirname, '../../output_pics'); // Folder for output images

// Load master card list
const masterCardList = JSON.parse(fs.readFileSync('masterCardList.json'));

// Function to get a random selection of images from image folder
function getRandomCards() {
	const selectedCards = masterCardList.sort(() => 0.5 - Math.random()).slice(0, 3);
	return selectedCards;
}

// Function to stitch images horizontally - NEEEDS TO BE used
async function stitchImagesHorizontally(imagePaths, outputPath) {
	try {
		const images = await Promise.all(imagePaths.map(img => sharp(img).resize(300, 400).toBuffer()));

		await sharp({
			create: {
				width: images.length * 900,
				height: 500,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 0 },
			},
		})
			.composite(images.map((img, i) => ({ input: img, left: i * 500, top: 0 })))
			.toFormat('webp') // Use WebP for high quality
			.png({ quality: 100 })
			.toFile(outputPath);

		return outputPath; // Return path for Discord upload
	} catch (error) {
		console.error('Error stitching images:', error);
		return null;
	}
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('roll')
		.setDescription('Roll for a random photocard!'),
	async execute(interaction) {
		const userId = interaction.user.id;
		const username = interaction.user.username;

		// Cooldown check
		const lastUsed = cooldowns.get(userId);
		if (lastUsed && Date.now() - lastUsed < ROLL_COOLDOWN) {
			return interaction.channel.send({ content: '⏳ You must wait 5 minutes before rolling again!', ephemeral: true });
		}
		cooldowns.set(userId, Date.now());


		const selectedCards = getRandomCards();

		// ---- Start sitching images together here ---
		// Extract image paths
		const imagePaths = selectedCards.map(card => card.image);
		const outputFileName = `stitched_${Date.now()}.png`;
		const outputPath = path.join(outputFolder, outputFileName);

		// Generate stitched image
		const stitchedImagePath = await stitchImagesHorizontally(imagePaths, outputPath);
		if (!stitchedImagePath) return interaction.reply({ content: '❌ Failed to generate image.', ephemeral: true });

		// Attach image to message -- IDK IF I NEED THIS --
		const file = new AttachmentBuilder(stitchedImagePath, { name: outputFileName });

		// ---- End sitching images together here ---

		// Create embed for selection
		const embed = new EmbedBuilder()
			.setTitle(`${username}'s Card Roll 🎴`)
			.setImage(`attachment://${outputFileName}`)
			.setDescription('Choose one of the cards below:')
			.setColor('#FFD700');

		const buttons = new ActionRowBuilder();

		selectedCards.forEach((card, index) => {

			// embed.addFields({
			// 	name: `${index + 1}. ${card.idol_name} (${card.collection})`,
			// 	value: `✿ **Group**: ${card.group}\n✿ **Rarity**: ${card.rarity}`,
			// });

			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId(`select_card_${index}`)
					.setLabel(`Select ${index + 1}`)
					.setStyle(ButtonStyle.Primary),
			);
		});

		const message = await interaction.reply({ embeds: [embed], files: [file], components: [buttons], fetchReply: true });
		// Automatically delete the stitched image after sending
		setTimeout(() => {
			fs.unlink(stitchedImagePath, (err) => {
				if (err) console.error('Error deleting stitched image:', err);
				else console.log('✅ Stitched image deleted:', stitchedImagePath);
			});
		}, 5000);

		const collector = message.createMessageComponentCollector({ time: 60000 });
		collector.on('collect', async (buttonInteraction) => {
			if (buttonInteraction.user.id !== userId) {
				return buttonInteraction.reply({ content: 'This selection isn\'t for you!', ephemeral: true });
			}

			const selectedIndex = parseInt(buttonInteraction.customId.split('_')[2]);
			const selectedCard = selectedCards[selectedIndex];

			// Insert card into inventory
			await db.query('INSERT INTO user_inventory (user_id, idol_name, rarity, collection, group, copies) VALUES ($1, $2, $3, $4, $5, 1) ON CONFLICT (user_id, idol_name, collection) DO UPDATE SET copies = user_inventory.copies + 1;',
				[userId, selectedCard.idol_name, selectedCard.rarity, selectedCard.collection, selectedCard.group]);

			// Show final selection
			const finalEmbed = new EmbedBuilder()
				.setTitle(`You selected ${selectedCard.idol_name}!`)
				.setImage(selectedCard.image)
				.setColor('#FFD700');

			const binderCheck = await db.query('SELECT * FROM user_binder WHERE user_id = $1 AND idol_name = $2 AND collection = $3;', [userId, selectedCard.idol_name, selectedCard.collection]);

			const finalButtons = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('add_to_binder')
					.setLabel(binderCheck.rows.length ? 'Already in Binder' : 'Add to Binder')
					.setStyle(ButtonStyle.Success)
					.setDisabled(binderCheck.rows.length > 0),
				new ButtonBuilder()
					.setCustomId('sell_card')
					.setLabel('Sell')
					.setStyle(ButtonStyle.Danger),
			);

			await buttonInteraction.update({ embeds: [finalEmbed], components: [finalButtons] });
		});
	},
};
