/**
 * @file External server listing command
 * @module CommandModules/ListExternalServers
 * @description Lists all external servers configured to use the security request system with details 
 * about their status (active/inactive), number of pending requests, and last activity time. Servers are 
 * automatically marked inactive after 30 days of no activity.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { ExternalServer, SecurityRequest, sequelize } = require('../database/models');
const { Op } = require('sequelize');
const { INACTIVITY_THRESHOLD_DAYS } = require('../database/server-utils');

module.exports = {
    /**
     * Command definition for /list-external-servers
     * @type {SlashCommandBuilder}
     */
    data: new SlashCommandBuilder()
        .setName('list-external-servers')
        .setDescription('List all external servers using the security request system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(option =>
            option.setName('show-inactive')
                .setDescription('Whether to show inactive servers')
                .setRequired(false)),
    
    /**
     * Executes the list-external-servers command.
     * Shows a list of all external servers that have configured security requests.
     * Servers are considered inactive after ${INACTIVITY_THRESHOLD_DAYS} days without activity.
     * @param {Object} interaction The interaction object.
     * @returns {Promise<void>}
     * @example
     * // Example usage:
     * // /list-external-servers
     * // /list-external-servers show-inactive:true
     * //
     * // This command can only be used in the main security server by administrators.
     * // It displays information about all customer servers that have set up the bot,
     * // including their activity status, channel configuration, and any pending requests.
     */
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const mainGuildId = process.env.GUILD_ID;
        
        // Check if this command is being used in the main security server
        if (interaction.guildId !== mainGuildId) {
            return interaction.editReply({
                content: 'This command can only be used in the main security server.'
            });
        }
        
        const showInactive = interaction.options.getBoolean('show-inactive') || false;
        
        try {
            // Get database table info to check column names
            const tableInfo = await sequelize.query(
                "PRAGMA table_info(security_requests);",
                { type: sequelize.QueryTypes.SELECT }
            );
            
            const columnNames = tableInfo.map(col => col.name);
            console.log('Security request table columns:', columnNames);
            
            // Set the primary key column name based on what exists in the database
            const requestIdColumn = columnNames.includes('requestId') ? 'requestId' : 
                                  columnNames.includes('id') ? 'id' : 'interaction_id';
            
            // Query for servers based on active status
            const whereClause = showInactive ? {} : { isActive: true };
            const externalServers = await ExternalServer.findAll({
                where: whereClause,
                order: [['lastAccessed', 'DESC']]
            });
            
            if (externalServers.length === 0) {
                return interaction.editReply({
                    content: 'No external servers have been configured for security requests.'
                });
            }
            
            // Get counts of active requests for each server using the correct column name
            const serverIds = externalServers.map(server => server.guildId);
            
            let activeRequestCounts;
            try {
                activeRequestCounts = await SecurityRequest.findAll({
                    attributes: ['externalGuildId', [sequelize.fn('COUNT', sequelize.col(requestIdColumn)), 'count']],
                    where: {
                        externalGuildId: { [Op.in]: serverIds },
                        status: { [Op.ne]: 'concluded' }
                    },
                    group: ['externalGuildId'],
                    raw: true
                });
            } catch (error) {
                console.error(`Error querying request counts: ${error.message}`);
                
                // Fallback: Try with a more direct approach if the column name is an issue
                const counts = new Map();
                try {
                    const allRequests = await SecurityRequest.findAll({
                        where: {
                            externalGuildId: { [Op.in]: serverIds },
                            status: { [Op.ne]: 'concluded' }
                        },
                        raw: true
                    });
                    
                    // Manually count by server ID
                    allRequests.forEach(request => {
                        const guildId = request.externalGuildId;
                        counts.set(guildId, (counts.get(guildId) || 0) + 1);
                    });
                    
                    activeRequestCounts = Array.from(counts.entries()).map(([guildId, count]) => ({
                        externalGuildId: guildId,
                        count
                    }));
                } catch (fallbackError) {
                    console.error(`Fallback count error: ${fallbackError.message}`);
                    activeRequestCounts = []; // Use empty array if all attempts fail
                }
            }
            
            // Convert to a map for easy lookup
            const requestCountMap = new Map();
            activeRequestCounts.forEach(item => {
                requestCountMap.set(item.externalGuildId, item.count);
            });
            
            // Create an embed to display all servers
            const embed = new EmbedBuilder()
                .setColor(0x0099FF)
                .setTitle('External Servers')
                .setDescription(`${externalServers.length} external servers${showInactive ? ' (including inactive)' : ''}`)
                .setTimestamp()
                .setFooter({ text: 'VIG Security' });
            
            // Add fields for each server (limit to 25 due to Discord embed limitations)
            const serversToShow = externalServers.slice(0, 25);
            
            for (const server of serversToShow) {
                const activeRequests = requestCountMap.get(server.guildId) || 0;
                const lastAccessedDate = new Date(server.lastAccessed).toLocaleString();
                
                embed.addFields({
                    name: server.guildName,
                    value: `**ID:** ${server.guildId}\n**Channel:** <#${server.channelId}>\n**Status:** ${server.isActive ? '🟢 Active' : '🔴 Inactive'}\n**Active Requests:** ${activeRequests}\n**Last Activity:** ${lastAccessedDate}`
                });
            }
            
            if (externalServers.length > 25) {
                embed.addFields({
                    name: 'More Servers',
                    value: `${externalServers.length - 25} additional servers not shown. Please use filters to narrow down results.`
                });
            }
            
            return interaction.editReply({
                embeds: [embed]
            });
            
        } catch (error) {
            console.error(`Error listing external servers: ${error}`);
            return interaction.editReply({
                content: `There was an error retrieving the server list: ${error.message}`
            });
        }
    },
};