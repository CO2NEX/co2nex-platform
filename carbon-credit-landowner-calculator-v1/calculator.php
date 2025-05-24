<?php
/**
 * Template Name: CO2NEX Carbon Credit Harvest Calculator 
 * Description: Professional carbon credit valuation tool for landowners
 */

function co2nex_enqueue_calculator_assets() {
    // Tailwind CSS
    wp_enqueue_script('tailwind-css', 'https://cdn.tailwindcss.com', array(), '3.3.3', false);
    
    // Font Awesome
    wp_enqueue_style('font-awesome', 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css');
    
    // Custom CSS
    wp_enqueue_style('co2nex-calculator-css', get_stylesheet_directory_uri() . '/style.css', array(), filemtime(get_stylesheet_directory() . '/style.css'));
    
    // Calculator JS
    wp_enqueue_script('co2nex-calculator-js', get_stylesheet_directory_uri() . '/assets/js/calculator.js', array(), filemtime(get_stylesheet_directory() . '/assets/js/calculator.js'), true);
    
    // Localize script data if needed
    wp_localize_script('co2nex-calculator-js', 'co2nexData', array(
        'ajax_url' => admin_url('admin-ajax.php'),
        'rates' => array(
            'forest' => 1.8,
            'reforest' => 9.2,
            // Add other rates as needed
        )
    ));
}
add_action('wp_enqueue_scripts', 'co2nex_enqueue_calculator_assets');

get_header();
?>

<div class="co2nex-calculator-container max-w-5xl mx-auto px-4 py-12">
    <!-- Calculator HTML structure remains exactly the same -->
    <!-- ... All your existing HTML ... -->
</div>

<?php get_footer(); ?>
