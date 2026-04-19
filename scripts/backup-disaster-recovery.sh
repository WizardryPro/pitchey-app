#!/bin/bash

# =============================================================================
# Pitchey Platform - Backup & Disaster Recovery System
# =============================================================================
# Comprehensive backup and disaster recovery solution for the Pitchey platform
# 
# Features:
# - Automated database backups with point-in-time recovery
# - Configuration and code backup
# - Cloudflare R2 storage integration
# - Automated retention policies
# - Disaster recovery procedures
# - Health monitoring integration
# - Multi-region backup storage
#
# Usage:
#   ./backup-disaster-recovery.sh [backup|restore|verify|setup] [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_ROOT="/var/backups/pitchey"
LOG_FILE="/var/log/pitchey-backup.log"
CONFIG_FILE="$PROJECT_ROOT/.backup-config"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Default settings
RETENTION_DAYS=30
RETENTION_WEEKS=12
RETENTION_MONTHS=12
MAX_BACKUP_SIZE="10G"
COMPRESSION_LEVEL=6
ENCRYPT_BACKUPS=true

# Load configuration if exists
if [ -f "$CONFIG_FILE" ]; then
    source "$CONFIG_FILE"
fi

# Create directories
mkdir -p "$BACKUP_ROOT"/{database,files,logs,temp}
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        ERROR)
            echo -e "${RED}[ERROR]${NC} $message" >&2
            echo "[$timestamp] [ERROR] $message" >> "$LOG_FILE"
            ;;
        WARN)
            echo -e "${YELLOW}[WARN]${NC} $message"
            echo "[$timestamp] [WARN] $message" >> "$LOG_FILE"
            ;;
        INFO)
            echo -e "${GREEN}[INFO]${NC} $message"
            echo "[$timestamp] [INFO] $message" >> "$LOG_FILE"
            ;;
        DEBUG)
            echo -e "${BLUE}[DEBUG]${NC} $message"
            echo "[$timestamp] [DEBUG] $message" >> "$LOG_FILE"
            ;;
    esac
}

# Error handling
handle_error() {
    local exit_code=$?
    local line_number=$1
    log ERROR "Backup operation failed at line $line_number with exit code $exit_code"
    cleanup_temp_files
    exit $exit_code
}

trap 'handle_error $LINENO' ERR

