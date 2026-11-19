<?php
// Run with wp eval-file under the dedicated WebView staging tenant.
use Codev\StarterTemplatesCompanion\Companion_Core;
use Codev\StarterTemplatesCompanion\Logo_Synthesizer_Service;
use Codev\StarterTemplatesCompanion\Palette_Adapter;
use Codev\StarterTemplatesCompanion\Site_Planner_Service;

[$prospectFile] = $args;
$prospect = json_decode(file_get_contents($prospectFile), true, 32, JSON_THROW_ON_ERROR);
$name = sanitize_text_field($prospect['name']);
$address = sanitize_text_field($prospect['address']);
$phone = $prospect['phone'];
$vertical = sanitize_key($prospect['industry']);
$description = sanitize_textarea_field($prospect['description']);
$locale = str_starts_with($prospect['locale'], 'en') ? 'en_US' : 'id_ID';
$english = $locale === 'en_US';

if (!$name || !preg_match('/^\+[1-9][0-9]{7,14}$/D', $phone)) {
    WP_CLI::error('A business name and a verified-format phone number are required.');
}

$offerings = [];
foreach ($prospect['offerings'] as $entry) {
    $title = sanitize_text_field($entry['title'] ?? '');
    if ($title !== '') {
        $offerings[] = ['title' => $title, 'body' => sanitize_textarea_field($entry['description'] ?? '')];
    }
}

$about = $english ? 'About' : 'Tentang Kami';
$contact = $english ? 'Contact' : 'Kontak';
$services = $english ? 'Services' : 'Layanan';
$description = $description ?: ($address ? "$name · $address" : $name);
$contactText = $address ? "$address · $phone" : $phone;
$brief = [
    'business_name' => $name,
    'business_desc' => $description,
    'business_phone' => $phone,
    'business_address' => $address,
    'domain' => 'example.invalid',
    'vertical' => $vertical,
    'locale' => $locale,
    'services' => array_column($offerings, 'title'),
];

$pages = [];
$content = [];
$addPage = static function ($slug, $title, $type, $sections) use (&$pages, &$content) {
    $components = [];
    foreach ($sections as [$component, $variant, $heading, $copy]) {
        $id = 'sec_' . str_replace('-', '_', $slug) . '_' . count($components);
        $components[] = [
            'section_id' => $id, 'component_type' => $component, 'variant' => $variant,
            'title' => $heading, 'enabled' => true, 'order' => count($components),
        ];
        $content[$id] = $copy;
    }
    $pages[] = [
        'id' => 'page_' . str_replace('-', '_', $slug), 'title' => $title, 'slug' => $slug,
        'parent_id' => null, 'order' => count($pages), 'enabled' => true,
        'is_front_page' => $type === 'home', 'template_type' => $type, 'components' => $components,
    ];
};
$contactSlug = $english ? 'contact' : 'kontak';
$cta = ['cta', 'banner', $contact, [
    'body' => $contactText, 'label' => $contact, 'url' => home_url("/$contactSlug/"),
]];
$addPage('home', $english ? 'Home' : 'Beranda', 'home', [
    ['hero', 'split', $name, ['body' => $description]], $cta,
]);
if ($offerings) {
    $addPage($english ? 'services' : 'layanan', $services, 'services', [
        ['hero', 'centered', $services, ['body' => $name]],
        ['services_detailed', 'alternating', $services, ['items' => $offerings]], $cta,
    ]);
}
$addPage($english ? 'about' : 'tentang-kami', $about, 'about', [
    ['hero', 'centered', $about, ['body' => $description]], $cta,
]);
$addPage($contactSlug, $contact, 'contact', [
    ['hero', 'centered', $contact, ['body' => $contactText]],
    ['cta', 'banner', $english ? 'Call us' : 'Telepon', [
        'body' => $phone, 'label' => $phone, 'url' => "tel:$phone",
    ]],
]);

$palette = $prospect['palette'] ?: Site_Planner_Service::get_curated_light_palettes()['navy'];
$palette = Palette_Adapter::validate_and_normalize_palette($palette);
$document = [
    'schema_version' => 1, 'title' => $name, 'locale' => $locale, 'brief' => $brief,
    'design' => [
        'template_id' => 'business-consulting-02', 'typography_id' => 'inter',
        'builder' => 'gutenberg', 'palette' => $palette,
    ],
    'pages' => $pages, 'content' => $content,
];

$admin = get_users(['role' => 'administrator', 'number' => 1, 'fields' => 'ID'])[0] ?? 0;
if (!$admin) {
    WP_CLI::error('No staging administrator found.');
}
wp_set_current_user($admin);
$planner = new Site_Planner_Service();
$plan = $planner->create($document);
$approved = $planner->approve($plan['plan_id'], $plan['revision']);
$build = $planner->start_build($plan['plan_id'], $approved['revision'], $approved['approved_hash'], wp_generate_uuid4());
$uuid = $build['build_uuid'];
$compiled = $planner->compile($uuid);
if (empty($compiled['wxr']) || empty($compiled['manifest'])) {
    WP_CLI::error('The WebView planner did not compile a complete site.');
}

$planner->clean_existing_content();
delete_option('codev_st_active_build');
$result = $planner->run($uuid);
if ($result['state'] !== 'succeeded' || count($result['result']['page_ids']) !== count($pages)) {
    WP_CLI::error('The WebView planner did not generate all pages.');
}

update_option('blogname', $name);
update_option('blogdescription', wp_trim_words($description, 14));
update_option('WPLANG', $locale);
$settings = Palette_Adapter::merge(['astra-settings' => (array) get_option('astra-settings', [])], $palette);
update_option('astra-settings', $settings['astra-settings']);
$css = <<<'CSS'
.codev-hero-section { background: #15263d !important; }
.codev-cta-section { background: #e8f0f8 !important; }
.codev-cta-section h2, .codev-cta-section p, #colophon .ast-footer-copyright p { color: #14243a !important; }
.site-branding .custom-logo-link .custom-logo { width: min(235px, 64vw); max-width: none; height: auto; }
CSS;
$customCss = wp_update_custom_css_post($css);
if (is_wp_error($customCss)) {
    WP_CLI::error('Could not set the WebView staging styles.');
}
remove_theme_mod('custom_logo');
delete_option('site_icon');
Logo_Synthesizer_Service::ensure_site_logo($brief + ['palette' => $palette, 'title' => $name], $document);
foreach ($result['result']['page_ids'] as $id) {
    Companion_Core::get_instance()->ensure_spectra_assets($id);
}
wp_cache_flush();
flush_rewrite_rules(false);
WP_CLI::success("WebView planner built $uuid with " . count($pages) . ' pages.');
