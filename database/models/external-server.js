/**
 * @file External server model
 * @module Database/Models/ExternalServer
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');

/**
 * Represents an external server that has configured the bot for security requests
 * @typedef {Object} ExternalServer
 */
const ExternalServer = sequelize.define('ExternalServer', {
    /**
     * Discord Guild ID
     * @type {string}
     */
    guildId: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true
    },
    /**
     * Name of the Discord Guild
     * @type {string}
     */
    guildName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /**
     * ID of the channel designated for security requests
     * @type {string}
     */
    channelId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /**
     * Whether the server is active
     * @type {boolean}
     */
    isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    },
    /**
     * Date when the server was last accessed
     * @type {Date}
     */
    lastAccessed: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
});

module.exports = ExternalServer;