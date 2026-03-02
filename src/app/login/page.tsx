'use client';
import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/queue';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      router.push(redirect);
    } else {
      setError('Wrong password.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#080B14] flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">
            <span className="text-white">well</span>
            <span className="text-[#0085FF]">.prompted</span>
          </h1>
          <p className="text-gray-500 text-sm mt-2">Content portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-3 bg-[#0F1520] border border-[#1A2540] rounded-lg text-white placeholder-gray-600 focus:outline-none focus:border-[#0085FF] text-sm"
            autoFocus
          />
          {error && <p className="text-[#FF2D78] text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 bg-[#0085FF] text-white font-semibold rounded-lg hover:bg-[#3D8EEF] disabled:opacity-50 transition-colors text-sm"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
