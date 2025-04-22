/**
 * @file Database models index
 * @module Database/Models
 */

const { sequelize, testConnection } = require('../config');
const ExternalServer = require('./external-server');
const SecurityRequest = require('./security-request');

/**
 * Initializes all database models and their relationships
 * @returns {Promise<void>}
 */
async function initializeDatabase() {
    try {
        // Test the connection first
        await testConnection();
        
        // Sync all models with the database
        // force: false prevents dropping tables if they already exist
        await sequelize.sync({ force: false });
        
        console.log('[DATABASE] Models synchronized successfully');
    } catch (error) {
        console.error('[DATABASE] Error initializing database:', error);
        throw error;
    }
}

module.exports = {
    sequelize,
    ExternalServer,
    SecurityRequest,
    initializeDatabase
};