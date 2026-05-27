<?php
if (!defined('ABSPATH')) {
    exit;
}


class SIMEBV_Init {

    public static function on_activation() {
        SIMEBV_Admin::add_ebook_slugs();
        update_option('simebv-version', SIMEBV_VERSION);
    }

    public static function on_upgrade() {
        $db_version = get_option('simebv-version', '0.0.0');
        if ($db_version === SIMEBV_VERSION) {
            return;
        }
        // For operations that can't be safely repeated, consider
        // to also check version_compare($db_version, SIMEBV_VERSION, '<')
        if (!is_string($db_version) || version_compare($db_version, '2.0.0', '<')) {
            SIMEBV_Admin::add_ebook_slugs(['pdf']);
        }
        update_option('simebv-version', SIMEBV_VERSION);
    }

}
