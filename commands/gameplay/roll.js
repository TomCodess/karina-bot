/* eslint-disable no-inline-comments */
const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
				width: images.length * 300,
				height: 400,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 0 },
			},
		})
			.composite(images.map((img, i) => ({ input: img, left: i * 300, top: 0 })))
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
			return interaction.reply({ content: '⏳ You must wait 5 minutes before rolling again!', ephemeral: true });
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
		const attachment = new AttachmentBuilder(stitchedImagePath, { name: outputFileName });

		// ---- End sitching images together here ---

		// Create embed for selection
		const embed = new EmbedBuilder()
			.setTitle(`${username}'s Card Roll 🎴`)
			.setImage(`attachment://${outputFileName}`)
			.setDescription('Choose one of the cards below:')
			.setColor('#FFD700');

		const buttons = new ActionRowBuilder();

		const imageFiles = [];

		selectedCards.forEach((card, index) => {
			// Assuming your images are stored in a folder called 'images' in your project directory
		    const imagePath = path.join('/Users/tchen/karina-bot/', `${card.image}`);

			embed.addFields({
				name: `${index + 1}. ${card.idol_name} (${card.collection})`,
				value: `✿ **Group**: ${card.group}\n✿ **Rarity**: ${card.rarity}`,
			});

			const attachmentName = `${card.idol_name.toLowerCase().replace(/\s+/g, '_')}_whiplash.jpeg`;
			imageFiles.push({
				attachment: card.image,
				name: attachmentName,
			});

			// Add the image to the embed using attachment URL
			embed.addFields({
				name: `Card ${index + 1} Image`,
				value: `![${card.idol_name}](${`attachment://${attachmentName}`})`,
			});

			buttons.addComponents(
				new ButtonBuilder()
					.setCustomId(`select_card_${index}`)
					.setLabel(`Select ${index + 1}`)
					.setStyle(ButtonStyle.Primary),
			);
		});

		const message = await interaction.reply({ embeds: [embed], files: imageFiles, components: [buttons], fetchReply: true });

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
