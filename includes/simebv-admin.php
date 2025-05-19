<?php
if (!defined('ABSPATH')) {
    exit;
}


class SIMEBV_Admin {

    public static $ebook_mimetypes = [
        'epub' => 'application/epub+zip',
        'cbz' => 'application/vnd.comicbook+zip',
        'fb2' => 'application/x-fictionbook+xml',
        'fbz' => 'application/x-zip-compressed-fb2',
        'mobi' => 'application/x-mobipocket-ebook',
        'azw' => 'application/vnd.amazon.ebook',
        'azw3' => 'application/vnd.amazon.ebook',
    ];

    public static function init() {
        add_filter('upload_mimes', [self::class, 'allow_ebook_uploads']);
        add_action('add_attachment', [self::class, 'handle_ebook_uploads'], 10, 1);
        add_filter('attachment_fields_to_edit', [self::class, 'add_media_custom_field'], 10, 2);
        add_filter('attachment_fields_to_save', [self::class, 'save_media_custom_field'], 10, 2);
        add_filter('wp_check_filetype_and_ext', [self::class, 'allow_azw_uploads'], 100, 5);
    }

    public static function allow_azw_uploads($types, $file, $filename, $mimes, $real_mime) {
        $wp_filetype = wp_check_filetype($filename, $mimes);
        if (in_array($wp_filetype['ext'], ['azw', 'azw3', 'fb2', 'fbz'])) {
            $types['ext'] = $wp_filetype['ext'];
            $types['type'] = $wp_filetype['type'];
        }
        return $types;
    }

    public static function allow_ebook_uploads($mimes) {
        foreach (self::$ebook_mimetypes as $ext => $type) {
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
            $form_fields['simebv_ebook_slug'] = array(
                'label' => 'Ebook slug',
                'input' => 'html',
                'html' => $html,
                // 'value' => $val,
                // 'helps' => 'Use this slug in the shortcode "simebv_viewer" to view the epub in your web pages',
            );
        }
        return $form_fields;
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

    public static function add_ebook_slug_to_all_ebooks() {
        $args = array(
            'post_type' => 'attachment',
            'post_status' => 'inherit',
        );
        $query = new WP_Query($args);
        while ($query->have_posts()) {
            $query->the_post();
            $attachment_ID = get_the_ID();
            $type = get_post_mime_type($attachment_ID);
            if (!in_array($type, array_values(self::$ebook_mimetypes))) {
                continue;
            }
            $metadata = get_post_meta($attachment_ID);
            if (!isset($metadata['simebv_ebook_slug'])) {
                $slug = sanitize_text_field($metadata['post_name']);
                if (!empty($slug)) {
                    update_post_meta(
                        $attachment_ID,
                        'simebv_ebook_slug',
                        $slug
                    );
                }
            }
        }
        wp_reset_postdata();
    }

}