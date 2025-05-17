<?php
if (!defined('ABSPATH')) {
    exit;
}

use Kucrut\Vite;

class SIMEBV_Viewer {
    public static function init() {
        // add_filter('wp_handle_uploads', [self::class, 'handle_epub_uploads']);
        add_shortcode('simebv_viewer', [self::class, 'render_ebook_viewer']);
        add_action('wp_enqueue_scripts', [self::class, 'conditionally_enqueue_assets']);
        add_action('wp_enqueue_scripts', [self::class, 'register_javascript_translations'], 100);
        // add_action('enqueue_block_editor_assets', [self::class, 'enqueue_block_editor_assets']);
    }

    // public static function initializeFS() {
    //     $creds = request_filesystem_credentials(trailingslashit(SIMEBV_PLUGIN_URL) . 'books', '', false, SIMEBV_PLUGIN_DIR . 'books');
    //     if (!WP_Filesystem($creds)) {
    //         return false;
    //     }
    //     return true;
    // }

    public static function writeLog($msg) {
        if (WP_DEBUG === true) {
            error_log($msg);
        }
    }

    public static function register_javascript_translations() {
        wp_set_script_translations(
            'simebv-viewer-lib', 'simple-ebook-viewer', SIMEBV_PLUGIN_DIR . 'languages/'
        );
    }

    public static function conditionally_enqueue_assets() {
        if (!is_singular()) {
            return;
        }

        global $post;
        if (has_shortcode($post->post_content, 'simebv_viewer')) {
            Vite\enqueue_asset(
                SIMEBV_PLUGIN_DIR . '/dist',
                'src/js/simebv-viewer.js',
                [
                    'handle' => 'simebv-viewer-lib',
                    'dependencies' => ['wp-i18n'],
                    'in-footer' => true,
                ]
            );
        }

    }

    public static function render_ebook_viewer($atts) {
        // add default value for attributes in the shortcode
        $atts = shortcode_atts(
            [
                'book' => '',
                'height' => '',
                'width' => '',
                'max-height' => '',
                'max-width' => '',
                'border' => '',
                'style' => '',
                'top-color' => '',
                'top-bg-color' => '',
                'top-padding' => '',
                'top-border' => '',
                'top-style' => '',
                'sidebar-color' => '',
                'sidebar-bg-color' => '',
                'sidebar-padding' => '',
                'sidebar-border' => '',
                'sidebar-style' => '',
            ],
            $atts,
            'simebv_viewer'
        );

        // if the 'book' attribute of the shortcode is a valid url that points
        // to a file in the uploads directory, use it directly as url.
        // Otherwise, use it to do a query in the db as the value for
        // the 'simebv_ebook_slug' posts metadata.
        $file_url = wp_http_validate_url($atts['book']);
        if ($file_url) {
            $escaped_url = esc_url($file_url);
            if (!str_starts_with($escaped_url, wp_upload_dir()['baseurl']) || str_contains($escaped_url, '../')) {
                $file_url = '';
            }
        }
        if (!$file_url) {
            $args = array(
                'post_type' => 'attachment',
                // 'post_mime_type' => 'application/epub+zip',
                'post_status' => 'inherit',
                'meta_query' => [
                    [
                        'key' => 'simebv_ebook_slug',
                        'value' => trim($atts['book']),
                        'compare' => '=',
                    ],
                ],
            );
            $query = new WP_Query($args);
            if ($query->have_posts()) {
                $query->the_post();  // used to bump to the next post retrieved by the query, usually used in a loop e.g. while ($query->have_posts()) { $query->the_post(); ... }
                $attachment_ID = get_the_ID();
                wp_reset_postdata();
                $file_url = wp_get_attachment_url($attachment_ID);
            }
        }
        if (empty($file_url)) {
            return '<p style="color: red;">' . esc_html__("No Web Publication file provided.", 'simple-ebook-viewer') . '</p>';
        }

        $styles = self::setup_styles($atts);

        ob_start(); ?>
<section
    id="simebv-reader-container"
    data-ebook-path="<?php echo esc_url($file_url); ?>"
    <?php echo $styles['container']; ?>
    tabindex="0"
    aria-label="Ebook reader"
>
    <noscript>
        <?php esc_html_e("It seems that JavaScript is not enabled in your browser, you need to enable it in order to use the Ebook Viewer.", 'simple-ebook-viewer'); ?>
    </noscript>
</section>
        <?php
        return ob_get_clean();
    }

