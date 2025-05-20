<?php
/**
 * Plugin Name: Simple Ebook Viewer
 * Description: A plugin to embed and display Ebooks
 * Version: 0.2.0
 * Author: Francesco Martini
 * License: GPL-2.0+
 * License URI: https://www.gnu.org/licenses/old-licenses/gpl-2.0.html
 * Text Domain: simple-ebook-viewer
 * Domain Path: /languages
 */

if (!defined('ABSPATH')) {
    exit;
}


define('SIMEBV_VERSION', '0.2.0');
define('SIMEBV_PLUGIN_NAME', 'Simple Ebook Viewer');
define('SIMEBV_PLUGIN_DIR', plugin_dir_path( __FILE__ ));
define('SIMEBV_PLUGIN_URL', plugin_dir_url( __FILE__ ));

add_action('init', 'simebv_load_textdomain');
add_filter('load_textdomain_mofile', 'simebv_load_textdomain_mofile', 10, 2);

require_once SIMEBV_PLUGIN_DIR . 'vendor/vite-for-wp/vite-for-wp.php';
require_once SIMEBV_PLUGIN_DIR . 'includes/simebv-viewer.php';
require_once SIMEBV_PLUGIN_DIR . 'includes/simebv-admin.php';

add_action('plugins_loaded', ['SIMEBV_Viewer', 'init']);
add_action('plugins_loaded', ['SIMEBV_Admin', 'init']);

register_activation_hook(__FILE__, ['SIMEBV_Admin', 'add_ebook_slug_to_all_ebooks']);


function simebv_load_textdomain() {
    load_plugin_textdomain('simple-ebook-viewer', false, dirname(plugin_basename(__FILE__)) . '/languages');
}

function simebv_load_textdomain_mofile($mofile, $domain) {
	if ('simple-ebook-viewer' === $domain && false !== strpos($mofile, WP_LANG_DIR . '/plugins/')) {
		$locale = apply_filters('plugin_locale', determine_locale(), $domain);
		$mofile = dirname(plugin_basename(__FILE__)) . '/languages/' . $domain . '-' . $locale . '.mo';
	}
	return $mofile;
}
