<?php
/**
 * Template Name: CO2NEX Carbon Credit Calculator V2.0.0 Beta
 */

get_header();

// Include necessary files
require_once __DIR__ . '/../includes/form-handler.php';
?>

<div class="co2nex-calculator-container max-w-5xl mx-auto px-4 py-12">
    <!-- Submission Message -->
    <?php if (isset($_SESSION['show_submission_message']) && isset($_SESSION['co2nex_submission_message'])): ?>
        <div class="bg-emerald-50 border-l-4 border-emerald-500 p-4 mb-8 animate-in">
            <!-- Message content -->
        </div>
        <?php 
        unset($_SESSION['show_submission_message']);
        unset($_SESSION['co2nex_submission_message']);
        ?>
    <?php endif; ?>

    <!-- Calculator Content -->
    <!-- ... (rest of your HTML template) ... -->
</div>

<?php
// Enqueue scripts
function co2nex_enqueue_assets() {
    wp_enqueue_script('tailwind-css', 'https://cdn.tailwindcss.com', [], '3.3.3', false);
    wp_enqueue_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
    
    wp_add_inline_style('tailwind-css', '
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } } 
        .animate-in { animation: fadeIn 0.6s ease-out forwards; }
    ');
    
    wp_enqueue_script('co2nex-calculator', get_template_directory_uri() . '/carbon-credit-calculator/v2.0.0-beta/assets/js/calculator.js', [], null, true);
    wp_enqueue_script('co2nex-form-handler', get_template_directory_uri() . '/carbon-credit-calculator/v2.0.0-beta/assets/js/form-handler.js', ['jquery'], null, true);
    
    wp_localize_script('co2nex-form-handler', 'co2nex_vars', [
        'ajax_url' => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('co2nex_nonce')
    ]);
}
add_action('wp_enqueue_scripts', 'co2nex_enqueue_assets');

get_footer();
