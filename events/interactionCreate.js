/**
 * @file Interaction event handler
 * @module EventHandlers/InteractionCreate
 * @description Central event handler for all Discord interactions, including commands, buttons, and modals.
 * This file implements the core functionality for responding to security requests, concluding them,
 * and handling cross-server communication for external security requests.
 */

const { Events, InteractionType, GuildMember, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { SecurityRequest, ExternalServer } = require('../database/models');
const { getSecurityRoleId } = require('../database/server-config-utils');

/**
 * @typedef {Object} Interaction
 * @description Discord.js Interaction object
 */

/**
 * @typedef {Object} ButtonInteraction
 * @description Discord.js ButtonInteraction object
 */

/**
 * @typedef {Object} ModalSubmitInteraction
 * @description Discord.js ModalSubmitInteraction object
 */

/**
 * @typedef {Object} GuildMember
 * @description Discord.js GuildMember object
 */

/**
 * @typedef {Object} CacheType
 * @description Discord.js CacheType
 */

// --- Helper Function Definitions ---

/**
 * Handles the logic for the 'Respond' button interaction.
 * Updates the original request embed to add the responding user.
 * @param {ButtonInteraction} interaction The button interaction object (already deferred).
 * @param {GuildMember} member The guild member who clicked the button.
 * @returns {Promise<void>}
 * @example
 * // When a security team member clicks the "Respond" button on a request:
 * // 1. Their name is added to the "Responding Security" field
 * // 2. The embed is updated to show all current responders
 * await handleRespondButton(interaction, member);
 */
async function handleRespondButton(interaction, member) {
    const interactionId = interaction.id; // For logging
    console.log(`[Interaction ${interactionId}] Inside handleRespondButton for user ${member.user.tag}.`);
    try {
        const originalMessage = interaction.message;
        const originalEmbed = originalMessage.embeds[0];

        if (!originalEmbed) {
            console.error(`[Interaction ${interactionId}] Could not find original embed on the message.`);
            // Use followUp since deferred
            return interaction.followUp({ content: 'Error processing request: Original embed not found.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending embed not found followUp:`, err));
        }
        console.log(`[Interaction ${interactionId}] Found original embed.`);

        // Clone the embed to modify it
        const updatedEmbed = EmbedBuilder.from(originalEmbed);
        const respondersField = updatedEmbed.data.fields?.find(field => field.name === 'Responding Security');

        if (!respondersField) {
             console.error(`[Interaction ${interactionId}] Could not find "Responding Security" field on the embed.`);
             return interaction.followUp({ content: 'Error processing request: Embed structure invalid.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending invalid structure followUp:`, err));
        }
        console.log(`[Interaction ${interactionId}] Found responders field. Current value: "${respondersField.value}"`);

        let responders = respondersField.value.split('\n').filter(line => line.trim() !== '' && line !== 'None yet.');

        const userMention = `${member.user}`;
        if (!responders.includes(userMention)) {
            console.log(`[Interaction ${interactionId}] User ${member.user.tag} not found in responders. Adding.`);
            responders.push(userMention);
            respondersField.value = responders.join('\n');
            console.log(`[Interaction ${interactionId}] New responders value: "${respondersField.value}"`);

            console.log(`[Interaction ${interactionId}] Attempting editReply...`);
            await interaction.editReply({ embeds: [updatedEmbed] });
            console.log(`[Interaction ${interactionId}] editReply successful for ${member.user.tag}.`);

        } else {
            console.log(`[Interaction ${interactionId}] User ${member.user.tag} already responding.`);
            // User is already listed, send ephemeral followUp
            await interaction.followUp({ content: 'You are already marked as responding to this request.', flags: [64] });
            console.log(`[Interaction ${interactionId}] Sent 'already responding' followUp.`);
        }

    } catch (error) {
        console.error(`[Interaction ${interactionId}] Error inside handleRespondButton:`, error);
        // Use followUp for errors after deferring
        // Check if already replied (e.g., by the followUp above)
        if (!interaction.replied) {
             await interaction.followUp({ content: 'There was an error marking you as responding.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending respond button error followUp:`, err));
        }
    }
}

/**
 * Handles the logic for the 'Conclude Request' button interaction.
 * Shows a modal to the user to collect the reason for conclusion.
 * @param {ButtonInteraction} interaction The button interaction object.
 * @returns {Promise<void>}
 * @example
 * // When a security team member clicks the "Conclude Request" button:
 * // 1. A modal dialog appears asking for the conclusion reason
 * // 2. The security member enters details about how the situation was resolved
 * await handleConcludeButton(interaction);
 */
async function handleConcludeButton(interaction) {
    const interactionId = interaction.id; // For logging
    console.log(`[Interaction ${interactionId}] Inside handleConcludeButton.`);
    try {
        const requestId = interaction.customId.split('_')[1]; // Extract request ID

        // Create the modal
        const modal = new ModalBuilder()
            .setCustomId(`conclude_modal_${requestId}`) // Include request ID in modal ID
            .setTitle('Conclude Security Request');

        // Create the text input component
        const reasonInput = new TextInputBuilder()
            .setCustomId('conclude_reason')
            .setLabel("Reason for concluding the request")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('e.g., Situation resolved, false alarm, etc.')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        console.log(`[Interaction ${interactionId}] Attempting showModal...`);
        await interaction.showModal(modal);
        console.log(`[Interaction ${interactionId}] showModal successful.`);

    } catch (error) {
        console.error(`[Interaction ${interactionId}] Error showing conclude modal:`, error);
        // If showModal fails, try to reply ephemerally
        if (!interaction.replied && !interaction.deferred) {
             await interaction.reply({ content: 'There was an error trying to open the conclusion confirmation.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending conclude modal error reply:`, err));
        } else {
             // If somehow deferred or replied before showModal failed, use followUp
             await interaction.followUp({ content: 'There was an error trying to open the conclusion confirmation.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending conclude modal error followUp:`, err));
        }
    }
}

/**
 * Handles the submission of the 'Conclude Request' modal.
 * Updates the original request embed to show the conclusion details and removes buttons.
 * @param {ModalSubmitInteraction} interaction The modal submit interaction object (already deferred).
 * @returns {Promise<void>}
 * @example
 * // After a security member submits the conclusion modal:
 * // 1. The security request is marked as concluded
 * // 2. The embed is updated with the conclusion reason and who concluded it
 * // 3. The action buttons are removed from the message
 * await handleConcludeModalSubmit(interaction);
 */
async function handleConcludeModalSubmit(interaction) {
    const interactionId = interaction.id; // For logging
    console.log(`[Interaction ${interactionId}] Inside handleConcludeModalSubmit.`);
    try {
        const reason = interaction.fields.getTextInputValue('conclude_reason');
        const securityMember = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);
        console.log(`[Interaction ${interactionId}] Modal submitted by ${securityMember.user.tag}. Reason: ${reason}`);

        const originalMessage = interaction.message;
        const originalEmbed = originalMessage.embeds[0];

        if (!originalEmbed) {
            console.error(`[Interaction ${interactionId}] Could not find original embed on the message for modal submit.`);
            return interaction.followUp({ content: 'Error processing conclusion: Original embed not found.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending modal embed not found followUp:`, err));
        }
        console.log(`[Interaction ${interactionId}] Found original embed for modal submit.`);

        // Clone the embed to modify it
        const concludedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('✅ Security Request Concluded ✅')
            .setColor(0x00FF00) // Green color for concluded
            .setFields( // Use setFields to replace existing fields and add new ones cleanly
                 ...originalEmbed.fields.filter(field => field.name !== 'Responding Security'), // Keep existing fields except responders
                 { name: 'Responding Security', value: originalEmbed.fields.find(f => f.name === 'Responding Security')?.value || 'N/A' }, // Keep final responders list
                 { name: 'Conclusion Reason', value: reason },
                 { name: 'Concluded By', value: `${securityMember.user}` }
             )
            .setTimestamp(); // Update timestamp to conclusion time
        console.log(`[Interaction ${interactionId}] Created concluded embed.`);

        console.log(`[Interaction ${interactionId}] Attempting editReply for modal...`);
        // Use editReply since we deferred
        await interaction.editReply({ embeds: [concludedEmbed], components: [] });
        console.log(`[Interaction ${interactionId}] editReply successful for modal conclusion.`);

    } catch (error) {
        console.error(`[Interaction ${interactionId}] Error handling conclude modal submit:`, error);
        // Use followUp for errors after deferring
        if (!interaction.replied) {
            await interaction.followUp({ content: 'There was an error concluding the request.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending conclude modal submit error followUp:`, err));
        }
    }
}

/**
 * Handles the logic for external 'Respond' button interaction.
 * Updates both the security server embed and the customer server embed.
 * @param {ButtonInteraction} interaction The button interaction object (already deferred).
 * @param {GuildMember} member The security guild member who clicked the button.
 * @param {string} requestId The ID of the original request.
 * @param {string} externalGuildId The ID of the external guild where the request originated.
 * @returns {Promise<void>}
 * @example
 * // When a security member responds to an external request:
 * // 1. The security server message is updated with the responder's name
 * // 2. The external server message is updated to show security is responding
 * // 3. The database entry is updated to track who is responding
 * await handleExternalRespondButton(interaction, member, '123456789012345678', '876543210987654321');
 * @since 1.2.0 - Fixed updating external server with responder information
 */
async function handleExternalRespondButton(interaction, member, requestId, externalGuildId) {
    const interactionId = interaction.id;
    console.log(`[Interaction ${interactionId}] Inside handleExternalRespondButton for user ${member.user.tag}.`);
    
    try {
        // Get the security request from database
        const request = await SecurityRequest.findByPk(requestId);
        if (!request) {
            console.error(`[Interaction ${interactionId}] Could not find security request with ID ${requestId} in database`);
            return interaction.followUp({ 
                content: 'Could not find the original security request in the database.', 
                flags: [64] 
            });
        }

        // 1. Update the security server message
        const originalMessage = interaction.message;
        const originalEmbed = originalMessage.embeds[0];

        if (!originalEmbed) {
            console.error(`[Interaction ${interactionId}] Could not find original embed on security server message.`);
            return interaction.followUp({ content: 'Error processing request: Original embed not found.', flags: [64] });
        }

        // Clone the embed to modify it
        const updatedEmbed = EmbedBuilder.from(originalEmbed);
        const respondersField = updatedEmbed.data.fields?.find(field => field.name === 'Responding Security');

        if (!respondersField) {
            console.error(`[Interaction ${interactionId}] Could not find "Responding Security" field on the embed.`);
            return interaction.followUp({ content: 'Error processing request: Embed structure invalid.', flags: [64] });
        }

        // Get current responders from the database - parse JSON if it's a string
        let responders = [];
        try {
            // If responders is a string (JSON), parse it; otherwise use as is or default to empty array
            if (typeof request.responders === 'string') {
                responders = JSON.parse(request.responders || '[]');
            } else if (Array.isArray(request.responders)) {
                responders = request.responders;
            }
            console.log(`[Interaction ${interactionId}] Current responders:`, responders);
        } catch (parseError) {
            console.error(`[Interaction ${interactionId}] Error parsing responders:`, parseError);
            responders = [];
        }
        
        const userMention = `${member.user}`;
        const userID = member.user.id;
        
        // Get the nickname of the security member, or fallback to their username if no nickname is set
        const responderName = member.nickname || member.user.username;
        
        // Check if user is already responding
        if (!responders.includes(userID)) {
            // Add to responders in database
            responders.push(userID);
            
            // Store responders back to database - stringify if needed
            if (typeof request.responders === 'string') {
                request.responders = JSON.stringify(responders);
            } else {
                request.responders = responders;
            }
            
            request.status = 'responding';
            await request.save();
            
            // Update embed responders field
            const responderMentions = responders.map(id => `<@${id}>`).join('\n');
            respondersField.value = responderMentions || 'None yet.';
            
            // Get all responder names (nicknames if available)
            const allResponders = [];
            for (const responderId of responders) {
                try {
                    const responderMember = await interaction.guild.members.fetch(responderId);
                    if (responderMember) {
                        allResponders.push(responderMember.nickname || responderMember.user.username);
                    }
                } catch (error) {
                    // If we can't fetch the member, at least show their ID as a fallback
                    allResponders.push(`Unknown Member (${responderId})`);
                }
            }
            
            // Update the security server message
            await interaction.editReply({ embeds: [updatedEmbed] });
            
            // 2. Update the external server message if this is an external request
            if (request.isExternal && request.externalGuildId && request.externalMessageId) {
                try {
                    // Find the external server
                    const externalServer = await ExternalServer.findByPk(request.externalGuildId);
                    if (!externalServer) {
                        return interaction.followUp({ 
                            content: 'The external server is no longer registered in our system.', 
                            flags: [64] 
                        });
                    }
                    
                    // Find the external guild and channel
                    const externalGuild = await interaction.client.guilds.fetch(request.externalGuildId);
                    if (!externalGuild) {
                        return interaction.followUp({ 
                            content: 'Could not find the external server. The request may have been updated locally only.', 
                            flags: [64] 
                        });
                    }
                    
                    const externalChannel = await externalGuild.channels.fetch(externalServer.channelId);
                    if (!externalChannel) {
                        return interaction.followUp({ 
                            content: 'Could not find the channel in the external server. The request may have been updated locally only.', 
                            flags: [64] 
                        });
                    }
                    
                    // Get the message in the external channel
                    const externalMessage = await externalChannel.messages.fetch(request.externalMessageId);
                    if (!externalMessage) {
                        return interaction.followUp({ 
                            content: 'Could not find the original request message in the external server.', 
                            flags: [64] 
                        });
                    }
                    
                    // Update the external server message
                    const externalEmbed = externalMessage.embeds[0];
                    
                    // Format a clean list of responder names
                    const respondersList = allResponders.length > 0 
                        ? allResponders.join(', ') 
                        : 'None yet.';
                    
                    const updatedExternalEmbed = EmbedBuilder.from(externalEmbed);
                    
                    // Find and update the Status field or add it if not present
                    const statusFieldIndex = updatedExternalEmbed.data.fields.findIndex(field => field.name === 'Status');
                    
                    if (statusFieldIndex !== -1) {
                        // Update existing Status field
                        updatedExternalEmbed.data.fields[statusFieldIndex] = {
                            name: 'Status',
                            value: `Security personnel responding: ${respondersList}`
                        };
                    } else {
                        // Add Status field if not present
                        updatedExternalEmbed.addFields({
                            name: 'Status',
                            value: `Security personnel responding: ${respondersList}`
                        });
                    }
                    
                    // Update the message in the external server
                    await externalMessage.edit({ embeds: [updatedExternalEmbed] });
                    
                    return interaction.followUp({ 
                        content: `You are now responding to this external request. The requestor in ${externalGuild.name} has been notified.`, 
                        flags: [64] 
                    });
                } catch (externalError) {
                    console.error(`[Interaction ${interactionId}] Error updating external message:`, externalError);
                    return interaction.followUp({ 
                        content: `The security request was updated, but there was an error notifying the external server: ${externalError.message}`, 
                        flags: [64] 
                    });
                }
            } else {
                return interaction.followUp({ 
                    content: 'You are now marked as responding to this request.', 
                    flags: [64] 
                });
            }
        } else {
            // User is already listed
            return interaction.followUp({ content: 'You are already marked as responding to this request.', flags: [64] });
        }
    } catch (error) {
        console.error(`[Interaction ${interactionId}] Error inside handleExternalRespondButton:`, error);
        if (!interaction.replied) {
            await interaction.followUp({ content: 'There was an error marking you as responding.', flags: [64] });
        }
    }
}

/**
 * Handles the logic for external 'Conclude Request' button interaction.
 * Shows a modal to collect conclusion reason and guild ID.
 * @param {ButtonInteraction} interaction The button interaction object.
 * @param {string} requestId The ID of the original request.
 * @param {string} externalGuildId The ID of the external guild.
 * @returns {Promise<void>}
 * @example
 * // When a security member concludes an external request:
 * // 1. A modal dialog appears asking for the conclusion reason
 * // 2. The modal includes hidden fields for the request ID and external guild ID
 * await handleExternalConcludeButton(interaction, '123456789012345678', '876543210987654321');
 */
async function handleExternalConcludeButton(interaction, requestId, externalGuildId) {
    const interactionId = interaction.id;
    console.log(`[Interaction ${interactionId}] Inside handleExternalConcludeButton.`);
    
    try {
        // Create the modal with both the request ID and external guild ID
        const modal = new ModalBuilder()
            .setCustomId(`extconclude_modal_${requestId}_${externalGuildId}`)
            .setTitle('Conclude External Security Request');

        // Create the text input component
        const reasonInput = new TextInputBuilder()
            .setCustomId('conclude_reason')
            .setLabel("Reason for concluding the request")
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('e.g., Situation resolved, false alarm, etc.')
            .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(reasonInput);
        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
    } catch (error) {
        console.error(`[Interaction ${interactionId}] Error showing external conclude modal:`, error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: 'There was an error trying to open the conclusion form.', flags: [64] });
        } else {
            await interaction.followUp({ content: 'There was an error trying to open the conclusion form.', flags: [64] });
        }
    }
}

/**
 * Handles the submission of the external 'Conclude Request' modal.
 * Updates both the security server and external server messages.
 * @param {ModalSubmitInteraction} interaction The modal submit interaction object (already deferred).
 * @param {string} requestId The ID of the original request.
 * @param {string} externalGuildId The ID of the external guild.
 * @returns {Promise<void>}
 * @example
 * // After a security member submits the external conclusion modal:
 * // 1. The security request is marked as concluded in the database
 * // 2. The security server embed is updated with conclusion details
 * // 3. The external server embed is updated to show the request was concluded
 * // 4. Action buttons are removed from both messages
 * await handleExternalConcludeModalSubmit(interaction, '123456789012345678', '876543210987654321');
 */
async function handleExternalConcludeModalSubmit(interaction, requestId, externalGuildId) {
    const interactionId = interaction.id;
    console.log(`[Interaction ${interactionId}] Inside handleExternalConcludeModalSubmit.`);
    
    try {
        const reason = interaction.fields.getTextInputValue('conclude_reason');
        const securityMember = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);
        
        // Get the security request from database
        const request = await SecurityRequest.findByPk(requestId);
        if (!request) {
            console.error(`[Interaction ${interactionId}] Could not find security request with ID ${requestId} in database`);
            return interaction.followUp({ 
                content: 'Could not find the original security request in the database.', 
                flags: [64] 
            });
        }

        // Update the request in the database
        request.status = 'concluded';
        request.conclusionReason = reason;
        request.concludedById = securityMember.user.id;
        request.concludedByName = securityMember.user.tag;
        request.concludedAt = new Date();
        await request.save();
        
        // 1. Update the security server message
        const originalMessage = interaction.message;
        const originalEmbed = originalMessage.embeds[0];

        if (!originalEmbed) {
            console.error(`[Interaction ${interactionId}] Could not find original embed on the message for modal submit.`);
            return interaction.followUp({ content: 'Error processing conclusion: Original embed not found.', flags: [64] });
        }

        // Clone the embed to modify it
        const concludedEmbed = EmbedBuilder.from(originalEmbed)
            .setTitle('✅ External Security Request Concluded ✅')
            .setColor(0x00FF00) // Green color for concluded
            .setFields(
                ...originalEmbed.fields.filter(field => field.name !== 'Responding Security'),
                { name: 'Responding Security', value: originalEmbed.fields.find(f => f.name === 'Responding Security')?.value || 'N/A' },
                { name: 'Conclusion Reason', value: reason },
                { name: 'Concluded By', value: `${securityMember.user}` }
            )
            .setTimestamp();

        // Update the security server message
        await interaction.editReply({ embeds: [concludedEmbed], components: [] });
        
        // 2. Update the external server message if this is an external request
        if (request.isExternal && request.externalGuildId && request.externalMessageId) {
            try {
                // Find the external server
                const externalServer = await ExternalServer.findByPk(request.externalGuildId);
                if (!externalServer) {
                    return interaction.followUp({ 
                        content: 'The external server is no longer registered in our system.', 
                        flags: [64] 
                    });
                }
                
                // Find the external guild and channel
                const externalGuild = await interaction.client.guilds.fetch(request.externalGuildId);
                if (!externalGuild) {
                    return interaction.followUp({ 
                        content: 'Could not find the external server. The request conclusion may not be visible to the requestor.', 
                        flags: [64] 
                    });
                }
                
                const externalChannel = await externalGuild.channels.fetch(externalServer.channelId);
                if (!externalChannel) {
                    return interaction.followUp({ 
                        content: 'Could not find the channel in the external server. The request conclusion may not be visible to the requestor.', 
                        flags: [64] 
                    });
                }
                
                // Get the message in the external channel
                const externalMessage = await externalChannel.messages.fetch(request.externalMessageId);
                if (!externalMessage) {
                    return interaction.followUp({ 
                        content: 'Could not find the original request message in the external server.', 
                        flags: [64] 
                    });
                }
                
                // Extract the original request information
                const externalEmbed = externalMessage.embeds[0];
                
                // Create a clean concluded embed with only the necessary fields
                const concludedExternalEmbed = new EmbedBuilder()
                    .setColor(0x00FF00)
                    .setTitle('✅ Security Request Concluded ✅')
                    .setFields(
                        { name: 'Location', value: request.location },
                        { name: 'Details', value: request.details },
                        { name: 'Contact', value: request.contact || 'Not provided' },
                        { name: 'Status', value: 'Completed' },
                        { name: 'Conclusion', value: reason },
                        { name: 'Concluded By', value: securityMember.user.tag }
                    )
                    .setTimestamp()
                    .setFooter({ text: `Request ID: ${requestId}` });
                
                await externalMessage.edit({ embeds: [concludedExternalEmbed] });
                
                return interaction.followUp({ 
                    content: `The external security request has been concluded. The notification in ${externalGuild.name} has been updated.`, 
                    flags: [64] 
                });
            } catch (externalError) {
                console.error(`[Interaction ${interactionId}] Error updating external message for conclusion:`, externalError);
                return interaction.followUp({ 
                    content: `The security request was concluded, but there was an error updating the external server: ${externalError.message}`, 
                    flags: [64] 
                });
            }
        } else {
            return interaction.followUp({ 
                content: 'The security request has been concluded.', 
                flags: [64] 
            });
        }
    } catch (error) {
        console.error(`[Interaction ${interactionId}] Error handling external conclude modal submit:`, error);
        if (!interaction.replied) {
            await interaction.followUp({ content: 'There was an error concluding the request.', flags: [64] });
        }
    }
}

// --- Main Event Export ---

module.exports = {
    name: Events.InteractionCreate,
    /**
     * Executes when an interaction is created.
     * Handles slash commands, button interactions, and modal submissions for security requests.
     * @param {Interaction} interaction The interaction object.
     * @returns {Promise<void>}
     * @example
     * // This event handler processes several types of interactions:
     * // 1. Slash commands (/request-security, /request-external-security, etc.)
     * // 2. Button clicks (Respond, Conclude Request)
     * // 3. Modal submissions (conclusion reasons)
     * // 
     * // For security request buttons, it:
     * // - Verifies the user has the security role
     * // - Processes internal or external security request responses
     * // - Updates both the main security server and customer servers for external requests
     * // - Maintains the database record of all security requests and their status
     */
    async execute(interaction) {
        const interactionId = interaction.id; // For logging
        console.log(`[Interaction ${interactionId}] Entered interactionCreate execute function. Type: ${interaction.type} (${InteractionType[interaction.type]})`); // Log type name

        try { // Top-level try-catch
            // --- Slash Command Handling ---
            if (interaction.isChatInputCommand()) {
                console.log(`[Interaction ${interactionId}] Handling as ChatInputCommand.`);
                const command = interaction.client.commands.get(interaction.commandName);

                if (!command) {
                    console.error(`No command matching ${interaction.commandName} was found.`);
                    await interaction.reply({ content: 'Error: Command not found!', ephemeral: true });
                    return;
                }

                try {
                    await command.execute(interaction);
                } catch (error) {
                    console.error(`Error executing ${interaction.commandName}`);
                    console.error(error);
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                    } else {
                        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                    }
                }
            }
            // --- Button Interaction Handling ---
            else if (interaction.isButton()) {
                console.log(`[Interaction ${interactionId}] Identified as Button Interaction.`);
                const customId = interaction.customId;
                
                // Get the security role ID from the database for this server
                const securityRoleId = await getSecurityRoleId(interaction.guild.id);

                console.log(`[Interaction ${interactionId}] Button Custom ID: ${customId}`);

                if (!securityRoleId) {
                    console.error(`[Interaction ${interactionId}] Error: Security role not configured for server ${interaction.guild.id}`);
                    return interaction.reply({ content: 'This server is not properly configured. Please ask an administrator to set up the security role using the /config-server command.', flags: [64] });
                }
                console.log(`[Interaction ${interactionId}] Security Role ID found: ${securityRoleId}`);

                // Check if this is an external request button
                if (customId.startsWith('extrespond_') || customId.startsWith('extconclude_')) {
                    // Parse the button custom ID (extrespond_requestId_guildId or extconclude_requestId_guildId)
                    const parts = customId.split('_');
                    if (parts.length !== 3) {
                        console.error(`[Interaction ${interactionId}] Invalid external button custom ID format: ${customId}`);
                        return interaction.reply({ content: 'Invalid button format. Please contact an administrator.', flags: [64] });
                    }
                    
                    const buttonType = parts[0]; // 'extrespond' or 'extconclude'
                    const requestId = parts[1];  // Original request ID
                    const externalGuildId = parts[2]; // External guild ID
                    
                    // Fetch the member
                    let member;
                    try {
                        member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);
                        if (!member) {
                            console.error(`[Interaction ${interactionId}] Failed to fetch member for user ${interaction.user.id}`);
                            return interaction.reply({ content: 'Could not retrieve your member information.', flags: [64] });
                        }
                        
                        // Check if user has security role
                        if (!member.roles.cache.has(securityRoleId)) {
                            console.log(`[Interaction ${interactionId}] User ${member.user.tag} lacks security role for external button ${customId}.`);
                            return interaction.reply({ content: 'You do not have permission to interact with these buttons.', flags: [64] });
                        }
                        
                        if (buttonType === 'extrespond') {
                            // Handle external respond button
                            await interaction.deferUpdate();
                            await handleExternalRespondButton(interaction, member, requestId, externalGuildId);
                        } else if (buttonType === 'extconclude') {
                            // Handle external conclude button
                            await handleExternalConcludeButton(interaction, requestId, externalGuildId);
                        }
                    } catch (memberError) {
                        console.error(`[Interaction ${interactionId}] Error during external button member fetch or role check:`, memberError);
                        return interaction.reply({ content: 'An error occurred while verifying your permissions.', flags: [64] });
                    }
                } else {
                    // Handle regular buttons (non-external)
                    let member;
                    try {
                        console.log(`[Interaction ${interactionId}] Attempting to fetch member...`);
                        // Ensure the member object is fetched, especially if GuildMembers intent was just enabled
                        member = interaction.member instanceof GuildMember ? interaction.member : await interaction.guild.members.fetch(interaction.user.id);
                        if (!member) {
                             console.error(`[Interaction ${interactionId}] Failed to fetch member for user ${interaction.user.id}`);
                             return interaction.reply({ content: 'Could not retrieve your member information.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending member fetch error reply:`, err));
                        }
                        console.log(`[Interaction ${interactionId}] Member fetched successfully: ${member.user.tag}`);

                        console.log(`[Interaction ${interactionId}] Checking if member has role ${securityRoleId}...`);
                        // Check if user has security role (needed for both buttons)
                        if (!member.roles.cache.has(securityRoleId)) {
                            console.log(`[Interaction ${interactionId}] User ${member.user.tag} lacks security role for button ${customId}.`);
                            return interaction.reply({ content: 'You do not have permission to interact with these buttons.', flags: [64] });
                        }
                        console.log(`[Interaction ${interactionId}] User ${member.user.tag} has security role.`);

                    } catch (memberError) {
                         console.error(`[Interaction ${interactionId}] Error during member fetch or role check:`, memberError);
                         return interaction.reply({ content: 'An error occurred while verifying your permissions.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending permission check error reply:`, err));
                    }

                    // --- Respond Button Logic ---
                    if (customId.startsWith('respond_')) {
                        console.log(`[Interaction ${interactionId}] Handling respond button.`);
                        try {
                            console.log(`[Interaction ${interactionId}] >>> Attempting deferUpdate...`); // Log before defer
                            await interaction.deferUpdate();
                            console.log(`[Interaction ${interactionId}] <<< deferUpdate successful.`); // Log after defer
                            await handleRespondButton(interaction, member);
                        } catch (deferError) { // Catch errors specifically from deferUpdate or handleRespondButton
                             console.error(`[Interaction ${interactionId}] Error during respond button defer/handle call:`, deferError);
                             // Attempt followUp if defer succeeded but handler failed, or if defer failed but interaction still valid
                             if (!interaction.replied) { // Check if not already replied (e.g. by a previous error handler)
                                 try {
                                     await interaction.followUp({ content: 'An error occurred while processing your response.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending respond error followUp:`, err));
                                 } catch (followUpError) {
                                     console.error(`[Interaction ${interactionId}] Further error trying to send followUp after defer/handle error:`, followUpError);
                                 }
                             }
                        }
                    }
                    // --- Conclude Button Logic ---
                    else if (customId.startsWith('conclude_')) {
                        console.log(`[Interaction ${interactionId}] Handling conclude button (showing modal).`);
                        await handleConcludeButton(interaction);
                    } else {
                         console.warn(`[Interaction ${interactionId}] Unrecognized button custom ID: ${customId}`);
                    }
                }
            }
            // --- Modal Submit Handling ---
            else if (interaction.isModalSubmit()) {
                 console.log(`[Interaction ${interactionId}] Handling as ModalSubmit.`);
                 const customId = interaction.customId; // Get modal custom ID

                 if (customId.startsWith('conclude_modal_')) {
                     try {
                         console.log(`[Interaction ${interactionId}] >>> Attempting deferUpdate for modal...`); // Log before defer
                         await interaction.deferUpdate(); // Acknowledge the modal submission
                         console.log(`[Interaction ${interactionId}] <<< deferUpdate successful for modal.`); // Log after defer
                         await handleConcludeModalSubmit(interaction); // Now call the handler
                     } catch (modalDeferError) {
                         console.error(`[Interaction ${interactionId}] Error during modal defer/handle call:`, modalDeferError);
                         if (!interaction.replied) {
                             try {
                                 await interaction.followUp({ content: 'An error occurred while processing the conclusion.', flags: [64] }).catch(err => console.error(`[Interaction ${interactionId}] Error sending modal error followUp:`, err));
                             } catch (followUpError) {
                                 console.error(`[Interaction ${interactionId}] Further error trying to send followUp after modal defer/handle error:`, followUpError);
                             }
                         }
                     }
                 } else if (customId.startsWith('extconclude_modal_')) {
                     // Handle external conclude modal
                     const parts = customId.split('_');
                     if (parts.length !== 4) {
                         console.error(`[Interaction ${interactionId}] Invalid external modal custom ID format: ${customId}`);
                         return interaction.reply({ content: 'Invalid modal format. Please contact an administrator.', ephemeral: true });
                     }
                     
                     const requestId = parts[2];  // Original request ID
                     const externalGuildId = parts[3]; // External guild ID
                     
                     try {
                         await interaction.deferUpdate();
                         await handleExternalConcludeModalSubmit(interaction, requestId, externalGuildId);
                     } catch (modalDeferError) {
                         console.error(`[Interaction ${interactionId}] Error during external modal defer/handle call:`, modalDeferError);
                         if (!interaction.replied) {
                             try {
                                 await interaction.followUp({ content: 'An error occurred while processing the conclusion.', flags: [64] });
                             } catch (followUpError) {
                                 console.error(`[Interaction ${interactionId}] Further error trying to send followUp after external modal defer/handle error:`, followUpError);
                             }
                         }
                     }
                 } else {
                      console.warn(`[Interaction ${interactionId}] Unrecognized modal custom ID: ${customId}`);
                 }
            } else {
                 console.warn(`[Interaction ${interactionId}] Unhandled interaction type: ${interaction.type} (${InteractionType[interaction.type]})`);
            }
        } catch (handlerError) {
             console.error(`[Interaction ${interactionId}] Uncaught error in interactionCreate handler:`, handlerError);
             // Attempt generic failure message if possible
             try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'An unexpected error occurred while handling this interaction.', flags: [64] });
                } else {
                    await interaction.followUp({ content: 'An unexpected error occurred while handling this interaction.', flags: [64] });
                }
             } catch (replyError) {
                 console.error(`[Interaction ${interactionId}] Failed to send generic error reply:`, replyError);
             }
        }
    },
};
