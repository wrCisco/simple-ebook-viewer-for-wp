<?php
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

$simebv_cleanup = function () {
    global $wpdb;
    delete_post_meta_by_key('simebv_ebook_slug');
    delete_option('simebv-version');
    delete_option('simebv-network-activation');
    delete_option('simebv-upgrade-notice');
    delete_metadata('user', 0, $wpdb->get_blog_prefix() . 'simebv-dismissed-notice', '', true);
};

if (is_multisite()) {
    foreach (get_sites(['fields' => 'ids', 'number' => 0]) as $simebv_site_id) {
        switch_to_blog($simebv_site_id);
        $simebv_cleanup();
        restore_current_blog();
    }
} else {
    $simebv_cleanup();
}
