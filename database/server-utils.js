/**
 * @file Utility functions for external servers
 * @module Database/Utils/ServerUtils
 * @description Provides utilities for managing external server status, including active/inactive classification
 * and automatic activity tracking based on server usage patterns. These utilities help maintain
 * the connection with customer servers requesting security services.
 */

const { Op } = require('sequelize');
const { ExternalServer } = require('./models');
const { getAlertChannelId } = require('./server-config-utils');
const { EmbedBuilder } = require('discord.js');

/**
 * Number of days before a server is considered inactive
 * @type {number}
 */
const INACTIVITY_THRESHOLD_DAYS = 30;

/**
 * Updates the active status of all external servers based on activity dates
 * @returns {Promise<{updated: number, active: number, inactive: number}>} Stats about the update
 * @example
 * // Check and update inactive servers
 * const stats = await updateServerActiveStatus();
 * console.log(`Updated ${stats.updated} servers - ${stats.active} active, ${stats.inactive} inactive`);
 */
async function updateServerActiveStatus() {
    try {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - INACTIVITY_THRESHOLD_DAYS);
        
        // Find servers that haven't been accessed in the threshold period
        const inactiveServers = await ExternalServer.findAll({
            where: {
                lastAccessed: {
                    [Op.lt]: cutoffDate
                },
                isActive: true
            }
        });
        
        // Mark them as inactive
        for (const server of inactiveServers) {
            server.isActive = false;
            await server.save();
        }
        
        // Count active servers
        const activeCount = await ExternalServer.count({
            where: {
                isActive: true
            }
        });
        
        // Count inactive servers
        const inactiveCount = await ExternalServer.count({
            where: {
                isActive: false
            }
        });
        
        return {
            updated: inactiveServers.length,
            active: activeCount,
            inactive: inactiveCount
        };
    } catch (error) {
        console.error('[ERROR] Failed to update server active status:', error);
        throw error;
    }
}

/**
 * Updates a server's last accessed time to now and ensures it's marked active
 * @param {string} guildId - The Discord guild ID
 * @returns {Promise<boolean>} Whether the update was successful
 * @example
 * // Mark a server as active when it makes a request
 * const success = await markServerActive('123456789012345678');
 * if (success) {
 *   console.log('Server activity updated successfully');
 * } else {
 *   console.error('Failed to update server activity');
 * }
 */
async function markServerActive(guildId) {
    try {
        const server = await ExternalServer.findByPk(guildId);
        if (!server) return false;
        
        server.lastAccessed = new Date();
        server.isActive = true;
        await server.save();
        return true;
    } catch (error) {
        console.error(`[ERROR] Failed to mark server ${guildId} as active:`, error);
        return false;
    }
}

/**
 * Sends a system notification to all configured servers
 * @param {import('discord.js').Client} client - Discord.js client instance
 * @param {string} message - The message to send
 * @param {Object} [options={}] - Additional options
 * @param {boolean} [options.isUpdate=false] - Whether this is an update notification
 * @param {boolean} [options.isError=false] - Whether this is an error notification
 * @param {string} [options.title] - Optional title for the embed
 * @param {boolean} [options.notifyExternal=true] - Whether to notify external servers
 * @returns {Promise<{mainSuccess: boolean, externalCount: number, errors: number}>} Result statistics
 * @example
 * // Send a system update notification
 * const client = getDiscordClient(); // Your bot client
 * const result = await sendSystemNotification(
 *   client, 
 *   'Bot has been updated to version 1.2.0', 
 *   { isUpdate: true, title: '🔄 Bot Updated' }
 * );
 * console.log(`Sent to main server: ${result.mainSuccess}, External servers: ${result.externalCount}`);
 */
async function sendSystemNotification(client, message, options = {}) {
    const stats = {
        mainSuccess: false,
        externalCount: 0,
        errors: 0
    };
    
    const { 
        isUpdate = false, 
        isError = false, 
        title = isUpdate ? '🔄 System Update' : (isError ? '❌ System Alert' : '📢 System Notification'),
        notifyExternal = true
    } = options;
    
    // Create a consistent embed for all notifications
    const embed = new EmbedBuilder()
        .setColor(isError ? 0xFF0000 : (isUpdate ? 0x00AAFF : 0x00FF00))
        .setTitle(title)
        .setDescription(message)
        .setTimestamp()
        .setFooter({ 
            text: `Arcani Security Bot${isUpdate ? ' • System Update' : ''}`,
            iconURL: client.user?.displayAvatarURL()
        });
    
    try {
        // First, send to main security server's alert channel
        const mainGuildId = process.env.GUILD_ID;
        if (mainGuildId) {
            try {
                const alertChannelId = await getAlertChannelId(mainGuildId);
                if (alertChannelId) {
                    const mainGuild = await client.guilds.fetch(mainGuildId);
                    if (mainGuild) {
                        const alertChannel = await mainGuild.channels.fetch(alertChannelId);
                        if (alertChannel && alertChannel.isTextBased()) {
                            await alertChannel.send({ embeds: [embed] });
                            stats.mainSuccess = true;
                        }
                    }
                }
            } catch (mainError) {
                console.error(`[ERROR] Failed to send notification to main server:`, mainError);
                stats.errors++;
            }
        }
        
        // Then, send to all active external servers if requested
        if (notifyExternal) {
            try {
                const externalServers = await ExternalServer.findAll({
                    where: { isActive: true }
                });
                
                for (const server of externalServers) {
                    try {
                        // Only send if the server has a configured channel
                        if (server.channelId) {
                            const guild = await client.guilds.fetch(server.guildId);
                            if (guild) {
                                const channel = await guild.channels.fetch(server.channelId);
                                if (channel && channel.isTextBased()) {
                                    // Create a slightly different embed for external servers
                                    const externalEmbed = EmbedBuilder.from(embed)
                                        .setDescription(`${message}\n\n*This is an automated notification from Arcani Security.*`);
                                    
                                    await channel.send({ embeds: [externalEmbed] });
                                    stats.externalCount++;
                                }
                            }
                        }
                    } catch (serverError) {
                        console.error(`[ERROR] Failed to send notification to server ${server.guildId}:`, serverError);
                        stats.errors++;
                    }
                }
            } catch (externalError) {
                console.error(`[ERROR] Failed to fetch external servers:`, externalError);
                stats.errors++;
            }
        }
        
        return stats;
    } catch (error) {
        console.error(`[ERROR] Failed to send system notification:`, error);
        stats.errors++;
        return stats;
    }
}

module.exports = {
    updateServerActiveStatus,
    markServerActive,
    sendSystemNotification,
    INACTIVITY_THRESHOLD_DAYS
};