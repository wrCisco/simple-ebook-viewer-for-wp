<?php
if (!defined('ABSPATH')) {
    exit;
}


class SIMEBV_Admin extends SIMEBV_Base {

    public static function init() {
        do_action('simebv_admin_before_init');

        add_action('admin_init', [self::class, 'suggest_privacy_policy']);
        add_filter('upload_mimes', [self::class, 'allow_ebook_uploads'], 10, 2);
        add_action('add_attachment', [self::class, 'handle_ebook_uploads'], 10, 1);
        add_filter('attachment_fields_to_edit', [self::class, 'add_media_custom_field'], 10, 2);
        add_filter('attachment_fields_to_save', [self::class, 'save_media_custom_field'], 10, 2);
        add_filter('wp_check_filetype_and_ext', [self::class, 'allow_azw_uploads'], 5, 5);

        do_action('simebv_admin_after_init');
    }

    public static function suggest_privacy_policy() {
        $policy_text = sprintf(
            wp_kses_post(
// translators: Suggested privacy policy. %s: name of the plugin
                __(
"<h3>Use of %s plugin</h3>
<p>Our website uses a plugin to enhance your experience when reading ebooks directly on our site. This plugin does <strong>not</strong> collect any personal data. It does <strong>not</strong> set cookies or track your activity across websites.</p>
<p>When you interact with the ebook viewer, the plugin may store certain <strong>preferences locally in your browser</strong> using local storage technology. This information is saved solely to remember your settings and improve your user experience during future visits. These preferences include:</p>
<ul>
<li>The last page you viewed</li>
<li>Your selected font size and style</li>
<li>Show or hide annotations and page delimiters</li>
<li>Page margin settings</li>
<li>Maximum pages displayed per view</li>
<li>Layout preference (scrolled or paginated)</li>
<li>Chosen color theme and any color filters</li>
<li>Zoom level</li>
<li>Speech synthesis preferences</li>
<li>Custom bookmarks and annotations</li>
</ul>
<p>This information is stored <strong>only on your device</strong> and is never transmitted to our servers. It is used exclusively to personalize your ebook reading experience on this website.</p>
<p>If you use the Text-to-Speech functionality offered by the ebook viewer with a remote voice (the available voices depend on the browser and the operating system: Chrome offers Google remote voices, Edge offers Microsoft remote ones, for example), the text to be synthesized and the voice and language parameters will be transmitted to these remote services. As with any network request, your IP address and browser identifiers are also transmitted. You can avoid this by selecting a local voice, if available in your system.</p>
<p><strong>Note:</strong> To retrieve and display the ebook content, the plugin interacts with the WordPress REST API. This process may involve the use of <strong>technical cookies</strong> that are set by WordPress itself to ensure secure and correct data transmission. These cookies do not track you and are essential for the proper functioning of the website.</p>
<p>You can clear your saved preferences at any time by clearing your browser’s local storage or using your browser's privacy settings.</p>",
                    'simple-ebook-viewer'
                ),
            ), SIMEBV_PLUGIN_NAME
        );
        wp_add_privacy_policy_content(SIMEBV_PLUGIN_NAME, $policy_text);
    }

    public static function allow_azw_uploads($types, $file, $filename, $mimes, $real_mime) {
        $exp_mimes = ['application/x-mobipocket-ebook', 'application/vnd.amazon.ebook', 'application/octet-stream'];
        $expected = ['azw'  => $exp_mimes, 'azw3' => $exp_mimes];
        // accepts also fb2, but only from users that can insert unfiltered html
        // (e.g. scripts) in pages, as scripts in xml can sometimes be executed by browsers
        if (current_user_can('unfiltered_html')) {
            $expected['fb2'] = ['text/xml', 'application/xml'];
        }
        $wp_filetype = wp_check_filetype($filename, $mimes);
        $ext = $wp_filetype['ext'];
        if (isset($expected[$ext]) && in_array($real_mime, $expected[$ext], true)) {
            $types['ext'] = $ext;
            $types['type'] = $wp_filetype['type'];
        }
        return $types;
    }

    public static function allow_ebook_uploads($mimes, $user = null) {
        $can_fb2 = $user ? user_can($user, 'unfiltered_html') : current_user_can('unfiltered_html');
        foreach (self::$ebook_mimetypes as $ext => $type) {
            if ($ext === 'fb2' && !$can_fb2) {
                continue;
            }
            if (!isset($mimes[$ext])) {
                $mimes[$ext] = $type;
            }
        }
        return $mimes;
    }

