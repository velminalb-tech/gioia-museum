<?php
/**
 * Personal content — edit captions and copy here.
 * Drop every photo into assets/media/photos/ and name them image1, image2, image3…
 * (jpg, jpeg, png, webp, or gif). The number picks the slot below.
 *
 *  1–6   opening scrapbook
 *  7–11  personality cards
 * 12–16  her world
 * 17–22  the people
 * 23–27  us
 */

declare(strict_types=1);

$scrapbookPhotos = [
    [
        'src' => numbered_photo(1),
        'caption' => 'Look at this pretty girl, Gioia.',
        'class' => 'photo--featured',
        'tone' => 'blush',
        'label' => 'featured photo',
    ],
    [
        'src' => numbered_photo(2),
        'caption' => 'One of my favorite smiles.',
        'class' => 'photo--small',
        'tone' => 'cream',
        'label' => 'smile',
    ],
    [
        'src' => numbered_photo(3),
        'caption' => "You didn't know I was taking this, did you?",
        'class' => 'photo--small',
        'tone' => 'honey',
        'label' => 'candid',
    ],
    [
        'src' => numbered_photo(4),
        'caption' => 'Literally, how are you this cute?',
        'class' => 'photo--polaroid r-left',
        'tone' => 'rose',
        'label' => 'polaroid 1',
    ],
    [
        'src' => numbered_photo(5),
        'caption' => 'This one lives in my head rent-free.',
        'class' => 'photo--polaroid r-right',
        'tone' => 'lilac',
        'label' => 'polaroid 2',
    ],
    [
        'src' => numbered_photo(6),
        'caption' => 'Proof that joy looks good on you.',
        'class' => 'photo--polaroid r-slight',
        'tone' => 'peach',
        'label' => 'polaroid 3',
    ],
];

$personalityCards = [
    [
        'id' => 'favorites',
        'kicker' => 'Her favorites',
        'title' => 'Fries, obviously',
        'icon' => '🍟',
        'preview' => 'Golden, salty, and somehow exactly as joyful as your name.',
        'body' => 'If joy had a side order, it would be fries. You light up for the crispy ones, love — salty, golden, a little chaotic, completely you. Gioia means joy, and a carton of fries figured that out before anyone else did. Colors, places, the hobbies that make time disappear: they all live here too. The fries just get to the front of the line.',
        'photo' => numbered_photo(7),
        'tone' => 'pink',
    ],
    [
        'id' => 'habits',
        'kicker' => 'Her little habits',
        'title' => 'The adorable details',
        'icon' => '✦',
        'preview' => 'Funny things you do, and the tiny rituals that make me smile.',
        'body' => 'The way you laugh at your own jokes. The little routines you don’t even notice. The way you lean in when the fries arrive, like the day just got better. The habits that are so you they could never belong to anyone else. I collect them quietly — they’re some of my favorite parts of knowing you, love.',
        'photo' => numbered_photo(8),
        'tone' => 'peach',
    ],
    [
        'id' => 'personality',
        'kicker' => 'Her personality',
        'title' => 'What makes you, you',
        'icon' => '☼',
        'preview' => 'The things I admire, and the way you move through the world.',
        'body' => 'You are kind in ways that don’t ask for credit. Curious. Funny. Soft and strong in the same breath. I admire how you care, how you notice people, and how you keep becoming more yourself — not a smaller version of what anyone expects.',
        'photo' => numbered_photo(9),
        'tone' => 'lilac',
    ],
    [
        'id' => 'smile',
        'kicker' => 'Her smile',
        'title' => 'That one candid',
        'icon' => '☺',
        'preview' => 'A favorite photograph, and a little message about your smile.',
        'body' => 'Your smile does that thing where the whole room rearranges itself. I don’t have a better explanation. It is one of my favorite sights in the world — unposed, unexpected, completely yours.',
        'photo' => numbered_photo(10),
        'tone' => 'honey',
    ],
    [
        'id' => 'random',
        'kicker' => 'Random moments',
        'title' => 'Inside jokes & chaos',
        'icon' => '✧',
        'preview' => 'Funny pictures, unforgettable little moments, and the bits only we get.',
        'body' => 'The bits that would make no sense to anyone else. The photos that still make me laugh. The ordinary minutes that somehow became core memories. I wouldn’t trade those for anything polished.',
        'photo' => numbered_photo(11),
        'tone' => 'mint',
    ],
];

