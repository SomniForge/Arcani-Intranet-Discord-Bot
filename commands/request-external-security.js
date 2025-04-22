/**
 * @file External security request command
 * @module CommandModules/ExternalSecurityRequest
 */

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { ExternalServer, SecurityRequest } = require('../database/models');

module.exports = {
    /**
     * Command definition for /request-external-security
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('request-external-security')
        .setDescription('Request security assistance from Arcani Security')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('The location where security is needed.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('details')
                .setDescription('Details about the situation.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('contact')
                .setDescription('Contact information (phone, email, etc.)')
                .setRequired(true)),
    
    /**
     * Executes the request-external-security command.
     * Allows users in external servers to send security requests to the main server.
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

        try {
            // Check if this server is registered in our database
            const externalServer = await ExternalServer.findByPk(interaction.guild.id);
            if (!externalServer) {
                return interaction.reply({
                    content: 'This server has not been set up for security requests. An administrator needs to use the `/setup-security-channel` command first.',
                    ephemeral: true
                });
            }

            // Check if the command is being used in the designated channel
            if (interaction.channelId !== externalServer.channelId) {
                return interaction.reply({
                    content: `You can only use this command in the designated security request channel: <#${externalServer.channelId}>`,
                    ephemeral: true
                });
            }

            // Update the lastAccessed timestamp
            externalServer.lastAccessed = new Date();
            await externalServer.save();

            const location = interaction.options.getString('location');
            const details = interaction.options.getString('details');
            const contact = interaction.options.getString('contact');
            const requester = interaction.user;
            const sourceGuild = interaction.guild.name;

            // --- Create local confirmation embed ---
            const localEmbed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('Security Request Sent')
                .addFields(
                    { name: 'Location', value: location },
                    { name: 'Details', value: details },
                    { name: 'Contact', value: contact },
                    { name: 'Status', value: 'Your request has been sent to Arcani Security' }
                )
                .setTimestamp()
                .setFooter({ text: `Request ID: ${interaction.id}` });

            // --- Create remote request embed for the security server ---
            const remoteEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 External Security Request 🚨')
                .setAuthor({ name: `${requester.tag} from ${sourceGuild}`, iconURL: requester.displayAvatarURL() })
                .addFields(
                    { name: 'Source Server', value: sourceGuild },
                    { name: 'Location', value: location },
                    { name: 'Details', value: details },
                    { name: 'Contact', value: contact },
                    { name: 'Requester', value: `${requester.tag} (${requester.id})` },
                    { name: 'Responding Security', value: 'None yet.' }
                )
                .setTimestamp()
                .setFooter({ text: `Request ID: ${interaction.id}` });

            // --- Create response buttons ---
            const respondButton = new ButtonBuilder()
                .setCustomId(`extrespond_${interaction.id}_${interaction.guild.id}`)
                .setLabel('Respond')
                .setStyle(ButtonStyle.Success)
                .setEmoji('✅');

            const concludeButton = new ButtonBuilder()
                .setCustomId(`extconclude_${interaction.id}_${interaction.guild.id}`)
                .setLabel('Conclude Request')
                .setStyle(ButtonStyle.Danger)
                .setEmoji('✖️');

            const row = new ActionRowBuilder()
                .addComponents(respondButton, concludeButton);

            // First, reply to the command user in their server
            await interaction.reply({
                content: 'Your security request is being processed...',
                ephemeral: true
            });

            // Send the local confirmation to the channel
            const localMessage = await interaction.channel.send({
                embeds: [localEmbed]
            });

            // Find the main guild and alert channel
            const mainGuild = interaction.client.guilds.cache.get(mainGuildId);
            if (!mainGuild) {
                console.error(`Error: Could not find the main guild with ID ${mainGuildId}`);
                await interaction.followUp({
                    content: 'Failed to send your request to Arcani Security. Please contact them directly.',
                    ephemeral: true
                });
                return;
            }

            const alertChannel = await mainGuild.channels.fetch(alertChannelId);
            if (!alertChannel) {
                console.error(`Error: Could not find the alert channel with ID ${alertChannelId}`);
                await interaction.followUp({
                    content: 'Failed to send your request to Arcani Security. Please contact them directly.',
                    ephemeral: true
                });
                return;
            }

            // Send the request to the security server
            const securityMessage = await alertChannel.send({
                content: `<@&${securityRoleId}> New security request from external server ${sourceGuild}!`,
                embeds: [remoteEmbed],
                components: [row]
            });

            // Store the request in the database
            await SecurityRequest.create({
                requestId: interaction.id,
                isExternal: true,
                requesterId: requester.id,
                requesterName: requester.tag,
                location: location,
                details: details,
                contact: contact,
                externalGuildId: interaction.guild.id,
                externalMessageId: localMessage.id,
                securityMessageId: securityMessage.id,
                status: 'pending',
                responders: []
            });

            // Update the ephemeral reply
            await interaction.followUp({
                content: 'Your security request has been sent successfully!',
                ephemeral: true
            });

        } catch (error) {
            console.error(`Error sending external security request: ${error}`);
            await interaction.followUp({
                content: `Error sending your security request: ${error.message}`,
                ephemeral: true
            });
        }
    },
};