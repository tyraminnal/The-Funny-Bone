export interface Theme {
    slug: string;
    title: string;
    blurb: string;
}

// One theme per day, in rotation. Everyone sees the same theme on the same day.
export const THEMES: Theme[] = [
    { slug: 'underground', title: 'Underground', blurb: 'Anything on, under, or waiting forever for the subway.' },
    { slug: 'mystery-meal', title: 'Mystery Meal', blurb: 'John Jay, Ferris, JJ’s. Show us what’s on the tray.' },
    { slug: 'midwest-vs-nyc', title: 'Midwest vs. NYC', blurb: 'Moments that would never happen back home.' },
    { slug: 'dorm-life', title: 'Dorm Life', blurb: 'Your room, your roommate, your extremely small sink.' },
    { slug: 'butler-2am', title: 'Butler at 2am', blurb: 'Studying, “studying,” and the people of Butler Library.' },
    { slug: 'bodega-hours', title: 'Bodega Hours', blurb: 'Bodega cats, chopped cheese, and snacks of unknown origin.' },
    { slug: 'weekend-explorer', title: 'Weekend Explorer', blurb: 'Wherever the weekend took you below 110th St.' },
    { slug: 'low-steps', title: 'Low Steps', blurb: 'Campus scenes, squirrels, and tour groups in your way.' },
    { slug: 'city-wildlife', title: 'City Wildlife', blurb: 'Pigeons, rats, and dogs riding in strollers.' },
    { slug: 'weather-report', title: 'Weather Report', blurb: 'NYC weather doing whatever it wants today.' },
];

export const CAPTION_STYLES = [
    { name: 'Deadpan', guide: 'dry, understated, said with a completely straight face' },
    { name: 'Chronically Online', guide: 'Gen Z internet humor, meme formats, current slang, lowercase energy' },
    { name: 'Midwest Transplant', guide: 'a polite Midwesterner newly in NYC, culture shock, comparisons to home' },
    { name: 'Real New Yorker', guide: 'a jaded lifelong New Yorker who has seen it all and is unimpressed' },
] as const;

// Days are counted in New York time so the theme flips at local midnight.
export function nyDayNumber(date: Date = new Date()): number {
    const ymd = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
    return Math.floor(Date.parse(`${ymd}T00:00:00Z`) / 86_400_000);
}

export function themeForDay(day: number): Theme {
    return THEMES[((day % THEMES.length) + THEMES.length) % THEMES.length];
}

export function todaysTheme(): Theme {
    return themeForDay(nyDayNumber());
}

export function themeBySlug(slug: string): Theme | undefined {
    return THEMES.find((t) => t.slug === slug);
}
