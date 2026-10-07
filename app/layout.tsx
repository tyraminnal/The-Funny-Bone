import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Funny Bone',
  description: 'Upload a photo, get AI captions, vote on the funniest.',
};

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
      <html lang="en">
      <body>{children}</body>
      </html>
  );
}