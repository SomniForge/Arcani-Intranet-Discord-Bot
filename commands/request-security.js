// commands/request-security.js
/**
 * @file Security request command
 * @module CommandModules/RequestSecurity
 */

const { SlashCommandBuilder, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, PermissionsBitField, GuildMember } = require('discord.js');

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
        .setDescription('Requests on-site security assistance.')
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
     * @param {CommandInteraction} interaction The interaction object.
     * @returns {Promise<void>}
     */
    async execute(interaction) {
        const customerRoleId = process.env.CUSTOMER_ROLE_ID;
        const securityRoleId = process.env.SECURITY_ROLE_ID;
        const alertChannelId = process.env.ALERT_CHANNEL_ID;

        if (!customerRoleId || !securityRoleId || !alertChannelId) {
            console.error('Error: Missing required environment variables for roles or channel ID.');
            return interaction.reply({ content: 'Bot configuration error. Please contact an administrator.', ephemeral: true });
        }

        // Ensure the member object is fetched
        const member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);

        // Check if the user has the customer role
        if (!member.roles.cache.has(customerRoleId)) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const location = interaction.options.getString('location');
        const details = interaction.options.getString('details') || 'No additional details provided.';
        const requester = interaction.user;

        // --- Create Embed ---
        const requestEmbed = new EmbedBuilder()
            .setColor(0xFF0000) // Red color for urgency
            .setTitle('🚨 Security Request 🚨')
            .setAuthor({ name: requester.tag, iconURL: requester.displayAvatarURL() })
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