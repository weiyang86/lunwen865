'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDownIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { clientAuth, type ClientUser } from '@/lib/client/auth';
import { getCartCountSnapshot, setupCartListenersOnce, subscribeCart } from '@/lib/client/cart';

const navItemsAuthed = [
  { href: '/', label: '首页' },
  { href: '/products', label: '商品' },
  { href: '/cart', label: '购物车' },
  { href: '/orders', label: '订单' },
  { href: '/tasks', label: '任务' },
  { href: '/downloads', label: '下载' },
];

const navItemsPublic = [
  { href: '/', label: '首页' },
  { href: '/products', label: '商品' },
  { href: '/cart', label: '购物车' },
];

export function ClientShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<ClientUser | null>(null);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    setUser(clientAuth.getUser());
  }, [pathname]);

  const navItems = useMemo(
    () => (user ? navItemsAuthed : navItemsPublic),
    [user],
  );

  useEffect(() => {
    setupCartListenersOnce();
    setCartCount(getCartCountSnapshot());
    const unsub = subscribeCart(() => {
      setCartCount(getCartCountSnapshot());
    });
    return () => unsub();
  }, []);

  const userLabel = useMemo(() => {
    if (!user) return '';
    return user.nickname || user.email || user.phone || user.id;
  }, [user]);

  const avatarFallback = useMemo(() => {
    const s = userLabel.trim();
    if (!s) return 'U';
    return s.slice(0, 1).toUpperCase();
  }, [userLabel]);

  const activeHref = useMemo(() => {
    const current = pathname || '/';
    const sorted = [...navItems].sort((a, b) => b.href.length - a.href.length);
    return (
      sorted.find((i) => i.href === current || current.startsWith(`${i.href}/`))
        ?.href ?? '/'
    );
  }, [navItems, pathname]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-base font-semibold tracking-tight">
              论文通
            </Link>
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {navItems.map((item) => {
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={
                      active
                        ? 'rounded-md bg-slate-900 px-3 py-2 text-white'
                        : 'rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }
                  >
                    <span className="relative inline-flex items-center gap-1">
                      {item.label}
                      {item.href === '/cart' && cartCount > 0 ? (
                        <span
                          className={
                            active
                              ? 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/20 px-1 text-[11px] font-semibold leading-none text-white'
                              : 'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-semibold leading-none text-white'
                          }
                        >
                          {cartCount > 99 ? '99+' : String(cartCount)}
                        </span>
                      ) : null}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-1 text-sm md:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-2 py-2 text-slate-700 hover:bg-slate-100"
                >
                  {item.label === '购物车' && cartCount > 0
                    ? `购物车(${cartCount > 99 ? '99+' : String(cartCount)})`
                    : item.label}
                </Link>
              ))}
            </nav>

            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1.5 text-sm shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 data-[state=open]:border-slate-300 data-[state=open]:bg-slate-50"
                  >
                    <Avatar size="sm">
                      <AvatarImage src="" alt="" />
                      <AvatarFallback>{avatarFallback}</AvatarFallback>
                    </Avatar>
                    <span className="max-w-28 truncate text-slate-700 md:max-w-40">
                      {userLabel}
                    </span>
                    <ChevronDownIcon className="size-4 text-slate-500 transition group-data-[state=open]:rotate-180" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="truncate">
                    {userLabel || '已登录'}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => router.push('/account')}>
                    个人中心
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => {
                      clientAuth.clearToken();
                      setUser(null);
                      router.replace('/login');
                    }}
                  >
                    退出登录
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/login">登录 / 注册</Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        {children}
      </main>
    </div>
  );
}
