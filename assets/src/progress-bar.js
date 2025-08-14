/**
 * Email Tracker Progress Bar Component
 */
(function($) {
    'use strict';

    window.EmailTrackerProgress = {
        
        activeProcesses: {},
        updateInterval: 2000, // Update every 2 seconds
        
        /**
         * Initialize progress bar
         */
        init: function() {
            this.bindEvents();
            this.checkActiveProcesses();
        },
        
        /**
         * Bind events
         */
        bindEvents: function() {
            const self = this;
            
            // Start bulk operation
            $(document).on('click', '.emtr-start-bulk-operation', function(e) {
                e.preventDefault();
                const $button = $(this);
                const operation = $button.data('operation');
                const data = self.gatherOperationData($button);
                
                self.startOperation(operation, data, $button);
            });
            
            // Cancel operation
            $(document).on('click', '.emtr-cancel-operation', function(e) {
                e.preventDefault();
                const processId = $(this).data('process-id');
                self.cancelOperation(processId);
            });
            
            // Retry failed operation
            $(document).on('click', '.emtr-retry-operation', function(e) {
                e.preventDefault();
                const $button = $(this);
                const operation = $button.data('operation');
                const data = self.gatherOperationData($button);
                
                self.startOperation(operation, data, $button);
            });
        },
        
        /**
         * Start bulk operation
         */
        startOperation: function(operation, data, $button) {
            const self = this;
            
            // Disable button
            $button.prop('disabled', true).addClass('updating-message');
            
            // Create progress container
            const $container = this.createProgressContainer(operation);
            $button.closest('.emtr-bulk-actions').after($container);
            
            // Start operation via AJAX
            $.ajax({
                url: emtr_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'emtr_start_bulk_operation',
                    operation: operation,
                    data: data,
                    nonce: emtr_ajax.nonce
                },
                success: function(response) {
                    if (response.success) {
                        const processId = response.data.process_id;
                        
                        // Track active process
                        self.activeProcesses[processId] = {
                            operation: operation,
                            container: $container,
                            button: $button
                        };
                        
                        // Start monitoring progress
                        self.monitorProgress(processId);
                        
                        // Show success message
                        self.showNotice('Bulk operation started successfully!', 'success');
                    } else {
                        self.showNotice(response.data.message || 'Failed to start operation', 'error');
                        $button.prop('disabled', false).removeClass('updating-message');
                        $container.remove();
                    }
                },
                error: function() {
                    self.showNotice('An error occurred while starting the operation', 'error');
                    $button.prop('disabled', false).removeClass('updating-message');
                    $container.remove();
                }
            });
        },
        
        /**
         * Create progress container
         */
        createProgressContainer: function(operation) {
            const operationLabels = {
                'email_cleanup': 'Email Cleanup',
                'email_export': 'Email Export',
                'email_import': 'Email Import',
                'email_resend': 'Email Resend'
            };
            
            const label = operationLabels[operation] || operation;
            
            const html = `
                <div class="emtr-progress-container" data-operation="${operation}">
                    <div class="emtr-progress-header">
                        <h4>${label}</h4>
                        <button class="button button-link emtr-cancel-operation" data-process-id="">
                            <span class="dashicons dashicons-no"></span> Cancel
                        </button>
                    </div>
                    <div class="emtr-progress-wrapper">
                        <div class="emtr-progress-bar">
                            <div class="emtr-progress-fill" style="width: 0%">
                                <span class="emtr-progress-text">0%</span>
                            </div>
                        </div>
                        <div class="emtr-progress-info">
                            <span class="emtr-progress-status">Initializing...</span>
                            <span class="emtr-progress-details">0 / 0 items</span>
                        </div>
                    </div>
                    <div class="emtr-progress-time">
                        <span class="emtr-time-elapsed">Elapsed: 0s</span>
                        <span class="emtr-time-remaining">Remaining: calculating...</span>
                    </div>
                </div>
            `;
            
            return $(html);
        },
        
        /**
         * Monitor progress
         */
        monitorProgress: function(processId) {
            const self = this;
            const process = this.activeProcesses[processId];
            
            if (!process) return;
            
            const startTime = Date.now();
            
            const checkProgress = function() {
                $.ajax({
                    url: emtr_ajax.ajax_url,
                    type: 'POST',
                    data: {
                        action: 'emtr_get_progress',
                        process_id: processId,
                        nonce: emtr_ajax.nonce
                    },
                    success: function(response) {
                        if (response.success && response.data) {
                            const progress = response.data;
                            
                            // Update process ID in cancel button
                            process.container.find('.emtr-cancel-operation').data('process-id', processId);
                            
                            // Update progress bar
                            self.updateProgressBar(process.container, progress, startTime);
                            
                            // Check if completed or cancelled
                            if (progress.status === 'completed') {
                                self.completeOperation(processId, progress);
                            } else if (progress.status === 'cancelled') {
                                self.cancelledOperation(processId);
                            } else if (progress.status === 'failed') {
                                self.failedOperation(processId, progress);
                            } else {
                                // Continue monitoring
                                setTimeout(checkProgress, self.updateInterval);
                            }
                        } else {
                            // Error getting progress
                            setTimeout(checkProgress, self.updateInterval * 2);
                        }
                    },
                    error: function() {
                        // Retry after longer interval
                        setTimeout(checkProgress, self.updateInterval * 2);
                    }
                });
            };
            
            // Start monitoring
            checkProgress();
        },
        
        /**
         * Update progress bar
         */
        updateProgressBar: function($container, progress, startTime) {
            const percentage = progress.percentage || 0;
            const processed = progress.processed || 0;
            const total = progress.total || 0;
            
            // Update bar fill
            $container.find('.emtr-progress-fill')
                .css('width', percentage + '%')
                .find('.emtr-progress-text')
                .text(percentage + '%');
            
            // Update status
            let statusText = 'Processing...';
            if (progress.status === 'completed') {
                statusText = 'Completed!';
            } else if (progress.status === 'cancelled') {
                statusText = 'Cancelled';
            } else if (progress.status === 'failed') {
                statusText = 'Failed';
            }
            $container.find('.emtr-progress-status').text(statusText);
            
            // Update details
            $container.find('.emtr-progress-details').text(`${processed} / ${total} items`);
            
            // Update time
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            $container.find('.emtr-time-elapsed').text(`Elapsed: ${this.formatTime(elapsed)}`);
            
            // Calculate remaining time
            if (processed > 0 && percentage < 100) {
                const timePerItem = elapsed / processed;
                const remaining = Math.floor(timePerItem * (total - processed));
                $container.find('.emtr-time-remaining').text(`Remaining: ${this.formatTime(remaining)}`);
            } else if (percentage >= 100) {
                $container.find('.emtr-time-remaining').text('Complete!');
            }
        },
        
        /**
         * Complete operation
         */
        completeOperation: function(processId, progress) {
            const process = this.activeProcesses[processId];
            if (!process) return;
            
            // Update UI
            process.container.addClass('emtr-progress-completed');
            process.container.find('.emtr-cancel-operation').remove();
            
            // Re-enable button
            process.button.prop('disabled', false).removeClass('updating-message');
            
            // Show success message
            this.showNotice(`Operation completed! Processed ${progress.processed} items.`, 'success');
            
            // Remove from active processes
            delete this.activeProcesses[processId];
            
            // Fade out after 5 seconds
            setTimeout(() => {
                process.container.fadeOut(() => {
                    process.container.remove();
                });
            }, 5000);
        },
        
        /**
         * Cancelled operation
         */
        cancelledOperation: function(processId) {
            const process = this.activeProcesses[processId];
            if (!process) return;
            
            // Update UI
            process.container.addClass('emtr-progress-cancelled');
            process.container.find('.emtr-cancel-operation').remove();
            
            // Re-enable button
            process.button.prop('disabled', false).removeClass('updating-message');
            
            // Show notice
            this.showNotice('Operation cancelled', 'warning');
            
            // Remove from active processes
            delete this.activeProcesses[processId];
        },
        
        /**
         * Failed operation
         */
        failedOperation: function(processId, progress) {
            const process = this.activeProcesses[processId];
            if (!process) return;
            
            // Update UI
            process.container.addClass('emtr-progress-failed');
            process.container.find('.emtr-cancel-operation')
                .removeClass('emtr-cancel-operation')
                .addClass('emtr-retry-operation')
                .html('<span class="dashicons dashicons-update"></span> Retry');
            
            // Re-enable button
            process.button.prop('disabled', false).removeClass('updating-message');
            
            // Show error message
            const message = progress.error || 'Operation failed';
            this.showNotice(message, 'error');
            
            // Remove from active processes
            delete this.activeProcesses[processId];
        },
        
        /**
         * Cancel operation
         */
        cancelOperation: function(processId) {
            const self = this;
            
            $.ajax({
                url: emtr_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'emtr_cancel_operation',
                    process_id: processId,
                    nonce: emtr_ajax.nonce
                },
                success: function(response) {
                    if (response.success) {
                        self.cancelledOperation(processId);
                    }
                }
            });
        },
        
        /**
         * Check for active processes on page load
         */
        checkActiveProcesses: function() {
            const self = this;
            
            $.ajax({
                url: emtr_ajax.ajax_url,
                type: 'POST',
                data: {
                    action: 'emtr_get_active_processes',
                    nonce: emtr_ajax.nonce
                },
                success: function(response) {
                    if (response.success && response.data) {
                        $.each(response.data, function(processId, progress) {
                            if (progress.status === 'processing') {
                                // Recreate progress container
                                const $container = self.createProgressContainer(progress.type);
                                $('.emtr-bulk-actions').first().after($container);
                                
                                // Track process
                                self.activeProcesses[processId] = {
                                    operation: progress.type,
                                    container: $container,
                                    button: $('.emtr-start-bulk-operation[data-operation="' + progress.type + '"]')
                                };
                                
                                // Resume monitoring
                                self.monitorProgress(processId);
                            }
                        });
                    }
                }
            });
        },
        
        /**
         * Gather operation data from form
         */
        gatherOperationData: function($button) {
            const $form = $button.closest('form');
            const data = {};
            
            $form.find('input, select, textarea').each(function() {
                const $input = $(this);
                const name = $input.attr('name');
                if (name) {
                    data[name] = $input.val();
                }
            });
            
            return data;
        },
        
        /**
         * Format time in human readable format
         */
        formatTime: function(seconds) {
            if (seconds < 60) {
                return seconds + 's';
            } else if (seconds < 3600) {
                const minutes = Math.floor(seconds / 60);
                const secs = seconds % 60;
                return minutes + 'm ' + secs + 's';
            } else {
                const hours = Math.floor(seconds / 3600);
                const minutes = Math.floor((seconds % 3600) / 60);
                return hours + 'h ' + minutes + 'm';
            }
        },
        
        /**
         * Show notice
         */
        showNotice: function(message, type) {
            const $notice = $(`
                <div class="notice notice-${type} is-dismissible">
                    <p>${message}</p>
                    <button type="button" class="notice-dismiss">
                        <span class="screen-reader-text">Dismiss this notice.</span>
                    </button>
                </div>
            `);
            
            $('.wrap h1').first().after($notice);
            
            // Auto dismiss after 5 seconds
            setTimeout(() => {
                $notice.fadeOut(() => {
                    $notice.remove();
                });
            }, 5000);
        }
    };
    
    // Initialize on document ready
    $(document).ready(function() {
        EmailTrackerProgress.init();
    });
    
})(jQuery);