<?php
/**
 * Chunk Processor using Action Scheduler
 *
 * @package EmailTracker
 */

namespace EmailTracker\Core;

use ActionScheduler;
use ActionScheduler_Store;

/**
 * Class Chunk_Processor
 * Handles chunked processing of large datasets using Action Scheduler
 */
class Chunk_Processor {

	/**
	 * Hook name for chunk processing
	 *
	 * @var string
	 */
	const PROCESS_CHUNK_HOOK = 'emtr_process_chunk';

	/**
	 * Hook name for progress update
	 *
	 * @var string
	 */
	const UPDATE_PROGRESS_HOOK = 'emtr_update_progress';

	/**
	 * Default chunk size
	 *
	 * @var int
	 */
	const DEFAULT_CHUNK_SIZE = 50;

	/**
	 * Option key for storing progress
	 *
	 * @var string
	 */
	const PROGRESS_OPTION_KEY = 'emtr_chunk_progress';

	/**
	 * Initialize the chunk processor
	 */
	public function __construct() {
		add_action( self::PROCESS_CHUNK_HOOK, array( $this, 'process_chunk' ), 10, 1 );
		add_action( self::UPDATE_PROGRESS_HOOK, array( $this, 'update_progress' ), 10, 1 );
	}

	/**
	 * Start batch processing
	 *
	 * @param array $args Processing arguments.
	 * @return string Process ID
	 */
	public function start_batch_process( $args = array() ) {
		$defaults = array(
			'type'       => 'email_cleanup',
			'chunk_size' => self::DEFAULT_CHUNK_SIZE,
			'total'      => 0,
			'processed'  => 0,
			'data'       => array(),
		);

		$args = wp_parse_args( $args, $defaults );
		
		// Generate unique process ID
		$process_id = 'emtr_' . wp_generate_password( 12, false );
		
		// Initialize progress
		$this->init_progress( $process_id, $args );
		
		// Schedule first chunk
		as_enqueue_async_action(
			self::PROCESS_CHUNK_HOOK,
			array(
				'process_id' => $process_id,
				'offset'     => 0,
			),
			'email-tracker'
		);
		
		return $process_id;
	}

	/**
	 * Process a single chunk
	 *
	 * @param array $args Processing arguments.
	 */
	public function process_chunk( $args ) {
		$process_id = $args['process_id'];
		$offset     = $args['offset'];
		
		$progress = $this->get_progress( $process_id );
		
		if ( ! $progress || $progress['status'] === 'cancelled' ) {
			return;
		}
		
		$chunk_size = $progress['chunk_size'];
		$type       = $progress['type'];
		
		// Process based on type
		switch ( $type ) {
			case 'email_cleanup':
				$processed = $this->process_email_cleanup_chunk( $offset, $chunk_size, $progress );
				break;
			case 'email_export':
				$processed = $this->process_email_export_chunk( $offset, $chunk_size, $progress );
				break;
			case 'email_import':
				$processed = $this->process_email_import_chunk( $offset, $chunk_size, $progress );
				break;
			default:
				$processed = apply_filters( 'emtr_process_custom_chunk', 0, $type, $offset, $chunk_size, $progress );
				break;
		}
		
		// Update progress
		$progress['processed'] += $processed;
		$progress['percentage'] = $progress['total'] > 0 ? round( ( $progress['processed'] / $progress['total'] ) * 100 ) : 0;
		
		if ( $progress['processed'] >= $progress['total'] ) {
			$progress['status'] = 'completed';
			$progress['completed_at'] = current_time( 'mysql' );
		}
		
		$this->update_progress( array( 'process_id' => $process_id, 'progress' => $progress ) );
		
		// Schedule next chunk if not completed
		if ( $progress['status'] !== 'completed' && $processed > 0 ) {
			as_enqueue_async_action(
				self::PROCESS_CHUNK_HOOK,
				array(
					'process_id' => $process_id,
					'offset'     => $offset + $chunk_size,
				),
				'email-tracker'
			);
		}
	}

