/**
 * @file Server configuration model for Arcani bot
 * @module Database/Models/ServerConfig
 * @description Model for storing server-specific configuration settings including role and channel IDs
 * for security personnel, customers, and alert notifications.
 */

const { DataTypes } = require('sequelize');

/**
 * Definition of the ServerConfig model
 * @param {Object} sequelize - Sequelize instance
 * @returns {Object} ServerConfig model
 * @example
 * // Example of what's stored in the model
 * {
 *   serverId: '123456789012345678',         // Discord server ID
 *   managerRoleId: '234567890123456789',    // Role that can manage bot settings
 *   customerRoleId: '345678901234567890',   // Role for users who can request security
 *   securityRoleId: '456789012345678901',   // Role for security personnel
 *   alertChannelId: '567890123456789012'    // Channel for security alerts
 * }
 */
module.exports = (sequelize) => {
    return sequelize.define('ServerConfig', {
        /**
         * Discord server ID
         * @type {string}
         */
        serverId: {
            type: DataTypes.STRING,
            allowNull: false,
            primaryKey: true,
            comment: 'Discord server ID'
        },
        /**
         * Role ID that can manage bot settings
         * @type {string}
         */
        managerRoleId: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Role ID that can manage bot settings'
        },
        /**
         * Role ID for customers who can request security
         * @type {string}
         */
        customerRoleId: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Role ID for customers who can request security'
        },
        /**
         * Role ID for security personnel
         * @type {string}
         */
        securityRoleId: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Role ID for security personnel'
        },
        /**
         * Channel ID for security alerts
         * @type {string}
         */
        alertChannelId: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Channel ID for security alerts'
        }
    }, {
        timestamps: true
    });
};