/**
 * @file External security request command
 * @module CommandModules/ExternalSecurityRequest
 * @description Allows users in external (customer) servers to request security assistance
 * from the main Arcani Security server. This command creates a request that appears both
 * in the external server and in the alert channel of the main security server.
 */

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { ExternalServer, SecurityRequest } = require('../database/models');
const { markServerActive } = require('../database/server-utils');
const { getSecurityRoleId, getAlertChannelId, getServerConfig } = require('../database/server-config-utils');

module.exports = {
    /**
     * Command definition for /request-external-security
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('request-external-security')
        .setDescription('Request security assistance from VIG Security')
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
     * @example
     * // Example usage:
     * // /request-external-security location:North Building details:Suspicious activity in parking lot contact:Extension 4422
     * // 
     * // This creates:
     * // 1. A confirmation message in the external server
     * // 2. A request in the main security server with buttons for personnel to respond
     * // 3. A database entry tracking the request status
     */
    async execute(interaction) {
        // Get the main guild ID from the guild with primary server configuration
        const mainGuildId = process.env.GUILD_ID;
        
        // Fetch alertChannelId and securityRoleId from the main guild's configuration
        const alertChannelId = await getAlertChannelId(mainGuildId);
        const securityRoleId = await getSecurityRoleId(mainGuildId);

        if (!mainGuildId || !alertChannelId || !securityRoleId) {
            console.error('Error: Missing required configuration in main server.');
            return interaction.reply({ 
                content: 'The main security server is not fully configured. Please contact VIG Security administrators.',
                ephemeral: true 
            });
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
            
            // Check if role requirements exist and if the user has one of the required roles
            const allowedRoleIds = externalServer.allowedRoleIds || [];
            if (allowedRoleIds.length > 0) {
                const memberRoles = interaction.member.roles.cache;
                const hasRequiredRole = memberRoles.some(role => allowedRoleIds.includes(role.id));
                
                if (!hasRequiredRole) {
                    // Get the role names for a more helpful error message
                    const roleNames = allowedRoleIds
                        .map(id => {
                            const role = interaction.guild.roles.cache.get(id);
                            return role ? `<@&${id}>` : `Unknown Role (${id})`;
                        })
                        .join(', ');
                    
                    return interaction.reply({
                        content: `You do not have permission to use this command. You need one of these roles: ${roleNames}`,
                        ephemeral: true
                    });
                }
            }

            // Mark server as active and update lastAccessed timestamp
            await markServerActive(interaction.guild.id);

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
                    { name: 'Status', value: 'Your request has been sent to VIG Security' }
                )
                .setTimestamp()
                .setFooter({ text: `Request ID: ${interaction.id}` });

            // --- Create remote request embed for the security server ---
            const remoteEmbed = new EmbedBuilder()
                .setColor(0xFF0000)
                .setTitle('🚨 External Security Request 🚨')
                .setAuthor({ name: `${requester.tag || requester.username} from ${sourceGuild}`, iconURL: requester.displayAvatarURL() })
                .addFields(
                    { name: 'Source Server', value: sourceGuild },
                    { name: 'Location', value: location },
                    { name: 'Details', value: details },
                    { name: 'Contact', value: contact },
                    { name: 'Requester', value: `${requester.tag || requester.username} (${requester.id})` },
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
                    content: 'Failed to send your request to VIG Security. Please contact them directly.',
                    ephemeral: true
                });
                return;
            }

            // Check if the bot is a member of the main guild
            try {
                await mainGuild.members.fetch(interaction.client.user.id);
            } catch (error) {
                console.error(`Bot is not a member of the main security guild: ${error.message}`);
                await interaction.followUp({
                    content: 'Security server configuration error: Bot is not a member of the main security server. Please contact your administrator.',
                    ephemeral: true
                });
                return;
            }

            let alertChannel;
            try {
                alertChannel = await mainGuild.channels.fetch(alertChannelId);
                if (!alertChannel) {
                    throw new Error('Channel not found');
                }
                
                // Verify bot has access to the channel
                const botMember = await mainGuild.members.fetch(interaction.client.user.id);
                const permissions = alertChannel.permissionsFor(botMember);
                
                if (!permissions.has('ViewChannel') || !permissions.has('SendMessages')) {
                    throw new Error('Missing permissions in alert channel');
                }
            } catch (error) {
                console.error(`Error accessing the alert channel: ${error.message}`);
                await interaction.followUp({
                    content: 'Failed to send your request to VIG Security. The bot does not have proper access to the security channel.',
                    ephemeral: true
                });
                return;
            }

            // Send the request to the security server
            let securityMessage;
            try {
                securityMessage = await alertChannel.send({
                    content: `<@&${securityRoleId}> New security request from external server ${sourceGuild}!`,
                    embeds: [remoteEmbed],
                    components: [row]
                });
            } catch (error) {
                console.error(`Error sending message to security channel: ${error.message}`);
                await interaction.followUp({
                    content: 'Failed to send your request to VIG Security due to a permissions issue. Please contact your security company administrator.',
                    ephemeral: true
                });
                return;
            }

            // Store the request in the database
            try {
                await SecurityRequest.create({
                    requestId: interaction.id,
                    isExternal: true,
                    requesterId: requester.id,
                    requesterName: requester.tag || requester.username,
                    location: location,
                    details: details,
                    contact: contact,
                    externalGuildId: interaction.guild.id,
                    externalMessageId: localMessage.id,
                    securityMessageId: securityMessage ? securityMessage.id : null,
                    status: 'pending',
                    responders: JSON.stringify([])  // Store as JSON string for SQLite compatibility
                });
            } catch (error) {
                console.error(`Error storing security request in database: ${error.message}`);
                // Continue execution - the request has been sent even if DB storage fails
            }

            // Update the ephemeral reply
            await interaction.followUp({
                content: 'Your security request has been sent successfully!',
                ephemeral: true
            });

        } catch (error) {
            console.error(`Error sending external security request: ${error}`);
            try {
                // Check if the interaction has already been replied to
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: `Error sending your security request: ${error.message}`,
                        ephemeral: true
                    });
                } else {
                    await interaction.reply({
                        content: `Error sending your security request: ${error.message}`,
                        ephemeral: true
                    });
                }
            } catch (replyError) {
                console.error(`Failed to send error reply: ${replyError.message}`);
            }
        }
    },
};