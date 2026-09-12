import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Performance Lab OS',
  description: 'El centro operativo de Performance Lab',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
