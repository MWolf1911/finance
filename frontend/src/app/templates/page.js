'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TemplatesPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/transactions');
  }, [router]);
  return <div className="text-center py-20 text-gray-400">Redirecting to Transactions...</div>;
}
