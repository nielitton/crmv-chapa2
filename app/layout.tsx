import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ação e Valorização | Pesquisa profissional',
  description: 'Sua experiência ajuda a construir uma profissão mais forte. Participe da pesquisa Ação e Valorização.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
