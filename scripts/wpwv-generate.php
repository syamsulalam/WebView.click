<?php
// Materialize the compiled WebView prospect on the dedicated, locked staging tenant.
[$input] = $args;
$site = json_decode(file_get_contents($input), true, 32, JSON_THROW_ON_ERROR);
if (home_url('/') !== 'https://wpwv.codev.id/' || get_stylesheet() !== 'astra' || count($site['pages']) < 3) {
    WP_CLI::error('Unexpected WebView staging target or incomplete compiled site.');
}
$builder = $site['template']['builder'];
if (!in_array($builder, ['elementor', 'gutenberg'], true) ||
    ($builder === 'elementor' && !did_action('elementor/loaded'))) {
    WP_CLI::error('Enable the selected builder on WebView staging before generation.');
}

$old = [];
foreach (get_posts(['post_type' => 'page', 'post_status' => 'publish', 'numberposts' => -1]) as $post) {
    if (!get_post_meta($post->ID, '_webview_template', true) &&
        !get_post_meta($post->ID, '_codev_planner_build_uuid', true)) {
        WP_CLI::error('The staging site contains a page outside WebView ownership.');
    }
    $old[get_page_uri($post)] = $post->ID;
}

$uploads = wp_get_upload_dir();
$directory = $uploads['basedir'] . '/webview-preview';
if ($uploads['error'] || !wp_mkdir_p($directory) || is_link($directory)) {
    WP_CLI::error('The staging image directory is unavailable.');
}
$tokens = ['@@WV_HOME@@' => esc_url(home_url('/'))];
foreach ($site['images'] as $asset) {
    $image = base64_decode($asset['image'], true);
    $dimensions = $image ? getimagesizefromstring($image) : false;
    if (!$dimensions || $dimensions[2] !== IMAGETYPE_JPEG || $dimensions[0] !== $asset['width'] ||
        $dimensions[1] !== $asset['height'] || strlen($image) > 1000000 ||
        hash('sha256', $image) !== $asset['sha256']) {
        WP_CLI::error('A compiled preview image failed verification.');
    }
    $filename = $asset['sha256'] . '.jpg';
    $destination = $directory . '/' . $filename;
    if (is_link($destination)) {
        WP_CLI::error('An image destination is a symlink.');
    }
    if (!is_file($destination)) {
        $temp = tempnam($directory, 'wv-');
        if (!$temp) {
            WP_CLI::error('Could not allocate the staging image.');
        }
        $written = file_put_contents($temp, $image) === strlen($image) && chmod($temp, 0644)
            && rename($temp, $destination);
        if (!$written) {
            if (is_file($temp)) {
                unlink($temp);
            }
            WP_CLI::error('Could not install the staging image.');
        }
    }
    if (hash_file('sha256', $destination) !== $asset['sha256']) {
        WP_CLI::error('An existing staging image differs from the compiled image.');
    }
    $tokens['@@WV_IMAGE_' . $asset['sha256'] . '@@'] = esc_url($uploads['baseurl'] . '/webview-preview/' . $filename);
}

$ids = [];
$pageIds = [];
$menuItems = [];
global $wpdb;
$tables = [$wpdb->posts, $wpdb->postmeta, $wpdb->options, $wpdb->terms, $wpdb->term_taxonomy, $wpdb->term_relationships];
foreach ($tables as $table) {
    if ($wpdb->get_var($wpdb->prepare(
        'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s', $table
    )) !== 'InnoDB') {
        WP_CLI::error('The staging tables must support transactional replacement.');
    }
}

