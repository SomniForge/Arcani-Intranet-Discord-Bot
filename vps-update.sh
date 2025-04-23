#!/bin/bash
# vps-update.sh - Optimized VPS deployment script for Arcani Discord Bot
# Includes: database backup, in-app notifications, and rollback functionality

# Configuration - Use current directory by default
BOT_DIR=$(pwd)
BACKUP_DIR="$BOT_DIR/backups"
LOG_FILE="$BOT_DIR/update.log"
DATABASE_PATH="$BOT_DIR/database/arcani_bot.sqlite"
NOTIFICATION_FILE="$BOT_DIR/update_notification.json"
MAX_BACKUPS=7  # Keep last 7 backups
REPO_URL="https://github.com/YOUR_USERNAME/Arcani-Discord-Bot.git"  # Replace with your GitHub repository URL

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Function to log messages and prepare notification
log() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $message" | tee -a "$LOG_FILE"
    
    # Add to notification file for the bot to pick up and send automatically
    echo "{ \"timestamp\": \"$timestamp\", \"message\": \"$message\", \"type\": \"update\" }" > "$NOTIFICATION_FILE"
}

# Function to create a notification with more details
create_notification() {
    local title="$1"
    local message="$2"
    local type="$3"  # update, error, maintenance
    local success="$4"  # true or false
    
    # Create JSON notification for the bot to pick up
    cat > "$NOTIFICATION_FILE" << EOF
{
    "timestamp": "$(date '+%Y-%m-%d %H:%M:%S')",
    "title": "$title",
    "message": "$message",
    "type": "$type",
    "success": $success
}
EOF
    echo "Created notification: $title"
}

