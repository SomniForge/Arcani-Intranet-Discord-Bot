/**
 * @file Database models index
 * @module Database/Models
 * @description Central module for database model initialization, associations, and connection
 * management. This module initializes all database models, sets up their relationships, 
 * and provides a unified export interface for the rest of the application.
 */

const { sequelize } = require('../config');
const ExternalServerModel = require('./external-server');
const SecurityRequestModel = require('./security-request');
const ServerConfigModel = require('./server-config');

// Initialize models with sequelize instance
const ExternalServer = ExternalServerModel(sequelize);
const SecurityRequest = SecurityRequestModel(sequelize);
const ServerConfig = ServerConfigModel(sequelize);

// Define associations
SecurityRequest.belongsTo(ExternalServer, {
    foreignKey: 'externalGuildId',
    as: 'externalServer'
});

/**
 * Initializes the database connection and syncs models
 * @returns {Promise<void>} A promise that resolves when database is initialized
 * @example
 * // Initialize database during application startup
 * await initializeDatabase();
 * console.log('Database initialized and models synchronized');
 * 
 * // Access models throughout the application
 * const serverConfig = await ServerConfig.findByPk('123456789012345678');
 */
async function initializeDatabase() {
    try {
        await sequelize.authenticate();
        console.log('[INFO] Database connection has been established successfully.');
        
        // Sync all models with the database
        await sequelize.sync();
        console.log('[INFO] All models were synchronized successfully.');
    } catch (error) {
        console.error('[ERROR] Unable to connect to the database:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    ExternalServer,
    SecurityRequest,
    ServerConfig,
    initializeDatabase
};