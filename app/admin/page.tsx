import type { Metadata } from 'next';
import Admin from './painel';

export const metadata: Metadata = {
  title: 'Cadastros | Ação e Valorização',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <Admin />;
}
