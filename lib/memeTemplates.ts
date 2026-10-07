// Classic top/bottom text meme templates (images hosted by Imgflip).
export interface MemeTemplate {
    id: string;
    name: string;
    url: string;
    hint: string;
}

export const MEME_TEMPLATES: MemeTemplate[] = [
    { id: 'disaster-girl', name: 'Disaster Girl', url: 'https://i.imgflip.com/23ls.jpg', hint: 'smug kid in front of a house fire; causing chaos on purpose' },
    { id: 'waiting-skeleton', name: 'Waiting Skeleton', url: 'https://i.imgflip.com/2fm6x.jpg', hint: 'skeleton on a bench; waiting forever for something' },
    { id: 'yall-got-any-more', name: "Y'all Got Any More Of That", url: 'https://i.imgflip.com/21uy0f.jpg', hint: 'desperately craving more of something' },
    { id: 'ancient-aliens', name: 'Ancient Aliens', url: 'https://i.imgflip.com/26am.jpg', hint: 'blaming an absurd explanation: "aliens"' },
    { id: 'mocking-spongebob', name: 'Mocking Spongebob', url: 'https://i.imgflip.com/1otk96.jpg', hint: 'mocking a statement by repeating it in alternating caps' },
    { id: 'one-does-not-simply', name: 'One Does Not Simply', url: 'https://i.imgflip.com/1bij.jpg', hint: '"one does not simply..." something hard' },
    { id: 'oprah', name: 'Oprah You Get A', url: 'https://i.imgflip.com/gtj5t.jpg', hint: 'everyone gets something (usually bad)' },
    { id: 'this-is-fine', name: 'This Is Fine', url: 'https://i.imgflip.com/wxica.jpg', hint: 'dog calmly sitting in a burning room; denial' },
    { id: 'roll-safe', name: 'Roll Safe Think About It', url: 'https://i.imgflip.com/1h7in3.jpg', hint: 'tapping head; terrible "smart" life hack' },
    { id: 'hide-the-pain', name: 'Hide the Pain Harold', url: 'https://i.imgflip.com/gk5el.jpg', hint: 'smiling through quiet suffering' },
    { id: 'laughing-leo', name: 'Laughing Leo', url: 'https://i.imgflip.com/4acd7j.png', hint: 'laughing at someone else\'s situation' },
    { id: 'bad-luck-brian', name: 'Bad Luck Brian', url: 'https://i.imgflip.com/1bip.jpg', hint: 'setup, then the worst possible outcome' },
    { id: 'futurama-fry', name: 'Futurama Fry', url: 'https://i.imgflip.com/1bgw.jpg', hint: '"not sure if X or Y"' },
    { id: 'skeptical-kid', name: 'Third World Skeptical Kid', url: 'https://i.imgflip.com/265k.jpg', hint: 'deeply skeptical of something' },
    { id: 'leo-cheers', name: 'Leonardo Dicaprio Cheers', url: 'https://i.imgflip.com/39t1o.jpg', hint: 'toasting to a small or ironic victory' },
    { id: 'change-my-mind', name: 'Change My Mind', url: 'https://i.imgflip.com/24y43o.jpg', hint: 'hot take on a sign, "change my mind"' },
];

export function templateById(id: string): MemeTemplate | undefined {
    return MEME_TEMPLATES.find((t) => t.id === id);
}