    public static function setup_styles($attrs) {
        $style_container = 'style="';
        if (
            strlen($attrs['height']) !== 0
            || strlen($attrs['width']) !== 0
            || strlen($attrs['max-height']) !== 0
            || strlen($attrs['max-width']) !== 0
            || strlen($attrs['border']) !== 0
            || strlen($attrs['style']) !== 0
        ) {
            if (strlen($attrs['height']) !== 0) {
                $style_container .= "height:" . esc_attr($attrs['height']) . ";";
            }
            if (strlen($attrs['width']) !== 0) {
                $style_container .= "width:" . esc_attr($attrs['width']) . ";";
            }
            if (strlen($attrs['max-height']) !== 0) {
                $style_container .= "max-height:" . esc_attr($attrs['max-height']) . ";";
            }
            if (strlen($attrs['max-width']) !== 0) {
                $style_container .= "max-width:" . esc_attr($attrs['max-width']) . ";";
            }
            if (strlen($attrs['border']) !== 0) {
                $style_container .= "border:" . esc_attr($attrs['border']) . ";";
            }
            if (strlen($attrs['style']) !== 0) {
                $style_container .= esc_attr(trim($attrs['style']));
                if (!str_ends_with($style_container, ';')) {
                    $style_container .= ';';
                }
            }
        }
        if (strlen($attrs['max-height'] === 0 && strlen($attrs['height']) === 0)) {
            $style_container .= "max-height:95vh;";
        }
        $style_container .= '"';

        $style_top = '';
        if (
            strlen($attrs['top-color']) !== 0
            || strlen($attrs['top-bg-color']) !== 0
            || strlen($attrs['top-padding']) !== 0
            || strlen($attrs['top-border']) !== 0
            || strlen($attrs['top-style']) !== 0
        ) {
            $style_top = 'style="';
            if (strlen($attrs['top-color']) !== 0) {
                $style_top .= 'color:' . esc_attr($attrs['top-color']) . ";";
            }
            if (strlen($attrs['top-bg-color']) !== 0) {
                $style_top .= 'background-color:' . esc_attr($attrs['top-bg-color']) . ";";
            }
            if (strlen($attrs['top-padding']) !== 0) {
                $style_top .= 'padding:' . esc_attr($attrs['top-padding']) . ";";
            }
            if (strlen($attrs['top-border']) !== 0) {
                $style_top .= 'border:' . esc_attr($attrs['top-border']) . ";";
            }
            if (strlen($attrs['top-style']) !== 0) {
                $style_top .= esc_attr(trim($attrs['top-style']));
                if (!str_ends_with($style_top, ';')) {
                    $style_top .= ';';
                }
            }
            $style_top .= '"';
        }

        $style_sidebar = 'style="display:none;';
        if (
            strlen($attrs['sidebar-color']) !== 0
            || strlen($attrs['sidebar-bg-color']) !== 0
            || strlen($attrs['sidebar-padding']) !== 0
            || strlen($attrs['sidebar-border']) !== 0
            || strlen($attrs['sidebar-style']) !== 0
        ) {
            if (strlen($attrs['sidebar-color']) !== 0) {
                $style_sidebar .= 'color:' . esc_attr($attrs['sidebar-color']) . ";";
            }
            if (strlen($attrs['sidebar-bg-color']) !== 0) {
                $style_sidebar .= 'background-color:' . esc_attr($attrs['sidebar-bg-color']) . ";";
            }
            if (strlen($attrs['sidebar-padding']) !== 0) {
                $style_sidebar .= 'padding:' . esc_attr($attrs['sidebar-padding']) . ";";
            }
            if (strlen($attrs['sidebar-border']) !== 0) {
                $style_sidebar .= 'border:' . esc_attr($attrs['sidebar-border']) . ";";
            }
            if (strlen($attrs['sidebar-style']) !== 0) {
                $style_sidebar .= esc_attr(trim($attrs['sidebar-style']));
                if (!str_ends_with($style_sidebar, ';')) {
                    $style_sidebar .= ';';
                }
            }
        }
        $style_sidebar .= '"';
        return [
            'container' => $style_container,
            'header' => $style_top,
            'sidebar' => $style_sidebar,
        ];
    }

}