$worldPhotos = [
    ['src' => numbered_photo(12), 'caption' => 'A life that does not have to stay the same', 'tone' => 'film', 'class' => 'photo--wide', 'label' => 'becoming'],
    ['src' => numbered_photo(13), 'caption' => 'A smile I would tell again tomorrow', 'tone' => 'amber', 'class' => 'photo--portrait', 'label' => 'retold'],
    ['src' => numbered_photo(14), 'caption' => 'Out where the path is still unknown', 'tone' => 'dusk', 'class' => 'photo--landscape', 'label' => 'unknown path'],
    ['src' => numbered_photo(15), 'caption' => 'The quiet that stays after the noise', 'tone' => 'tea', 'class' => 'photo--square', 'label' => 'quiet'],
    ['src' => numbered_photo(16), 'caption' => 'Still you, even if the picture fades', 'tone' => 'gold', 'class' => 'photo--tall', 'label' => 'still you'],
];

$peoplePhotos = [
    ['src' => numbered_photo(17), 'caption' => 'A home you did not have to earn', 'tone' => 'film', 'label' => 'friends'],
    ['src' => numbered_photo(18), 'caption' => 'The people who stay', 'tone' => 'tea', 'label' => 'family'],
    ['src' => numbered_photo(19), 'caption' => 'A night worth telling again', 'tone' => 'amber', 'label' => 'occasion'],
    ['src' => numbered_photo(20), 'caption' => 'Together, even if the day changes', 'tone' => 'dusk', 'label' => 'together'],
    ['src' => numbered_photo(21), 'caption' => 'Loved, without being asked to freeze', 'tone' => 'gold', 'label' => 'love'],
    ['src' => numbered_photo(22), 'caption' => 'A small day, kept', 'tone' => 'film', 'label' => 'memory'],
];

$usPhotos = [
    ['src' => numbered_photo(23), 'caption' => 'A photograph I would not let fade', 'class' => 'photo--featured r-left', 'tone' => 'film', 'label' => 'us'],
    ['src' => numbered_photo(24), 'caption' => 'A story I would start again', 'class' => 'photo--polaroid r-right', 'tone' => 'amber', 'label' => 'retold'],
    ['src' => numbered_photo(25), 'caption' => 'Nothing loud. Everything kept.', 'class' => 'photo--polaroid r-slight', 'tone' => 'tea', 'label' => 'quiet'],
    ['src' => numbered_photo(26), 'caption' => 'A day I still come back to', 'class' => 'photo--small', 'tone' => 'gold', 'label' => 'return'],
    ['src' => numbered_photo(27), 'caption' => 'One of the quiet, good ones', 'class' => 'photo--small', 'tone' => 'dusk', 'label' => 'kept'],
];

$futureLines = [
    'To the Gioia I have not met yet...',
    'You can change. The vow does not ask you to stay frozen.',
    'New cities, new people, a life that does not look like before.',
    'When that time comes, I want to welcome it with you.',
    'Even if now is different from yesterday.',
    'I hope you love every version. The promise already does.',
];

$transitionLines = [
    'Even if a photograph fades, I will still know you.',
    'Yesterday. Today. And whatever tomorrow becomes.',
    'If our favorite story pauses, I will tell it again.',
    'It does not have to look like before.',
    'When something new arrives, we can meet it with a whole heart.',
    'That is the panata. It stays.',
];
