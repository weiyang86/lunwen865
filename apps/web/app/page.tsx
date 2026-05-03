'use client';

import { useEffect, useState } from 'react';

type ApiResponse = {
  message: string;
  timestamp: string;
};

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    fetch('http://localhost:3001')
      .then((res) => res.json())
      .then((json: ApiResponse) => {
        setData(json);
      })
      .catch(() => {
        console.error('Failed to fetch API');
      });
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <div className="text-2xl font-bold">
        {data?.message ?? 'Loading...'}
      </div>
      <div className="text-gray-500">
        {data?.timestamp}
      </div>
    </main>
  );
}