	/**
	 * Process email cleanup chunk
	 *
	 * @param int   $offset Offset.
	 * @param int   $chunk_size Chunk size.
	 * @param array $progress Progress data.
	 * @return int Number of items processed
	 */
	private function process_email_cleanup_chunk( $offset, $chunk_size, $progress ) {
		global $wpdb;
		
		$days_old = isset( $progress['data']['days_old'] ) ? $progress['data']['days_old'] : 30;
		$date_threshold = date( 'Y-m-d H:i:s', strtotime( "-{$days_old} days" ) );
		
		$table_name = $wpdb->prefix . 'emtr_email_logs';
		
		// Get emails to delete
		$emails = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT id FROM {$table_name} 
				WHERE created_at < %s 
				LIMIT %d OFFSET %d",
				$date_threshold,
				$chunk_size,
				$offset
			)
		);
		
		if ( empty( $emails ) ) {
			return 0;
		}
		
		$email_ids = wp_list_pluck( $emails, 'id' );
		$placeholders = implode( ',', array_fill( 0, count( $email_ids ), '%d' ) );
		
		// Delete related data
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}emtr_email_open_logs WHERE email_id IN ($placeholders)",
				$email_ids
			)
		);
		
		$wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$wpdb->prefix}emtr_email_click_logs WHERE email_id IN ($placeholders)",
				$email_ids
			)
		);
		
		// Delete emails
		$deleted = $wpdb->query(
			$wpdb->prepare(
				"DELETE FROM {$table_name} WHERE id IN ($placeholders)",
				$email_ids
			)
		);
		
		return count( $emails );
	}

	/**
	 * Process email export chunk
	 *
	 * @param int   $offset Offset.
	 * @param int   $chunk_size Chunk size.
	 * @param array $progress Progress data.
	 * @return int Number of items processed
	 */
	private function process_email_export_chunk( $offset, $chunk_size, $progress ) {
		global $wpdb;
		
		$table_name = $wpdb->prefix . 'emtr_email_logs';
		$export_file = isset( $progress['data']['export_file'] ) ? $progress['data']['export_file'] : '';
		
		if ( empty( $export_file ) ) {
			return 0;
		}
		
		// Get emails to export
		$emails = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT * FROM {$table_name} 
				ORDER BY id DESC 
				LIMIT %d OFFSET %d",
				$chunk_size,
				$offset
			),
			ARRAY_A
		);
		
		if ( empty( $emails ) ) {
			return 0;
		}
		
		// Append to CSV file
		$handle = fopen( $export_file, 'a' );
		
		if ( $offset === 0 ) {
			// Write headers
			fputcsv( $handle, array_keys( $emails[0] ) );
		}
		
		foreach ( $emails as $email ) {
			fputcsv( $handle, $email );
		}
		
		fclose( $handle );
		
		return count( $emails );
	}

	/**
	 * Process email import chunk
	 *
	 * @param int   $offset Offset.
	 * @param int   $chunk_size Chunk size.
	 * @param array $progress Progress data.
	 * @return int Number of items processed
	 */
	private function process_email_import_chunk( $offset, $chunk_size, $progress ) {
		global $wpdb;
		
		$import_file = isset( $progress['data']['import_file'] ) ? $progress['data']['import_file'] : '';
		
		if ( ! file_exists( $import_file ) ) {
			return 0;
		}
		
		$handle = fopen( $import_file, 'r' );
		
		// Skip to offset
		for ( $i = 0; $i <= $offset; $i++ ) {
			$row = fgetcsv( $handle );
			if ( $i === 0 ) {
				$headers = $row; // Store headers
			}
		}
		
		$processed = 0;
		$table_name = $wpdb->prefix . 'emtr_email_logs';
		
		for ( $i = 0; $i < $chunk_size; $i++ ) {
			$row = fgetcsv( $handle );
			if ( $row === false ) {
				break;
			}
			
			$data = array_combine( $headers, $row );
			
			// Insert email
			$wpdb->insert( $table_name, $data );
			$processed++;
		}
		
		fclose( $handle );
		
		return $processed;
	}

	/**
	 * Initialize progress tracking
	 *
	 * @param string $process_id Process ID.
	 * @param array  $args Initial arguments.
	 */
	private function init_progress( $process_id, $args ) {
		$progress = array(
			'process_id'  => $process_id,
			'type'        => $args['type'],
			'status'      => 'processing',
			'total'       => $args['total'],
			'processed'   => 0,
			'percentage'  => 0,
			'chunk_size'  => $args['chunk_size'],
			'data'        => $args['data'],
			'started_at'  => current_time( 'mysql' ),
			'completed_at' => null,
		);
		
		$all_progress = get_option( self::PROGRESS_OPTION_KEY, array() );
		$all_progress[ $process_id ] = $progress;
		update_option( self::PROGRESS_OPTION_KEY, $all_progress );
	}

	/**
	 * Update progress
	 *
	 * @param array $args Progress arguments.
	 */
	public function update_progress( $args ) {
		$process_id = $args['process_id'];
		$progress = $args['progress'];
		
		$all_progress = get_option( self::PROGRESS_OPTION_KEY, array() );
		$all_progress[ $process_id ] = $progress;
		update_option( self::PROGRESS_OPTION_KEY, $all_progress );
	}

	/**
	 * Get progress for a process
	 *
	 * @param string $process_id Process ID.
	 * @return array|null Progress data or null if not found
	 */
	public function get_progress( $process_id ) {
		$all_progress = get_option( self::PROGRESS_OPTION_KEY, array() );
		return isset( $all_progress[ $process_id ] ) ? $all_progress[ $process_id ] : null;
	}

	/**
	 * Cancel a process
	 *
	 * @param string $process_id Process ID.
	 * @return bool Success
	 */
	public function cancel_process( $process_id ) {
		$progress = $this->get_progress( $process_id );
		
		if ( ! $progress ) {
			return false;
		}
		
		$progress['status'] = 'cancelled';
		$progress['completed_at'] = current_time( 'mysql' );
		
		$this->update_progress( array( 'process_id' => $process_id, 'progress' => $progress ) );
		
		// Cancel scheduled actions
		as_unschedule_all_actions( self::PROCESS_CHUNK_HOOK, array( 'process_id' => $process_id ), 'email-tracker' );
		
		return true;
	}

	/**
	 * Clean up old progress records
	 *
	 * @param int $days_old Days old to clean.
	 */
	public function cleanup_old_progress( $days_old = 7 ) {
		$all_progress = get_option( self::PROGRESS_OPTION_KEY, array() );
		$cutoff_date = strtotime( "-{$days_old} days" );
		
		foreach ( $all_progress as $process_id => $progress ) {
			if ( isset( $progress['completed_at'] ) && $progress['completed_at'] ) {
				$completed_time = strtotime( $progress['completed_at'] );
				if ( $completed_time < $cutoff_date ) {
					unset( $all_progress[ $process_id ] );
				}
			}
		}
		
		update_option( self::PROGRESS_OPTION_KEY, $all_progress );
	}
}