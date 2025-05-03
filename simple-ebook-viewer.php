<?php
/**
 * Plugin Name: Simple Ebook Viewer
 * Description: A plugin to embed and display Ebooks
 * Version: 0.1
 * Author: Francesco Martini
 * License: GPL-2.0+
 * Text Domain:simple-ebook-viewer
 */

if (!defined('ABSPATH')) {
    exit;
}


define('SIMEBV_VERSION', '0.1');
define('SIMEBV_PLUGIN_NAME', 'Simple Ebook Viewer');
define('SIMEBV_PLUGIN_DIR', plugin_dir_path( __FILE__ ));
define('SIMEBV_PLUGIN_URL', plugin_dir_url( __FILE__ ));

require_once SIMEBV_PLUGIN_DIR . 'includes/vite-for-wp.php';
require_once SIMEBV_PLUGIN_DIR . 'includes/simebv-viewer.php';
require_once SIMEBV_PLUGIN_DIR . 'includes/simebv-admin.php';

add_action('plugins_loaded', ['SIMEBV_Viewer', 'init']);
add_action('plugins_loaded', ['SIMEBV_Admin', 'init']);