$check = static function ($result) {
    if (is_wp_error($result) || !$result) {
        throw new RuntimeException(is_wp_error($result) ? $result->get_error_message() : 'WordPress rejected the update.');
    }
    return $result;
};
try {
    if ($wpdb->query('START TRANSACTION') === false) {
        throw new RuntimeException('Could not start a staging transaction.');
    }
    $menu = (int) get_option('webview_preview_menu_id');
    if (!$menu) {
        $menu = $check(wp_create_nav_menu('WebView preview'));
        update_option('webview_preview_menu_id', $menu);
    }
    $menuRecord = wp_get_nav_menu_object($menu);
    if (!$menuRecord || $menuRecord->name !== 'WebView preview') {
        throw new RuntimeException('The saved navigation menu does not belong to WebView.');
    }
    foreach (wp_get_nav_menu_items($menu) ?: [] as $item) {
        $check(wp_delete_post($item->ID, true));
    }
    foreach ($site['pages'] as $page) {
        $body = $builder === 'gutenberg' ? '<!-- wp:html -->' . strtr($page['html'], $tokens) . '<!-- /wp:html -->' : '';
        $path = $page['role'] === 'home' ? $page['slug'] : trim($page['route'], '/');
        $parent = $page['parent'] ?? null;
        $id = $check(wp_insert_post(wp_slash([
            'ID' => $old[$path] ?? 0,
            'post_type' => 'page',
            'post_status' => 'publish',
            'post_title' => $page['title'],
            'post_name' => $page['slug'],
            'post_parent' => $parent ? $check($ids[$parent] ?? 0) : 0,
            'post_content' => $body,
            'meta_input' => [
                '_webview_template' => $site['template']['slug'],
                '_webview_source_page' => $page['source'],
                'ast-site-content-layout' => 'page-builder',
                'site-post-title' => 'disabled',
                'ast-featured-img' => 'disabled',
                'theme-transparent-header-meta' => 'disabled',
            ],
        ]), true));
        $pageIds[] = $id;
        if ($builder === 'elementor') {
            $elements = $page['elementor'];
            foreach ($elements as &$container) {
                $container['elements'][0]['settings']['html'] = strtr($container['elements'][0]['settings']['html'], $tokens);
            }
            unset($container);
            $elementorData = wp_json_encode($elements, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            $check($elementorData);
            update_post_meta($id, '_elementor_edit_mode', 'builder');
            update_post_meta($id, '_elementor_template_type', 'wp-page');
            update_post_meta($id, '_elementor_version', ELEMENTOR_VERSION);
            update_post_meta($id, '_elementor_data', wp_slash($elementorData));
            if (get_post_meta($id, '_elementor_data', true) !== $elementorData) {
                throw new RuntimeException('Elementor data was not persisted.');
            }
        } else {
            foreach (['_elementor_data', '_elementor_edit_mode', '_elementor_template_type', '_elementor_version'] as $key) {
                delete_post_meta($id, $key);
            }
        }
        if (get_page_uri($id) !== $path) {
            throw new RuntimeException('A staging route conflicts with an existing page.');
        }
        unset($old[$path]);
        $ids[$page['role']] = $id;
        $menuItems[$page['role']] = $check(wp_update_nav_menu_item($menu, 0, [
            'menu-item-title' => $page['title'],
            'menu-item-type' => 'post_type',
            'menu-item-object' => 'page',
            'menu-item-object-id' => $id,
            'menu-item-parent-id' => $parent ? $check($menuItems[$parent] ?? 0) : 0,
            'menu-item-status' => 'publish',
        ]));
    }
    foreach ($old as $id) {
        $check(wp_trash_post($id));
    }
    update_option('blogname', $site['name']);
    update_option('blogdescription', $site['tagline']);
    update_option('WPLANG', $site['locale']);
    update_option('show_on_front', 'page');
    update_option('page_on_front', $ids['home']);
    update_option('blog_public', 0);
    $astra = (array) get_option('astra-settings', []);
    $astra['display-site-title'] = true;
    $astra['display-site-title-responsive'] = ['desktop' => 1, 'tablet' => 1, 'mobile' => 1];
    $astra['footer-copyright-editor'] = esc_html($site['footer']);
    update_option('astra-settings', $astra);
    set_theme_mod('nav_menu_locations', ['primary' => $menu, 'mobile_menu' => $menu]);
    remove_theme_mod('custom_logo');
    delete_option('site_icon');
    $check(wp_update_custom_css_post($site['css']));
    if ($wpdb->query('COMMIT') === false) {
        throw new RuntimeException('Could not commit the staging transaction.');
    }
} catch (Throwable $error) {
    $wpdb->query('ROLLBACK');
    wp_cache_flush();
    WP_CLI::error($error->getMessage());
}
wp_cache_flush();
if ($builder === 'elementor') {
    foreach ($pageIds as $id) {
        (new \Elementor\Core\Files\CSS\Post($id))->delete();
    }
}
flush_rewrite_rules(false);
WP_CLI::success("WebView built " . count($site['pages']) . " pages from {$site['template']['slug']}.");