    public static function handle_ebook_uploads($attachment_ID) {
        $attachment_post = get_post($attachment_ID);
        $type = get_post_mime_type($attachment_ID);
        $metadata = get_post_meta($attachment_ID);
        // $filepath = get_attached_file($attachment_ID);
        if (!in_array($type, self::$ebook_mimetypes, true)) {
            return;
        }
        if (isset($metadata['simebv_ebook_slug'])) {
            return;
        }
        if (isset($attachment_post->post_name)) {
            $slug = sanitize_text_field($attachment_post->post_name);
            update_post_meta(
                $attachment_ID,
                'simebv_ebook_slug',
                $slug
            );
        }
    }

    public static function add_media_custom_field($fields, $post) {
        $mimetype = get_post_mime_type($post->ID);
        if (in_array($mimetype, self::$ebook_mimetypes, true)) {
            $val = get_post_meta($post->ID, 'simebv_ebook_slug', true);
            $fallback = $post->post_name;
            if (empty($val)) {
                $val = $fallback;
            }
            $field_id = 'attachments-' . esc_attr($post->ID) . '-simebv_ebook_slug';
            $html = '<div class="simebv-attachment-ebook-slug">';
            $html .= '<input type="text" id="' . esc_attr($field_id) . '"';
            // the name is used as keys for the $post array in save_media_custom_field
            $html .= ' name="simebv_ebook_slug"';
            $html .= ' value="' . esc_attr($val) . '" ';
            $html .= ' style="width: 100%;" />';
            $html .= '<p>';
            $html .= sprintf(
                /* translators: %s: example of an ebook slug based on the opened ebook */
                esc_html__('Use this slug in the shortcode "simebv_viewer" to view the ebook in your pages (e.g. [simebv_viewer book="%s"]). If left empty, the value of post_name will be used instead.', 'simple-ebook-viewer'),
                esc_attr($val)
            );
            $html .= '</p>';
            $html .= '</div>';
            $fields['simebv_ebook_slug'] = array(
                'label' => 'Ebook slug',
                'input' => 'html',
                'html' => $html,
                // 'value' => $val,
                // 'helps' => 'Use this slug in the shortcode "simebv_viewer" to view the epub in your web pages',
            );
        }
        return $fields;
    }

    public static function save_media_custom_field($post, $attachment) {
        if (isset($post['simebv_ebook_slug'])) {
            $slug = sanitize_text_field($post['simebv_ebook_slug']);
            if (empty($slug)) {
                $slug = sanitize_text_field($post['post_name']);
            }
            $post['simebv_ebook_slug'] = $slug;
            update_post_meta(
                $post['ID'],
                'simebv_ebook_slug',
                $slug
            );
        }
        return $post;
    }

    public static function add_ebook_slugs($types = []) {
        $mimetypes = count($types) === 0
            ? array_values(self::$ebook_mimetypes)
            : array_values(array_intersect_key(self::$ebook_mimetypes, array_flip($types)));
        if (count($mimetypes) === 0) return;
        $args = array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
            'post_mime_type' => $mimetypes,
            'posts_per_page' => 200,
            'paged' => 1,
            // 'suppress_filters' => true,  // already default in get_posts (not in WP_Query)
            'no_found_rows' => true,
            // avoid non-deterministic ordering that, combined with
            // pagination, can result in skipped or repeated records
            // (cfr. https://github.com/WordPress/wordpress-develop/pull/10262)
            'orderby' => ['date' => 'DESC', 'ID' => 'DESC'],
        );
        while (true) {
            $posts = get_posts($args);
            foreach ($posts as $attachment) {
                $attachment_ID = $attachment->ID;
                $existing = get_post_meta($attachment_ID, 'simebv_ebook_slug', true);
                if (empty($existing)) {
                    $slug = sanitize_text_field($attachment->post_name);
                    if (!empty($slug)) {
                        update_post_meta($attachment_ID, 'simebv_ebook_slug', $slug);
                    }
                }
            }
            if (count($posts) < $args['posts_per_page']) {
                break;
            }
            $args['paged']++;
        }
    }

}
