<?php
/**
 * Form submission handler for CO2NEX Calculator
 */

// Start session for messages
if (!session_id()) {
    session_start();
}

// Security headers
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

add_filter('wp_headers', function($headers) {
    $headers['CF-Cache-Status'] = 'BYPASS';
    $headers['CDN-Cache-Control'] = 'no-cache';
    $headers['X-Frame-Options'] = 'SAMEORIGIN';
    $headers['X-Content-Type-Options'] = 'nosniff';
    return $headers;
});

// Handle form submission
function co2nex_handle_form_submission() {
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['co2nex_form_submit'])) {
        // Verify nonce
        if (!isset($_POST['co2nex_nonce']) || !wp_verify_nonce($_POST['co2nex_nonce'], 'co2nex_form_nonce')) {
            wp_die('Security check failed');
        }

        // Sanitize inputs
        $name = isset($_POST['name']) ? sanitize_text_field(wp_unslash($_POST['name'])) : '';
        $email = isset($_POST['email']) ? sanitize_email($_POST['email']) : '';
        $phone = isset($_POST['phone']) ? sanitize_text_field($_POST['phone']) : '';

        if (!empty($email)) {
            $to = 'social@co2nex.org';
            $subject = 'CO2NEX Calculator Submission';
            $message = "New calculator submission:\n\n";
            $message .= "Name: " . (!empty($name) ? $name : 'Not provided') . "\n";
            $message .= "Email: $email\n";
            $message .= "Phone: " . (!empty($phone) ? $phone : 'Not provided') . "\n";

            $headers = array('Content-Type: text/plain; charset=UTF-8');
            $email_sent = wp_mail($to, $subject, $message, $headers) || mail($to, $subject, $message, implode("\r\n", $headers));

            $response = [
                'success' => $email_sent,
                'message' => 'Fantastic! You\'ve taken a powerful first step...'
            ];
            
            if (wp_doing_ajax()) {
                wp_send_json($email_sent ? $response : ['success' => false, 'message' => 'Please enter a valid email address']);
            } else {
                $_SESSION['co2nex_submission_message'] = $response;
                wp_redirect(get_permalink());
                exit;
            }
        }
    }
}
add_action('wp_loaded', 'co2nex_handle_form_submission');

// AJAX handler
function co2nex_handle_ajax_submit() {
    check_ajax_referer('co2nex_nonce', 'nonce');
    co2nex_handle_form_submission();
}
add_action('wp_ajax_co2nex_submit_form', 'co2nex_handle_ajax_submit');
add_action('wp_ajax_nopriv_co2nex_submit_form', 'co2nex_handle_ajax_submit');