# Function to check if the VPS is properly set up
check_vps_setup() {
    # Check for required commands
    for cmd in git node npm pgrep; do
        if ! command -v $cmd &> /dev/null; then
            log "❌ Required command not found: $cmd"
            log "Please install the missing package"
            return 1
        fi
    done
    
    # Check if we're in a proper directory
    if [ ! -f "$BOT_DIR/package.json" ] && [ ! -d "$BOT_DIR/.git" ]; then
        log "❌ This doesn't appear to be a valid bot directory"
        log "Missing package.json and not a git repository"
        
        # If REPO_URL is set, attempt to set up the project
        if [ -n "$REPO_URL" ]; then
            log "🔄 Attempting to clone repository from $REPO_URL"
            
            # Backup any existing files first
            mkdir -p "$BOT_DIR/pre_clone_backup"
            find "$BOT_DIR" -maxdepth 1 -not -path "$BOT_DIR" -not -path "$BOT_DIR/pre_clone_backup" -not -path "$BOT_DIR/backups" -exec mv {} "$BOT_DIR/pre_clone_backup/" \;
            
            # Clone the repository
            git clone "$REPO_URL" "$BOT_DIR/temp_clone"
            if [ $? -ne 0 ]; then
                log "❌ Clone failed"
                return 1
            fi
            
            # Move files from the clone to the current directory
            mv "$BOT_DIR/temp_clone"/* "$BOT_DIR/"
            mv "$BOT_DIR/temp_clone"/.[!.]* "$BOT_DIR/" 2>/dev/null || true
            rm -rf "$BOT_DIR/temp_clone"
            
            log "✅ Repository cloned successfully"
            return 0
        else
            log "⚠️ Set REPO_URL in this script to automatically clone the repository"
            return 1
        fi
    fi
    
    return 0
}

# Function to backup the database and code
backup() {
    local backup_name="arcani-bot_$(date '+%Y%m%d_%H%M%S')"
    local backup_file="$BACKUP_DIR/$backup_name.tar.gz"
    local db_backup="$BACKUP_DIR/$backup_name.sqlite"
    
    log "Creating backup: $backup_name"
    
    # Backup database if it exists
    if [ -f "$DATABASE_PATH" ]; then
        # Ensure the backup directory exists
        mkdir -p "$BACKUP_DIR"
        
        cp "$DATABASE_PATH" "$db_backup"
        if [ $? -ne 0 ]; then
            log "❌ Database backup failed"
            return 1
        fi
        log "✅ Database backup completed"
    else
        log "⚠️ Database file not found at $DATABASE_PATH, skipping database backup"
        # Create database directory if it doesn't exist
        mkdir -p "$(dirname "$DATABASE_PATH")"
    fi
    
    # Backup code (excluding large directories)
    tar -czf "$backup_file" --exclude="node_modules" --exclude="backups" --exclude=".git" -C "$BOT_DIR" .
    if [ $? -ne 0 ]; then
        log "❌ Code backup failed"
        return 1
    fi
    log "✅ Code backup completed: $backup_file"
    
    # Cleanup old backups
    if [ -d "$BACKUP_DIR" ]; then
        # Find and remove old tar.gz backups
        local excess_backups=$(find "$BACKUP_DIR" -name "*.tar.gz" -type f -printf '%T@ %p\n' | sort -nr | awk -v max=$MAX_BACKUPS 'NR>max {print $2}')
        
        if [ -n "$excess_backups" ]; then
            log "Cleaning up old backups..."
            echo "$excess_backups" | xargs rm -f
            
            # Also remove corresponding database backups
            for old_backup in $excess_backups; do
                local base_name=$(basename "$old_backup" .tar.gz)
                rm -f "$BACKUP_DIR/${base_name}.sqlite"
            done
        fi
    fi
    
    return 0
}

# Function to restore from backup
restore_from_backup() {
    local backup_name="$1"
    local code_backup="$BACKUP_DIR/${backup_name}.tar.gz"
    local db_backup="$BACKUP_DIR/${backup_name}.sqlite"
    
    log "🔄 Attempting to restore from backup: $backup_name"
    
    # Stop the bot if it's running
    stop_bot
    
    # Restore database if backup exists
    if [ -f "$db_backup" ]; then
        # Ensure the database directory exists
        mkdir -p "$(dirname "$DATABASE_PATH")"
        
        cp "$db_backup" "$DATABASE_PATH"
        if [ $? -ne 0 ]; then
            log "❌ Database restore failed"
            return 1
        fi
        log "✅ Database restored"
    else
        log "⚠️ Database backup not found: $db_backup"
    fi
    
    # Restore code if backup exists
    if [ -f "$code_backup" ]; then
        # Save node_modules to avoid reinstalling all dependencies
        if [ -d "$BOT_DIR/node_modules" ]; then
            mv "$BOT_DIR/node_modules" "/tmp/node_modules_$(date '+%s')"
        fi
        
        # Clear bot directory except backups, .git, and node_modules
        find "$BOT_DIR" -mindepth 1 -maxdepth 1 \
            ! -name "backups" \
            ! -name ".git" \
            ! -name "vps-update.sh" \
            ! -name "update.log" \
            -exec rm -rf {} \;
        
        # Extract backup
        tar -xzf "$code_backup" -C "$BOT_DIR"
        if [ $? -ne 0 ]; then
            log "❌ Code restore failed"
            return 1
        fi
        
        # Restore node_modules
        if [ -d "/tmp/node_modules_$(date '+%s')" ]; then
            mv "/tmp/node_modules_$(date '+%s')" "$BOT_DIR/node_modules"
        fi
        
        log "✅ Code restored"
    else
        log "❌ Code backup not found: $code_backup"
        return 1
    fi
    
    # Start the bot
    start_bot
    
    log "✅ Rollback completed successfully"
    return 0
}

# Function to find and stop the bot
stop_bot() {
    # Try to find the bot process using various methods
    local bot_pid=""
    
    # Method 1: Look for node index.js
    bot_pid=$(pgrep -f "node.*index.js" | head -n 1)
    
    # Method 2: Look for node with arcani in the command
    if [ -z "$bot_pid" ]; then
        bot_pid=$(pgrep -f "node.*arcani" | head -n 1)
    fi
    
    # If we found a process, try to stop it
    if [ -n "$bot_pid" ]; then
        log "🛑 Stopping the bot (PID: $bot_pid)..."
        kill "$bot_pid" 2>/dev/null
        sleep 3
        
        # Check if process is still running and force kill if needed
        if ps -p "$bot_pid" > /dev/null 2>&1; then
            log "⚠️ Bot didn't stop gracefully, force killing..."
            kill -9 "$bot_pid" 2>/dev/null
            sleep 1
        fi
        
        log "✅ Bot stopped"
    else
        log "ℹ️ No running bot process found"
    fi
}

# Function to start the bot
start_bot() {
    cd "$BOT_DIR" || { log "❌ Could not navigate to bot directory"; return 1; }
    
    # Check if index.js exists
    if [ ! -f "$BOT_DIR/index.js" ]; then
        log "❌ index.js not found in $BOT_DIR"
        return 1
    fi
    
    log "🚀 Starting the bot..."
    
    # Create a startup script that handles environment
    cat > "$BOT_DIR/start_bot.sh" << 'EOF'
#!/bin/bash
# Load environment variables if .env exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi
node index.js
EOF
    
    chmod +x "$BOT_DIR/start_bot.sh"
    
    # Start the bot with nohup
    nohup "$BOT_DIR/start_bot.sh" > bot.log 2>&1 &
    local new_pid=$!
    
    # Verify the bot started successfully
    sleep 3
    if ps -p "$new_pid" > /dev/null 2>&1; then
        log "✅ Bot started with PID: $new_pid"
        return 0
    else
        # Check if the process died immediately
        log "❌ Bot process failed to start or died immediately"
        log "Check bot.log for details:"
        tail -n 20 "$BOT_DIR/bot.log" | tee -a "$LOG_FILE"
        return 1
    fi
}

# Function to setup Git if needed
setup_git() {
    # Check if .git directory exists
    if [ ! -d "$BOT_DIR/.git" ]; then
        log "🔄 Initializing Git repository..."
        
        # Initialize git
        git init
        if [ $? -ne 0 ]; then
            log "❌ Failed to initialize git repository"
            return 1
        fi
        
        # Configure git
        git config --local user.name "Arcani Bot"
        git config --local user.email "bot@example.com"
        
        # Add remote if REPO_URL is set
        if [ -n "$REPO_URL" ]; then
            git remote add origin "$REPO_URL"
            if [ $? -ne 0 ]; then
                log "⚠️ Failed to add remote origin"
            else
                log "✅ Remote origin added: $REPO_URL"
            fi
        else
            log "⚠️ No REPO_URL specified, skipping remote setup"
        fi
        
        # Add all existing files if this is an existing installation
        if [ -f "$BOT_DIR/package.json" ]; then
            git add .
            git commit -m "Initial commit from existing installation"
            log "✅ Existing files committed to repository"
        fi
    else
        # Make sure the remote is set correctly if REPO_URL is provided
        if [ -n "$REPO_URL" ]; then
            if ! git remote | grep -q "origin"; then
                git remote add origin "$REPO_URL"
                log "✅ Added missing remote origin"
            else
                # Update origin URL if it's different
                current_url=$(git remote get-url origin 2>/dev/null)
                if [ "$current_url" != "$REPO_URL" ]; then
                    git remote set-url origin "$REPO_URL"
                    log "✅ Updated remote origin URL"
                fi
            fi
        fi
    fi
    
    return 0
}

# Main update function
update() {
    log "🔄 Beginning update process for Arcani Discord Bot"
    
    # Navigate to the bot directory
    cd "$BOT_DIR" || { log "❌ Error: Could not navigate to bot directory"; return 1; }
    
    # Check VPS setup
    check_vps_setup || { log "⚠️ VPS setup issues detected, continuing anyway"; }
    
    # Set up Git if needed
    setup_git || { log "⚠️ Git setup failed, continuing anyway"; }
    
    # Backup before updating
    local backup_name="arcani-bot_$(date '+%Y%m%d_%H%M%S')"
    backup || { log "❌ Backup failed, but continuing with update"; }
    
    # Check if we're in a git repository
    if [ -d "$BOT_DIR/.git" ]; then
        # Try to identify the current branch
        local current_branch=$(git symbolic-ref --short HEAD 2>/dev/null)
        if [ -z "$current_branch" ]; then
            current_branch="main"  # Default to main if we can't determine branch
        fi
        
        # Check for local changes
        if [ -n "$(git status --porcelain)" ]; then
            log "⚠️ Warning: There are uncommitted changes in the bot directory"
            log "Stashing local changes..."
            git stash
        fi
        
        # Pull the latest changes
        log "📥 Pulling latest changes from GitHub..."
        
        # Get the current commit hash before pull
        local old_commit=$(git rev-parse HEAD 2>/dev/null)
        
        git pull origin $current_branch
        if [ $? -ne 0 ]; then
            log "❌ Git pull failed, but continuing with update"
            create_notification "Update Failed" "Failed to pull latest changes from GitHub." "error" false
        else
            # Get the new commit hash
            local new_commit=$(git rev-parse HEAD 2>/dev/null)
            
            # If the commit changed, get a list of changes to include in notification
            if [ "$old_commit" != "$new_commit" ] && [ -n "$old_commit" ] && [ -n "$new_commit" ]; then
                log "✅ Git pull successful - new changes detected"
                
                # Get a summary of changes for the notification
                local changes=$(git log --pretty=format:"%s" $old_commit..$new_commit | head -n 5)
                if [ -n "$changes" ]; then
                    # Get the version from package.json if available
                    local version=$(grep -o '"version": "[^"]*"' package.json 2>/dev/null | cut -d'"' -f4)
                    if [ -z "$version" ]; then
                        version="latest"
                    fi
                    
                    # Format the commit messages in a way that the JS parser can identify and format them easily
                    # Each commit is on its own line, and JavaScript will convert them to bullet points
                    local formatted_changes=$(echo "$changes" | tr '\n' '|' | sed 's/|/\\n/g')
                    
                    # Create notification with changes in a format the JS code can easily parse
                    create_notification "Bot Updated to $version" "The bot has been updated with the following changes:\\n\\n$formatted_changes\\n\\nUpdate completed at $(date '+%Y-%m-%d %H:%M:%S')" "update" true
                else
                    create_notification "Bot Updated" "The bot has been updated to the latest version." "update" true
                fi
            else
                log "✅ Git pull successful - already up to date"
                create_notification "Bot Update Check" "The bot is already running the latest version." "update" true
            fi
        fi
    else
        log "⚠️ Not a git repository, skipping git pull"
    fi
    
    # Install dependencies
    log "📦 Installing dependencies..."
    npm install
    if [ $? -ne 0 ]; then
        log "❌ npm install failed, attempting rollback"
        create_notification "Update Failed" "Failed to install dependencies. Rolling back to previous version." "error" false
        restore_from_backup "$backup_name"
        return 1
    fi
    log "✅ Dependencies installed successfully"
    
    # Deploy commands if possible
    if [ -f "$BOT_DIR/deploy-commands.js" ]; then
        log "🔄 Deploying slash commands..."
        node deploy-commands.js
        if [ $? -ne 0 ]; then
            log "⚠️ Command deployment failed - this is not critical, continuing..."
        else
            log "✅ Commands deployed successfully"
        fi
    fi
    
    # Stop the bot if it's running
    stop_bot
    
    # Start the bot
    start_bot
    if [ $? -ne 0 ]; then
        log "❌ Failed to start the bot, attempting rollback"
        create_notification "Update Failed" "Failed to start the bot. Rolling back to previous version." "error" false
        restore_from_backup "$backup_name"
        return 1
    fi
    
    log "✅ Update completed successfully"
    return 0
}

# Entry point
log "🤖 Arcani Discord Bot VPS Updater v1.2.0"
update
exit_code=$?

if [ $exit_code -eq 0 ]; then
    log "✨ Update process completed successfully"
else
    log "❌ Update process failed with exit code: $exit_code"
    # Create a final error notification if it failed
    if [ ! -f "$NOTIFICATION_FILE" ]; then
        create_notification "Update Process Failed" "The update process failed with exit code: $exit_code" "error" false
    fi
fi

exit $exit_code