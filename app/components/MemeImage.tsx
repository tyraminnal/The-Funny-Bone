// An image with classic white Impact meme text drawn over it.
export default function MemeImage({ src, alt, topText, bottomText }: {
    src: string;
    alt: string;
    topText?: string;
    bottomText?: string;
}) {
    const size = (text?: string) => ((text?.length ?? 0) > 55 ? 'long' : '');

    return (
        <div className="ms-meme">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} />
            {topText && <p className={`ms-meme-text top ${size(topText)}`}>{topText}</p>}
            {bottomText && <p className={`ms-meme-text bottom ${size(bottomText)}`}>{bottomText}</p>}
        </div>
    );
}
