'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/queue',     label: 'Queue' },
  { href: '/published', label: 'Published' },
  { href: '/schedule',  label: 'Schedule' },
  { href: '/logs',      label: 'Logs' },
  { href: '/settings',  label: 'Settings' },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav style={{
      background: '#080B14', borderBottom: '1px solid #1A2540',
      display: 'flex', alignItems: 'center', padding: '0 32px', height: 64,
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      {/* Logo */}
      <Link href="/queue" style={{ display: 'flex', alignItems: 'center', marginRight: 48, textDecoration: 'none' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="well.prompted" style={{ height: 32, width: 'auto', objectFit: 'contain' }} />
      </Link>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: 8, flex: 1 }}>
        {NAV_LINKS.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link key={href} href={href} style={{
              padding: '6px 16px', borderRadius: 8, textDecoration: 'none',
              fontSize: 14, fontWeight: 600, fontFamily: 'sans-serif',
              color: active ? '#0085FF' : '#5A7090',
              background: active ? '#0085FF15' : 'transparent',
              border: active ? '1px solid #0085FF30' : '1px solid transparent',
              transition: 'all 0.15s',
            }}>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
