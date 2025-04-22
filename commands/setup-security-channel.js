/**
 * @file External server request handler command
 * @module CommandModules/ExternalRequest
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ExternalServer } = require('../database/models');

module.exports = {
    /**
     * Command definition for /setup-security-channel
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('setup-security-channel')
        .setDescription('Set up a channel for sending security requests to Arcani Security')
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to use for security requests')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    
    /**
     * Executes the setup-security-channel command.
     * Allows server admins to designate a channel for security requests.
     * @param {Object} interaction The interaction object.
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const mainGuildId = process.env.GUILD_ID;
        const alertChannelId = process.env.ALERT_CHANNEL_ID;
        const securityRoleId = process.env.SECURITY_ROLE_ID;

        if (!mainGuildId || !alertChannelId || !securityRoleId) {
            console.error('Error: Missing required environment variables.');
            return interaction.reply({ content: 'Bot configuration error. Please contact Arcani Security administrators.', ephemeral: true });
        }

        const selectedChannel = interaction.options.getChannel('channel');
        
        // Verify it's a text channel
        if (!selectedChannel.isTextBased()) {
            return interaction.reply({ 
                content: 'You must select a text channel for security requests.', 
                ephemeral: true 
            });
        }

        // Check if bot has necessary permissions in the channel
        const permissions = selectedChannel.permissionsFor(interaction.client.user);
        if (!permissions.has(PermissionFlagsBits.SendMessages) || 
            !permissions.has(PermissionFlagsBits.ViewChannel) || 
            !permissions.has(PermissionFlagsBits.EmbedLinks)) {
            return interaction.reply({ 
                content: 'I need permissions to view the channel, send messages, and embed links in the selected channel.', 
                ephemeral: true 
            });
        }

        try {
            // Store the channel in the database
            await ExternalServer.upsert({
                guildId: interaction.guild.id,
                guildName: interaction.guild.name,
                channelId: selectedChannel.id,
                isActive: true,
                lastAccessed: new Date()
            });

            // Send confirmation message to the selected channel
            const infoEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Arcani Security Request Channel')
                .setDescription('This channel has been set up to send security requests to Arcani Security.')
                .addFields(
                    { name: 'How to Request Security', value: 'Use the `/request-external-security` command in this channel.' }
                )
                .setFooter({ text: 'Arcani Security Solutions' });

            await selectedChannel.send({ embeds: [infoEmbed] });

            return interaction.reply({
                content: `Successfully set up ${selectedChannel} as your security request channel. Users can now use the \`/request-external-security\` command in that channel.`,
                ephemeral: true
            });
        } catch (error) {
            console.error(`Error setting up security channel: ${error}`);
            return interaction.reply({
                content: `There was an error setting up the security channel: ${error.message}`,
                ephemeral: true
            });
        }
    },
};