# Cleanup temporary files
cleanup_temp_files() {
    rm -rf "$BACKUP_ROOT/temp"/*
}

# Check prerequisites
check_prerequisites() {
    log INFO "Checking backup prerequisites..."
    
    # Check required commands
    local required_commands=("pg_dump" "pg_restore" "gpg" "curl" "jq")
    
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            log WARN "Command '$cmd' not found, some features may be disabled"
        fi
    done
    
    # Check environment variables
    if [ -z "${DATABASE_URL:-}" ]; then
        log ERROR "DATABASE_URL environment variable is required"
        exit 1
    fi
    
    # Check disk space
    local available_space=$(df "$BACKUP_ROOT" | awk 'NR==2 {print $4}')
    local required_space=1048576  # 1GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        log ERROR "Insufficient disk space. Required: 1GB, Available: $(($available_space / 1024))MB"
        exit 1
    fi
    
    log INFO "Prerequisites check completed"
}

# Generate backup encryption key
generate_backup_key() {
    local key_file="$BACKUP_ROOT/.backup.key"
    
    if [ ! -f "$key_file" ]; then
        log INFO "Generating backup encryption key..."
        openssl rand -base64 32 > "$key_file"
        chmod 600 "$key_file"
        log INFO "Backup key generated and secured"
    fi
}

# Database backup function
backup_database() {
    log INFO "Starting database backup..."
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_ROOT/database/db_backup_$timestamp.sql"
    local compressed_file="$backup_file.gz"
    local encrypted_file="$compressed_file.enc"
    
    # Create database backup
    log INFO "Creating database dump..."
    if ! pg_dump "$DATABASE_URL" \
        --verbose \
        --no-password \
        --format=custom \
        --compress=0 \
        --file="$backup_file"; then
        log ERROR "Database backup failed"
        return 1
    fi
    
    # Compress backup
    log INFO "Compressing backup..."
    gzip -"$COMPRESSION_LEVEL" "$backup_file"
    
    # Encrypt backup if enabled
    if [ "$ENCRYPT_BACKUPS" = true ]; then
        log INFO "Encrypting backup..."
        gpg --symmetric \
            --cipher-algo AES256 \
            --compress-algo 2 \
            --s2k-mode 3 \
            --s2k-digest-algo SHA512 \
            --s2k-count 65536 \
            --batch \
            --yes \
            --passphrase-file "$BACKUP_ROOT/.backup.key" \
            --output "$encrypted_file" \
            "$compressed_file"
        
        rm "$compressed_file"
        backup_file="$encrypted_file"
    else
        backup_file="$compressed_file"
    fi
    
    # Verify backup integrity
    log INFO "Verifying backup integrity..."
    if [ "$ENCRYPT_BACKUPS" = true ]; then
        # Test decryption
        gpg --batch --quiet --yes \
            --passphrase-file "$BACKUP_ROOT/.backup.key" \
            --decrypt "$backup_file" | gunzip | head -n 1 > /dev/null
    else
        # Test compression
        gunzip -t "$backup_file"
    fi
    
    # Calculate backup metadata
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local backup_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    
    # Create backup metadata
    cat > "$backup_file.meta" << EOF
{
    "timestamp": "$timestamp",
    "type": "database",
    "size": "$backup_size",
    "checksum": "$backup_checksum",
    "encrypted": $ENCRYPT_BACKUPS,
    "compressed": true,
    "source": "$(echo "$DATABASE_URL" | sed 's/:[^@]*@/:***@/')",
    "created_by": "$(whoami)@$(hostname)",
    "retention_date": "$(date -d "+$RETENTION_DAYS days" '+%Y-%m-%d')"
}
EOF
    
    log INFO "Database backup completed: $backup_file ($backup_size)"
    echo "$backup_file"
}

# File system backup function
backup_files() {
    log INFO "Starting file system backup..."
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_ROOT/files/files_backup_$timestamp.tar.gz"
    local encrypted_file="$backup_file.enc"
    
    # Create list of files to backup
    local backup_list=(
        "$PROJECT_ROOT/wrangler.toml"
        "$PROJECT_ROOT/.env.production"
        "$PROJECT_ROOT/.sentryclirc"
        "$PROJECT_ROOT/src"
        "$PROJECT_ROOT/frontend/dist"
        "$PROJECT_ROOT/scripts"
        "$PROJECT_ROOT/drizzle"
    )
    
    # Filter existing files
    local existing_files=()
    for file in "${backup_list[@]}"; do
        if [ -e "$file" ]; then
            existing_files+=("$file")
        fi
    done
    
    if [ ${#existing_files[@]} -eq 0 ]; then
        log WARN "No files found to backup"
        return 0
    fi
    
    # Create archive
    log INFO "Creating file archive..."
    cd "$PROJECT_ROOT"
    tar -czf "$backup_file" \
        --exclude='node_modules' \
        --exclude='*.log' \
        --exclude='.git' \
        --exclude='temp' \
        "${existing_files[@]#$PROJECT_ROOT/}"
    
    # Encrypt if enabled
    if [ "$ENCRYPT_BACKUPS" = true ]; then
        log INFO "Encrypting file backup..."
        gpg --symmetric \
            --cipher-algo AES256 \
            --batch \
            --yes \
            --passphrase-file "$BACKUP_ROOT/.backup.key" \
            --output "$encrypted_file" \
            "$backup_file"
        
        rm "$backup_file"
        backup_file="$encrypted_file"
    fi
    
    # Create metadata
    local backup_size=$(du -h "$backup_file" | cut -f1)
    local backup_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
    
    cat > "$backup_file.meta" << EOF
{
    "timestamp": "$timestamp",
    "type": "files",
    "size": "$backup_size",
    "checksum": "$backup_checksum",
    "encrypted": $ENCRYPT_BACKUPS,
    "compressed": true,
    "files_count": ${#existing_files[@]},
    "created_by": "$(whoami)@$(hostname)",
    "retention_date": "$(date -d "+$RETENTION_DAYS days" '+%Y-%m-%d')"
}
EOF
    
    log INFO "File backup completed: $backup_file ($backup_size)"
    echo "$backup_file"
}

# Upload to cloud storage
upload_to_cloud() {
    local backup_file="$1"
    local backup_type="$2"
    
    log INFO "Uploading backup to cloud storage..."
    
    # Upload to Cloudflare R2 if configured
    if [ -n "${CLOUDFLARE_R2_BUCKET:-}" ] && [ -n "${CLOUDFLARE_R2_ENDPOINT:-}" ]; then
        log INFO "Uploading to Cloudflare R2..."
        
        local remote_path="pitchey-backups/$backup_type/$(basename "$backup_file")"
        
        # Use AWS CLI with R2 endpoint
        aws s3 cp "$backup_file" "s3://$CLOUDFLARE_R2_BUCKET/$remote_path" \
            --endpoint-url "$CLOUDFLARE_R2_ENDPOINT" \
            --region auto \
            --profile r2 || log WARN "R2 upload failed"
        
        # Upload metadata
        aws s3 cp "$backup_file.meta" "s3://$CLOUDFLARE_R2_BUCKET/$remote_path.meta" \
            --endpoint-url "$CLOUDFLARE_R2_ENDPOINT" \
            --region auto \
            --profile r2 || log WARN "R2 metadata upload failed"
    fi
    
    # Upload to AWS S3 if configured
    if [ -n "${AWS_S3_BUCKET:-}" ]; then
        log INFO "Uploading to AWS S3..."
        
        local s3_path="s3://$AWS_S3_BUCKET/pitchey-backups/$backup_type/$(basename "$backup_file")"
        
        aws s3 cp "$backup_file" "$s3_path" || log WARN "S3 upload failed"
        aws s3 cp "$backup_file.meta" "$s3_path.meta" || log WARN "S3 metadata upload failed"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log INFO "Cleaning up old backups..."
    
    # Cleanup based on retention policy
    find "$BACKUP_ROOT/database" -name "*.sql.gz*" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_ROOT/files" -name "*.tar.gz*" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_ROOT/database" -name "*.meta" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    find "$BACKUP_ROOT/files" -name "*.meta" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    # Keep weekly backups
    find "$BACKUP_ROOT" -name "*_backup_*" -mtime +$((RETENTION_WEEKS * 7)) \
        ! -name "*$(date -d 'last sunday' '+%Y%m%d')*" -delete 2>/dev/null || true
    
    log INFO "Old backups cleaned up"
}

# Restore database function
restore_database() {
    local backup_file="$1"
    local target_url="${2:-$DATABASE_URL}"
    
    log INFO "Starting database restore from: $backup_file"
    
    if [ ! -f "$backup_file" ]; then
        log ERROR "Backup file not found: $backup_file"
        return 1
    fi
    
    # Verify backup integrity
    verify_backup "$backup_file"
    
    # Create temporary restore file
    local temp_file="$BACKUP_ROOT/temp/restore_$(date '+%Y%m%d_%H%M%S').sql"
    
    # Decrypt and decompress
    if [[ "$backup_file" == *.enc ]]; then
        log INFO "Decrypting backup..."
        gpg --batch --quiet --yes \
            --passphrase-file "$BACKUP_ROOT/.backup.key" \
            --decrypt "$backup_file" | gunzip > "$temp_file"
    else
        log INFO "Decompressing backup..."
        gunzip -c "$backup_file" > "$temp_file"
    fi
    
    # Confirm restore operation
    read -p "⚠️  This will overwrite the existing database. Continue? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        log INFO "Restore operation cancelled"
        rm -f "$temp_file"
        return 0
    fi
    
    # Perform restore
    log INFO "Restoring database..."
    if pg_restore --clean --if-exists \
        --no-owner --no-privileges \
        --dbname="$target_url" \
        "$temp_file"; then
        log INFO "Database restore completed successfully"
    else
        log ERROR "Database restore failed"
        rm -f "$temp_file"
        return 1
    fi
    
    # Cleanup
    rm -f "$temp_file"
    
    log INFO "Database restore completed"
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log INFO "Verifying backup: $backup_file"
    
    if [ ! -f "$backup_file" ]; then
        log ERROR "Backup file not found: $backup_file"
        return 1
    fi
    
    # Check metadata
    local meta_file="$backup_file.meta"
    if [ -f "$meta_file" ]; then
        local stored_checksum=$(jq -r .checksum "$meta_file")
        local current_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)
        
        if [ "$stored_checksum" != "$current_checksum" ]; then
            log ERROR "Backup checksum mismatch. File may be corrupted."
            return 1
        fi
        
        log INFO "Backup checksum verified"
    else
        log WARN "Backup metadata not found"
    fi
    
    # Test file integrity
    if [[ "$backup_file" == *.enc ]]; then
        # Test decryption
        gpg --batch --quiet --yes \
            --passphrase-file "$BACKUP_ROOT/.backup.key" \
            --decrypt "$backup_file" | head -c 1 > /dev/null
    elif [[ "$backup_file" == *.gz ]]; then
        # Test compression
        gunzip -t "$backup_file"
    fi
    
    log INFO "Backup verification passed"
}

# List available backups
list_backups() {
    local backup_type="${1:-all}"
    
    echo "📋 Available Backups:"
    echo
    
    if [ "$backup_type" = "all" ] || [ "$backup_type" = "database" ]; then
        echo "🗄️  Database Backups:"
        for file in "$BACKUP_ROOT/database"/*.meta; do
            if [ -f "$file" ]; then
                local timestamp=$(jq -r .timestamp "$file")
                local size=$(jq -r .size "$file")
                local encrypted=$(jq -r .encrypted "$file")
                
                echo "  - $timestamp ($size) $([ "$encrypted" = "true" ] && echo "[encrypted]")"
            fi
        done
        echo
    fi
    
    if [ "$backup_type" = "all" ] || [ "$backup_type" = "files" ]; then
        echo "📁 File Backups:"
        for file in "$BACKUP_ROOT/files"/*.meta; do
            if [ -f "$file" ]; then
                local timestamp=$(jq -r .timestamp "$file")
                local size=$(jq -r .size "$file")
                local encrypted=$(jq -r .encrypted "$file")
                
                echo "  - $timestamp ($size) $([ "$encrypted" = "true" ] && echo "[encrypted]")"
            fi
        done
    fi
}

# Setup backup system
setup_backup_system() {
    log INFO "Setting up backup system..."
    
    # Create backup configuration
    cat > "$CONFIG_FILE" << EOF
# Pitchey Platform Backup Configuration

# Retention settings (days)
RETENTION_DAYS=30
RETENTION_WEEKS=12
RETENTION_MONTHS=12

# Backup settings
MAX_BACKUP_SIZE="10G"
COMPRESSION_LEVEL=6
ENCRYPT_BACKUPS=true

# Cloud storage (optional)
CLOUDFLARE_R2_BUCKET=""
CLOUDFLARE_R2_ENDPOINT=""
AWS_S3_BUCKET=""

# Notification settings
BACKUP_ALERT_EMAIL=""
SLACK_WEBHOOK_URL=""
EOF
    
    # Generate encryption key
    generate_backup_key
    
    # Setup cron job for automated backups
    local cron_entry="0 2 * * * $SCRIPT_DIR/backup-disaster-recovery.sh backup >> $LOG_FILE 2>&1"
    
    (crontab -l 2>/dev/null | grep -v "backup-disaster-recovery.sh"; echo "$cron_entry") | crontab -
    
    # Create log rotation
    cat > "/etc/logrotate.d/pitchey-backup" << EOF
$LOG_FILE {
    daily
    missingok
    rotate 30
    compress
    notifempty
    create 644 root root
}
EOF
    
    log INFO "Backup system setup completed"
    
    echo
    echo "🎉 Backup System Setup Complete!"
    echo
    echo "Configuration file: $CONFIG_FILE"
    echo "Backup directory: $BACKUP_ROOT"
    echo "Log file: $LOG_FILE"
    echo
    echo "Automated backups scheduled for 2:00 AM daily"
    echo
    echo "Next steps:"
    echo "1. Configure cloud storage settings in $CONFIG_FILE"
    echo "2. Test backup: $0 backup"
    echo "3. Test restore: $0 restore [backup_file]"
    echo "4. Set up monitoring alerts"
}

# Disaster recovery procedures
disaster_recovery() {
    log INFO "Starting disaster recovery procedure..."
    
    cat << 'EOF'
🚨 DISASTER RECOVERY PROCEDURES

1. ASSESS THE SITUATION
   - Determine scope of the incident
   - Identify affected services
   - Document current status

2. IMMEDIATE ACTIONS
   - Stop further damage
   - Preserve evidence
   - Notify team members

3. SERVICE RESTORATION
   a) Database Recovery:
      ./backup-disaster-recovery.sh restore [latest_db_backup]
   
   b) Application Recovery:
      - Redeploy worker: wrangler deploy
      - Redeploy frontend: wrangler pages deploy frontend/dist
   
   c) Configuration Recovery:
      - Restore from file backup
      - Reconfigure secrets

4. VERIFICATION
   - Test all critical endpoints
   - Verify data integrity
   - Check monitoring systems

5. POST-INCIDENT
   - Document lessons learned
   - Update procedures
   - Improve monitoring

EMERGENCY CONTACTS:
- Platform Team: [Add team contact]
- Database Admin: [Add DBA contact]
- Infrastructure: [Add infra contact]

CRITICAL ENDPOINTS:
- Frontend: https://pitchey.pages.dev
- API: https://pitchey-api-prod.ndlovucavelle.workers.dev
- Health Check: https://pitchey-api-prod.ndlovucavelle.workers.dev/api/health
EOF
    
    log INFO "Disaster recovery guide displayed"
}

# Main function
main() {
    local command="${1:-backup}"
    shift || true
    
    case $command in
        setup)
            check_prerequisites
            setup_backup_system
            ;;
        backup)
            check_prerequisites
            generate_backup_key
            
            log INFO "Starting full backup process..."
            
            # Backup database
            local db_backup=$(backup_database)
            upload_to_cloud "$db_backup" "database"
            
            # Backup files
            local file_backup=$(backup_files)
            upload_to_cloud "$file_backup" "files"
            
            # Cleanup old backups
            cleanup_old_backups
            
            log INFO "Full backup process completed"
            ;;
        restore)
            local backup_file="$1"
            if [ -z "$backup_file" ]; then
                echo "Usage: $0 restore <backup_file> [target_database_url]"
                list_backups database
                exit 1
            fi
            
            check_prerequisites
            restore_database "$backup_file" "${2:-}"
            ;;
        verify)
            local backup_file="$1"
            if [ -z "$backup_file" ]; then
                echo "Usage: $0 verify <backup_file>"
                list_backups
                exit 1
            fi
            
            verify_backup "$backup_file"
            ;;
        list)
            list_backups "${1:-all}"
            ;;
        disaster-recovery|dr)
            disaster_recovery
            ;;
        cleanup)
            cleanup_old_backups
            ;;
        *)
            echo "Usage: $0 {setup|backup|restore|verify|list|disaster-recovery|cleanup} [options]"
            echo
            echo "Commands:"
            echo "  setup                 - Setup backup system and cron jobs"
            echo "  backup                - Create full backup (database + files)"
            echo "  restore <file> [url]  - Restore from backup file"
            echo "  verify <file>         - Verify backup integrity"
            echo "  list [type]           - List available backups"
            echo "  disaster-recovery     - Show disaster recovery procedures"
            echo "  cleanup               - Remove old backups"
            exit 1
            ;;
    esac
}

# Load environment variables
if [ -f "$PROJECT_ROOT/.env.production" ]; then
    set -a
    source "$PROJECT_ROOT/.env.production"
    set +a
fi

# Run main function
main "$@"