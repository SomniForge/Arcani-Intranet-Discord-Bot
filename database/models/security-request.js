/**
 * @file Security request model
 * @module Database/Models/SecurityRequest
 */

const { DataTypes } = require('sequelize');
const { sequelize } = require('../config');
const ExternalServer = require('./external-server');

/**
 * Represents a security request from an external server or internal user
 * @typedef {Object} SecurityRequest
 */
const SecurityRequest = sequelize.define('SecurityRequest', {
    /**
     * Unique ID for the request (using Discord's interaction ID)
     * @type {string}
     */
    requestId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true
    },
    /**
     * Whether the request is from an external server
     * @type {boolean}
     */
    isExternal: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    },
    /**
     * The user ID who made the request
     * @type {string}
     */
    requesterId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /**
     * The username of the requester
     * @type {string}
     */
    requesterName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /**
     * Location where security is needed
     * @type {string}
     */
    location: {
        type: DataTypes.STRING,
        allowNull: false
    },
    /**
     * Details about the security request
     * @type {string}
     */
    details: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    /**
     * Contact information for external requests
     * @type {string}
     */
    contact: {
        type: DataTypes.STRING,
        allowNull: true
    },
    /**
     * Security server message ID
     * @type {string}
     */
    securityMessageId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    /**
     * External server message ID (if applicable)
     * @type {string}
     */
    externalMessageId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    /**
     * Current status of the request
     * @type {string}
     */
    status: {
        type: DataTypes.ENUM('pending', 'responding', 'concluded'),
        defaultValue: 'pending',
        allowNull: false
    },
    /**
     * Array of user IDs who are responding
     * @type {Array<string>}
     */
    responders: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
            const data = this.getDataValue('responders');
            return data ? JSON.parse(data) : [];
        },
        set(value) {
            this.setDataValue('responders', JSON.stringify(value));
        }
    },
    /**
     * Conclusion reason, if any
     * @type {string}
     */
    conclusionReason: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    /**
     * ID of user who concluded the request
     * @type {string}
     */
    concludedById: {
        type: DataTypes.STRING,
        allowNull: true
    },
    /**
     * Username of person who concluded the request
     * @type {string}
     */
    concludedByName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    /**
     * When the request was concluded
     * @type {Date}
     */
    concludedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
});

// Define associations
SecurityRequest.belongsTo(ExternalServer, {
    foreignKey: 'externalGuildId',
    as: 'externalServer'
});

module.exports = SecurityRequest;