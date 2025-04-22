/**
 * @file Database migration script
 * @module Database/Migrations
 * @description Handles automatic database migrations to update schema when new features are added.
 * Currently implements migration for the allowedRoleIds column in ExternalServers table.
 */

const { sequelize } = require('./config');
const { QueryTypes } = require('sequelize');

/**
 * Runs database migrations to update schema
 * @returns {Promise<void>}
 */
async function runMigrations() {
    try {
        console.log('[INFO] Running database migrations...');
        
        // Check if the column exists
        const checkColumnQuery = `
            PRAGMA table_info(ExternalServers);
        `;
        
        const columns = await sequelize.query(checkColumnQuery, { type: QueryTypes.SELECT });
        const columnExists = columns.some(column => column.name === 'allowedRoleIds');
        
        if (!columnExists) {
            console.log('[INFO] Adding allowedRoleIds column to ExternalServers table...');
            // Add the column if it doesn't exist
            await sequelize.query(`
                ALTER TABLE ExternalServers 
                ADD COLUMN allowedRoleIds TEXT;
            `);
            console.log('[INFO] Successfully added allowedRoleIds column');
        } else {
            console.log('[INFO] allowedRoleIds column already exists');
        }
        
        console.log('[INFO] Database migrations completed successfully');
    } catch (error) {
        console.error('[ERROR] Failed to run migrations:', error);
        throw error;
    }
}

module.exports = { runMigrations };