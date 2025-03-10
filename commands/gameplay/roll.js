/* eslint-disable no-inline-comments */
const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const handleButtonClick = require('./rollButtonHandler');


require('dotenv').config();

// Setup PostgreSQL Connection
const db = new Pool({
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
	password: process.env.DB_PASSWORD,
	database: process.env.DB_NAME,
	port: process.env.DB_PORT || 5432, // Default to 5432 if not provided
	ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
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
		const width = 900; // Width of each card
		const height = 1200; // Height of each card
		const gap = 20; // Gap between images

		// Ensure all images are resized to the same dimensions
		const images = await Promise.all(
			imagePaths.map(img => sharp(img).resize(width, height).toBuffer()),
		);

		// Calculate total width (accounting for gaps)
		const totalWidth = images.length * width + (images.length - 1) * gap;

		// Create a base image of correct size
		const canvas = sharp({
			create: {
				width: totalWidth,
				height: height,
				channels: 4,
				background: { r: 255, g: 255, b: 255, alpha: 0 }, // Transparent background
			},
		});

		// Composite images onto the canvas with gaps
		await canvas
			.composite(
				images.map((img, i) => ({
					input: img,
					left: i * (width + gap), // Shift each image with gap included
					top: 0,
				})),
			)
			.toFormat('webp') // Use WebP for high quality
			.webp({ quality: 100 }) // Max quality
			.toFile(outputPath);

		return outputPath;
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

		// *** Start sitching images together here ***
		// Extract image paths
		const imagePaths = selectedCards.map(card => card.image);
		const outputFileName = `stitched_${Date.now()}.png`;
		const outputPath = path.join(outputFolder, outputFileName);

		// Generate stitched image
		const stitchedImagePath = await stitchImagesHorizontally(imagePaths, outputPath);
		if (!stitchedImagePath) return interaction.reply({ content: '❌ Failed to generate image.', ephemeral: true });

		// Attach image to message -- needed for await interaction.reply --
		const file = new AttachmentBuilder(stitchedImagePath, { name: outputFileName });

		// *** End sitching images together here ***

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
					.setCustomId(`[${card.rarity}] ${card.idol_name}`)
					.setLabel(`[${card.rarity}] ${card.idol_name}`)
					.setStyle(ButtonStyle.Primary),
			);
		});

		await interaction.reply({ embeds: [embed], files: [file], components: [buttons] });

		const message = await interaction.fetchReply();


		// Store roll data in message metadata **UNUSED**
		// const rollData = { selectedCards, message, userId };

		// Automatically delete the stitched image after sending
		setTimeout(() => {
			fs.unlink(stitchedImagePath, (err) => {
				if (err) console.error('Error deleting stitched image:', err);
				else console.log('✅ Stitched image deleted:', stitchedImagePath);
			});
		}, 5000);

		// **Listen for button interactions in the same function**
		const filter = (btnInteraction) => {
			console.log('FIRST Filtering button interactions...');
			return btnInteraction.isButton() && btnInteraction.message.id === message.id && btnInteraction.user.id === userId;
		};

		// 1-minute time to collect
		const collector = message.createMessageComponentCollector({ filter, time: 60000 });

		// When a card is selected
		collector.on('collect', async (btnInteraction) => {
			await handleButtonClick(btnInteraction, selectedCards, userId);

		});

	},
};
