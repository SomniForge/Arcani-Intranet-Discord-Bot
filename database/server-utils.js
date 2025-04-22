/**
 * @file Utility functions for external servers
 * @module Database/Utils/ServerUtils
 * @description Provides utilities for managing external server status, including active/inactive classification
 * and automatic activity tracking based on server usage patterns. These utilities help maintain
 * the connection with customer servers requesting security services.
 */

const { Op } = require('sequelize');
const { ExternalServer } = require('./models');

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

module.exports = {
    updateServerActiveStatus,
    markServerActive,
    INACTIVITY_THRESHOLD_DAYS
};