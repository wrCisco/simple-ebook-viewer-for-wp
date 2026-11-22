<?php
if (!defined('ABSPATH')) {
    exit;
}


class SIMEBV_Notices {

    // First release with the changes described in the notice
    const UPGRADE_NOTICE = '3.0.0';

    public static function init() {
        add_action('admin_notices', [self::class, 'show_upgrade_notice']);
        add_action('wp_ajax_simebv_dismiss_notice', [self::class, 'dismiss_upgrade_notice']);
        add_action('admin_post_simebv_dismiss_notice', [self::class, 'dismiss_upgrade_notice']);
        add_action('admin_enqueue_scripts', [self::class, 'enqueue_thickbox']);
    }

    // Must run before simebv-version is updated and before add_ebook_slugs
    public static function maybe_schedule_upgrade_notice($db_version) {
        if ($db_version === '0.0.0') {
            // no stored version: fresh install, or upgrade from 1.x or older
            // (that didn't store it); only the latter already has ebook slugs
            if (!self::has_ebook_slugs()) {
                return;
            }
        }
        elseif (is_string($db_version) && version_compare($db_version, self::UPGRADE_NOTICE, '>=')) {
            return;
        }
        update_option('simebv-upgrade-notice', self::UPGRADE_NOTICE);
    }

    private static function has_ebook_slugs() {
        return count(get_posts([
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'posts_per_page' => 1,
            'fields' => 'ids',
            'no_found_rows' => true,
            'suppress_filters' => true,
            'meta_key' => 'simebv_ebook_slug',
        ])) > 0;
    }

    private static function should_show() {
        $notice = get_option('simebv-upgrade-notice');
        return $notice
            && current_user_can('manage_options')
            && get_user_option('simebv-dismissed-notice') !== $notice;
    }

    public static function enqueue_thickbox() {
        if (self::should_show() && current_user_can('install_plugins')) {
            add_thickbox();
        }
    }

    public static function dismiss_upgrade_notice() {
        check_admin_referer('simebv_dismiss_notice');
        $notice = get_option('simebv-upgrade-notice');
        if ($notice && current_user_can('manage_options')) {
            // user options are per site on multisite
            update_user_option(get_current_user_id(), 'simebv-dismissed-notice', $notice);
        }
        if (wp_doing_ajax()) {
            wp_send_json_success();
        }
        wp_safe_redirect(wp_get_referer() ?: admin_url());
        exit;
    }

    public static function show_upgrade_notice() {
        if (!self::should_show()) {
            return;
        }
        if (current_user_can('install_plugins')) {
            $changelog_link = sprintf(
                '<a href="%s" class="thickbox">',
                esc_url(network_admin_url('plugin-install.php?tab=plugin-information&plugin=simple-ebook-viewer&section=changelog&TB_iframe=true&width=600&height=550'))
            );
        } else {
            $changelog_link = '<a href="https://wordpress.org/plugins/simple-ebook-viewer/#developers">';
        }
        $code = fn($text) => '<code>' . esc_html($text) . '</code>';
        if (defined('DISALLOW_UNFILTERED_HTML') && DISALLOW_UNFILTERED_HTML) {
            $who = esc_html__('On this site no user has it, because DISALLOW_UNFILTERED_HTML is set.', 'simple-ebook-viewer');
        } elseif (is_multisite()) {
            $who = esc_html__('In a multisite network, only Super Admins have it by default.', 'simple-ebook-viewer');
        } else {
            $who = esc_html__('By default, only Administrators and Editors have it.', 'simple-ebook-viewer');
        }
        $items = [
            sprintf(
                /* translators: 1: allow-js="true", 2: unfiltered_html */
                esc_html__('The shortcode attribute %1$s now works only in posts and pages whose author has the %2$s capability. Elsewhere it is ignored, and scripts inside the ebooks don\'t run.', 'simple-ebook-viewer'),
                $code('allow-js="true"'), $code('unfiltered_html')
            ) . ' ' . $who,
            sprintf(
                /* translators: %s: unfiltered_html */
                esc_html__('Only users with the %s capability can upload FB2 files, because browsers can run scripts embedded in XML files. FB2 files already in the Media Library are not affected. AZW and AZW3 files are now checked against their content.', 'simple-ebook-viewer'),
                $code('unfiltered_html')
            ),
            sprintf(
                /* translators: 1: allow-remote-resources="true", 2: example shortcode */
                esc_html__('Ebooks can no longer load images, fonts, stylesheets, scripts or other resources from external servers by default. If an ebook needs them, add %1$s to its shortcode, e.g. %2$s. Ebooks with allow-js that load scripts from external servers need it too.', 'simple-ebook-viewer'),
                $code('allow-remote-resources="true"'),
                $code('[simebv_viewer book="my-ebook" allow-remote-resources="true"]')
            ),
        ];
        $dismiss_url = wp_nonce_url(admin_url('admin-post.php?action=simebv_dismiss_notice'), 'simebv_dismiss_notice');
        ?>
<div class="notice notice-warning is-dismissible simebv-upgrade-notice">
    <p><strong><?php
        /* translators: %s: plugin name */
        printf(esc_html__('%s: changes that may affect your ebooks', 'simple-ebook-viewer'), esc_html(SIMEBV_PLUGIN_NAME));
    ?></strong></p>
    <p><?php esc_html_e('This version of the plugin limits what ebooks can do, to better protect your site and your visitors:', 'simple-ebook-viewer'); ?></p>
    <ul style="list-style: disc; padding-left: 2em;">
        <?php foreach ($items as $item) : ?>
        <li><?php echo wp_kses($item, ['code' => []]); ?></li>
        <?php endforeach; ?>
    </ul>
    <p><?php
        echo wp_kses(
            sprintf(
                /* translators: 1: opening link tag, 2: closing link tag */
                esc_html__('This version also brings new features and improvements: %1$scheck out the complete list%2$s.', 'simple-ebook-viewer'),
                $changelog_link,
                '</a>',
            ),
            ['a' => ['href' => [], 'class' => []]],
        );
    ?></p>
    <p><a href="<?php echo esc_url($dismiss_url); ?>"><?php esc_html_e("Don't show this message again", 'simple-ebook-viewer'); ?></a></p>
</div>
        <?php
        wp_print_inline_script_tag(sprintf(
            'document.addEventListener("click", e => {
                if (!e.target.closest(".simebv-upgrade-notice .notice-dismiss")) return;
                const body = new FormData();
                body.append("action", "simebv_dismiss_notice");
                body.append("_wpnonce", %s);
                fetch(ajaxurl, { method: "POST", body, credentials: "same-origin" });
            });',
            wp_json_encode(wp_create_nonce('simebv_dismiss_notice'))
        ));
    }
}
