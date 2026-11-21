<?php
if (!defined('ABSPATH')) {
    exit;
}


class SIMEBV_Init {

    public static function on_activation($network_wide = false) {
        if (is_multisite() && $network_wide) {
            // each site runs the backfill on its own first request, in on_upgrade
            return;
        }
        SIMEBV_Admin::add_ebook_slugs();
        update_option('simebv-version', SIMEBV_VERSION);
    }

    public static function on_upgrade() {
        $db_version = get_option('simebv-version', '0.0.0');
        // time of the last network activation, if there is one
        $network_activation = 0;
        if (is_multisite()) {
            $network_plugins = get_site_option('active_sitewide_plugins', []);
            $network_activation = (int) ($network_plugins[plugin_basename(SIMEBV_PLUGIN_DIR . 'simple-ebook-viewer.php')] ?? 0);
        }
        $new_activation = $network_activation !== 0
            && $network_activation !== (int) get_option('simebv-network-activation', 0);
        if ($db_version === SIMEBV_VERSION && !$new_activation) {
            return;
        }
        // Runs for upgrades from 0.x and 1.x, and for sites where
        // the activation never ran (e.g. parts of a multisite).
        // For operations that can't be safely repeated, consider
        // to also check version_compare($db_version, SIMEBV_VERSION, '<')
        if ($new_activation || !is_string($db_version) || version_compare($db_version, '2.0.0', '<')) {
            SIMEBV_Admin::add_ebook_slugs();
        }
        if ($new_activation) {
            update_option('simebv-network-activation', $network_activation);
        }
        update_option('simebv-version', SIMEBV_VERSION);
    }

}
