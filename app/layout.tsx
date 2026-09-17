import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Performance Lab OS',
  description: 'El centro operativo de Performance Lab',
  icons: {
    icon: [
      { url: '/favicon-32x32.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/icon.png?v=2', sizes: '48x48', type: 'image/png' },
      { url: '/logo.png?v=2', type: 'image/png' }
    ],
    shortcut: '/favicon-32x32.png?v=2',
    apple: '/apple-touch-icon.png?v=2',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon-32x32.png?v=2" sizes="32x32" type="image/png" />
        <link rel="icon" href="/icon.png?v=2" sizes="48x48" type="image/png" />
        <link rel="shortcut icon" href="/favicon-32x32.png?v=2" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=2" sizes="180x180" />
      </head>
      <body>{children}</body>
    </html>
  );
}
