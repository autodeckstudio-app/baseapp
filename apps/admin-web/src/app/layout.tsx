import type { ReactNode } from 'react';
import { AuthProvider } from '../auth/AuthProvider';

export const metadata = {
  title: 'AutoDeck Admin',
  description: 'AutoDeck Owner/Admin and Studio Manager console — foundation scaffold.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
