<?php
/**
 * Shared helpers for the birthday site.
 */

declare(strict_types=1);

function e(?string $value): string
{
    return htmlspecialchars((string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

function asset(string $path): string
{
    $path = ltrim($path, '/');
    return BASE_PATH . '/assets/' . $path;
}

function url(string $path = ''): string
{
    $path = ltrim($path, '/');
    return BASE_PATH . ($path !== '' ? '/' . $path : '');
}

function media_path(string $file): string
{
    return PHOTOBOOTH_ROOT . '/assets/' . ltrim($file, '/');
}

function has_media(string $file): bool
{
    $path = media_path($file);
    return is_file($path) && filesize($path) > 0;
}

/**
 * Photos live in assets/media/photos/ as image1.jpg, image2.png, and so on.
 * The number matches the slot in includes/content.php. Any of jpg, jpeg, png, webp, or gif works.
 *
 * @return array<int, string> number => path under assets/
 */
function numbered_photo_map(): array
{
    static $cache = null;
    if ($cache !== null) {
        return $cache;
    }

    $cache = [];
    $dir = PHOTOBOOTH_ROOT . '/assets/media/photos';
    if (!is_dir($dir)) {
        return $cache;
    }

    foreach (scandir($dir) ?: [] as $file) {
        if (!preg_match('/^image(\d+)\.(jpe?g|png|webp|gif)$/i', $file, $match)) {
            continue;
        }
        $cache[(int) $match[1]] = 'media/photos/' . $file;
    }

    ksort($cache, SORT_NUMERIC);
    return $cache;
}

function numbered_photo(int $number): string
{
    $photos = numbered_photo_map();
    return $photos[$number] ?? '';
}

/**
 * Render a photo frame. Uses a local image when present, otherwise a cinematic placeholder.
 *
 * @param array{src?:string,caption?:string,alt?:string,class?:string,tone?:string,label?:string} $opts
 */
function photo_frame(array $opts): void
{
    $src = $opts['src'] ?? '';
    $caption = $opts['caption'] ?? '';
    $alt = $opts['alt'] ?? $caption;
    $class = $opts['class'] ?? '';
    $tone = $opts['tone'] ?? 'rose';
    $label = $opts['label'] ?? '';
    $has = $src !== '' && has_media($src);
    ?>
    <figure class="photo <?= e($class) ?>" data-tone="<?= e($tone) ?>">
        <div class="photo__print">
            <?php if ($has): ?>
                <img src="<?= e(asset($src)) ?>" alt="<?= e($alt !== '' ? $alt : 'A photograph') ?>" loading="lazy">
            <?php else: ?>
                <div class="photo__placeholder" aria-hidden="true">
                    <span class="photo__bloom"></span>
                    <?php if ($label !== ''): ?>
                        <span class="photo__slot-label"><?= e($label) ?></span>
                    <?php endif; ?>
                </div>
            <?php endif; ?>
            <span class="photo__leak" aria-hidden="true"></span>
        </div>
        <?php if ($caption !== ''): ?>
            <figcaption class="photo__caption"><?= e($caption) ?></figcaption>
        <?php endif; ?>
    </figure>
    <?php
}
