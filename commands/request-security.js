// commands/request-security.js
/**
 * @file Security request command
 * @module CommandModules/RequestSecurity
 * @description Allows customers in the main Arcani security server to request on-site security assistance.
 * This command is ONLY intended for use within the main Arcani Discord server, not external customer servers.
 * It creates an alert in the configured security channel and allows security personnel to respond.
 */

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, GuildMember } = require('discord.js');
const { getCustomerRoleId, getSecurityRoleId, getAlertChannelId } = require('../database/server-config-utils');

/**
 * @typedef {Object} CommandInteraction
 * @description Discord.js CommandInteraction object
 */

/**
 * @typedef {Object} GuildMember
 * @description Discord.js GuildMember object
 */

module.exports = {
    /**
     * Command definition for /request-security
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('request-security')
        .setDescription('Request on-site security assistance (Arcani Discord only)')
        .addStringOption(option =>
            option.setName('location')
                .setDescription('The location where security is needed.')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('details')
                .setDescription('Optional details about the situation.')
                .setRequired(false)),
    /**
     * Executes the request-security command.
     * Checks user permissions, creates an embed and buttons, and sends an alert to the designated channel.
     * This command is only intended for use within the main Arcani Discord server.
     * @param {CommandInteraction} interaction The interaction object.
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        // Check if this is the main Arcani security server
        const mainGuildId = process.env.GUILD_ID;
        if (interaction.guild.id !== mainGuildId) {
            return interaction.reply({ 
                content: '⚠️ This command is only for use within the main Arcani security server. If you are in a customer server and need security assistance, please use `/request-external-security` instead.',
                ephemeral: true 
            });
        }

        // Fetch configuration from database
        const customerRoleId = await getCustomerRoleId(interaction.guild.id);
        const securityRoleId = await getSecurityRoleId(interaction.guild.id);
        const alertChannelId = await getAlertChannelId(interaction.guild.id);

        if (!customerRoleId || !securityRoleId || !alertChannelId) {
            console.error(`Error: Missing required configuration for server ${interaction.guild.id}.`);
            return interaction.reply({ 
                content: 'This server is not fully configured for security requests. An administrator needs to set up the customer role, security role, and alert channel using the /config-server command.',
                ephemeral: true 
            });
        }

        // Ensure the member object is fetched
        const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);

        // Check if the user has the customer role
        if (!member.roles.cache.has(customerRoleId)) {
            return interaction.reply({ 
                content: `You do not have permission to use this command. You need the <@&${customerRoleId}> role to request security assistance.`, 
                ephemeral: true 
            });
        }

        const location = interaction.options.getString('location');
        const details = interaction.options.getString('details') || 'No additional details provided.';
        const requester = interaction.user;

        // --- Create Embed ---
        const requestEmbed = new EmbedBuilder()
            .setColor(0xFF0000) // Red color for urgency
            .setTitle('🚨 Security Request 🚨')
            .setAuthor({ name: requester.tag || requester.username, iconURL: requester.displayAvatarURL() })
            .addFields(
                { name: 'Location', value: location },
                { name: 'Details', value: details },
                { name: 'Requested By', value: `${requester}` }, // Mentions the user
                { name: 'Responding Security', value: 'None yet.' }
            )
            .setTimestamp()
            .setFooter({ text: `Request ID: ${interaction.id}` }); // Use interaction ID as a unique request ID

        // --- Create Buttons ---
        const respondButton = new ButtonBuilder()
            .setCustomId(`respond_${interaction.id}`) // Unique ID for this request's button
            .setLabel('Respond')
            .setStyle(ButtonStyle.Success)
            .setEmoji('✅');

        const concludeButton = new ButtonBuilder()
            .setCustomId(`conclude_${interaction.id}`)
            .setLabel('Conclude Request')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('✖️');

        const row = new ActionRowBuilder()
            .addComponents(respondButton, concludeButton);

        // --- Send to Alert Channel ---
        try {
            const alertChannel = await interaction.client.channels.fetch(alertChannelId);
            if (!alertChannel || !alertChannel.isTextBased()) {
                 console.error(`Error: Alert channel (${alertChannelId}) not found or is not a text channel.`);
                 return interaction.reply({ content: 'Could not find the security alert channel. Please contact an administrator.', ephemeral: true });
            }

            // Check bot permissions in the alert channel
            const botPermissions = alertChannel.permissionsFor(interaction.client.user);
            if (!botPermissions || !botPermissions.has(PermissionsBitField.Flags.SendMessages) || !botPermissions.has(PermissionsBitField.Flags.EmbedLinks)) {
                 console.error(`Error: Bot lacks SendMessages or EmbedLinks permission in channel ${alertChannelId}.`);
                 return interaction.reply({ content: 'I do not have permission to send messages or embeds in the alert channel.', ephemeral: true });
            }

            await alertChannel.send({
                content: `<@&${securityRoleId}> New security request!`, // Ping the security role
                embeds: [requestEmbed],
                components: [row]
            });

            await interaction.reply({ content: 'Your security request has been sent to the alert channel.', ephemeral: true });

        } catch (error) {
            console.error('Error sending security request alert:', error);
            await interaction.reply({ content: 'There was an error sending the security request. Please try again or contact an administrator.', ephemeral: true });
        }
    },
};