import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Funny Bone',
  description: 'Welcome to The Funny Bone',
};

export default function RootLayout({
                                     children,
                                   }: {
  children: React.ReactNode;
}) {
  return (
      <html lang="en">
      <body>
      <ProfileCheckWrapper>{children}</ProfileCheckWrapper>
      </body>
      </html>
  );
}

function ProfileCheckWrapper({ children }: { children: React.ReactNode }) {
  'use client';

  const { useEffect } = require('react');
  const { useRouter, usePathname } = require('next/navigation');
  const { supabase } = require('@/lib/supabase');
  const [isChecking, setIsChecking] = useEffect ? require('react').useState(true) : [true, () => {}];

  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkProfile = async () => {
      // Skip check on auth pages
      if (pathname?.startsWith('/auth')) {
        setIsChecking(false);
        return;
      }

      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        router.push('/auth');
        return;
      }

      // Check profile completion
      const { data: profileData } = await supabase
          .from('profiles')
          .select('first_name, last_name, avatar_url')
          .eq('id', data.session.user.id)
          .single();

      if (profileData) {
        const isProfileIncomplete =
            !profileData.first_name &&
            !profileData.last_name &&
            !profileData.avatar_url;

        if (isProfileIncomplete && pathname !== '/auth/setup') {
          router.push('/auth/setup');
          return;
        }
      }

      setIsChecking(false);
    };

    checkProfile();
  }, [pathname, router]);

  if (isChecking) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return children;
}