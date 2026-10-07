import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Funny Bone',
  description: 'Upload a photo, get AI captions, vote on the funniest.',
};

// Applies the saved profile skin before first paint so the page doesn't flash.
const skinScript = `try{var s=localStorage.getItem('fb-skin');if(s)document.documentElement.dataset.skin=s}catch(e){}`;

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
      <html lang="en" data-skin="classic" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: skinScript }} />
      </head>
      <body>{children}</body>
      </html>
  );
}
