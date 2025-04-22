/**
 * @file Database migrations
 * @module Database/Migrations
 * @description Handles all database migrations for the application, including adding new columns
 * and initializing default configurations. This ensures database schema stays up-to-date
 * with code changes without requiring manual database manipulation.
 */

const { sequelize, ExternalServer, ServerConfig } = require('./models');
const { QueryTypes } = require('sequelize');

/**
 * Runs all database migrations
 * @returns {Promise<void>}
 * @example
 * // Execute all migrations during startup
 * await runMigrations();
 * console.log('All migrations completed successfully');
 */
async function runMigrations() {
    const migrations = [
        migrateLastAccessed,
        migrateServerConfigs
    ];
    
    for (const migration of migrations) {
        try {
            await migration();
        } catch (error) {
            console.error(`[ERROR] Migration failed: ${error.message}`, error);
            throw error;
        }
    }
    
    console.log('[INFO] All migrations completed successfully.');
}

/**
 * Migration to add lastAccessed column to ExternalServer table
 * @returns {Promise<void>}
 * @example
 * // Check and add lastAccessed column if needed
 * await migrateLastAccessed();
 */
async function migrateLastAccessed() {
    try {
        // Check if the column exists
        const tableInfo = await sequelize.query(
            "PRAGMA table_info(ExternalServers);",
            { type: QueryTypes.SELECT }
        );
        
        const hasLastAccessed = tableInfo.some(column => column.name === 'lastAccessed');
        
        if (!hasLastAccessed) {
            console.log('[INFO] Running migration: Adding lastAccessed column to ExternalServers');
            
            // Add the column
            await sequelize.query(
                "ALTER TABLE ExternalServers ADD COLUMN lastAccessed DATETIME;"
            );
            
            // Set default value for existing records
            await sequelize.query(
                "UPDATE ExternalServers SET lastAccessed = CURRENT_TIMESTAMP;"
            );
            
            console.log('[INFO] Migration completed: Added lastAccessed column to ExternalServers');
        } else {
            console.log('[INFO] Migration skipped: lastAccessed column already exists');
        }
    } catch (error) {
        console.error('[ERROR] Migration failed:', error);
        throw error;
    }
}

/**
 * Migration to create initial server configs from environment variables
 * @returns {Promise<void>}
 * @example
 * // Initialize server configs with environment variables
 * await migrateServerConfigs();
 */
async function migrateServerConfigs() {
    try {
        // First check if the ServerConfig table exists
        const tableListQuery = await sequelize.query(
            "SELECT name FROM sqlite_master WHERE type='table';",
            { type: QueryTypes.SELECT }
        );
        
        const tableNames = tableListQuery.map(result => result.name);
        console.log('[INFO] Found database tables:', tableNames);
        
        // Look for a table that might be our ServerConfig table (with various possible naming conventions)
        const possibleTableNames = ['ServerConfigs', 'serverconfigs', 'server_configs', 'ServerConfig'];
        const serverConfigTable = possibleTableNames.find(name => tableNames.includes(name));
        
        if (!serverConfigTable) {
            console.log('[INFO] ServerConfig table does not exist yet, will be created during sync');
            return;
        }
        
        // Check if we already have any server configs
        const configsResult = await sequelize.query(
            `SELECT COUNT(*) as count FROM ${serverConfigTable};`,
            { type: QueryTypes.SELECT }
        );
        
        const configCount = configsResult[0]?.count || 0;
        
        if (configCount === 0) {
            console.log('[INFO] Running migration: Creating initial server configuration');
            
            const mainGuildId = process.env.GUILD_ID;
            if (mainGuildId) {
                // Create config using model to ensure proper table name
                console.log('[INFO] Creating initial server config for guild ID:', mainGuildId);
                try {
                    await ServerConfig.create({
                        serverId: mainGuildId,
                        securityRoleId: process.env.SECURITY_ROLE_ID || null,
                        customerRoleId: process.env.CUSTOMER_ROLE_ID || null,
                        alertChannelId: process.env.ALERT_CHANNEL_ID || null
                    });
                    console.log('[INFO] Migration completed: Created initial server configuration');
                } catch (createError) {
                    // If direct model creation fails, log but don't throw error
                    console.error('[WARN] Could not create config using model, will create on first use:', createError.message);
                }
            } else {
                console.log('[INFO] Migration skipped: No GUILD_ID in environment variables');
            }
        } else {
            console.log(`[INFO] Migration skipped: Server configurations already exist (${configCount} found)`);
        }
    } catch (error) {
        // Log error but don't fail startup - we'll create configs when needed
        console.error('[ERROR] Migration warning (non-fatal):', error.message);
        console.log('[INFO] Will create server configs as needed during operation');
    }
}

module.exports = {
    runMigrations
};