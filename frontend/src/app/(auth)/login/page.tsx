'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';

export default function LoginPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '420px',
          background: 'white',
          borderRadius: '1rem',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <Link href="/" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '2.5rem',
                height: '2.5rem',
                borderRadius: '0.625rem',
                background: 'linear-gradient(135deg, var(--color-accent), var(--color-gold))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.125rem',
                fontWeight: 700,
              }}
            >
              T
            </div>
            <span className="font-display" style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              TextileShop
            </span>
          </Link>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>
          Welcome Back
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Sign in to your account to continue
        </p>

        {error && (
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            marginBottom: '1.5rem',
            border: '1px solid #fecaca',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label className="input-label">Email Address</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label className="input-label">Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
            />
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-lg"
            disabled={isLoading}
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Don&apos;t have an account?{' '}
          <Link href="/register" style={{ color: 'var(--color-accent)', fontWeight: 500, textDecoration: 'none' }}>
            Create one
          </Link>
        </p>

        {/* Demo credentials */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'var(--color-border-light)',
          borderRadius: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--color-text-muted)',
        }}>
          <p style={{ fontWeight: 600, marginBottom: '0.375rem' }}>Demo Credentials:</p>
          <p>Admin: admin@textileshop.com / Admin@123456</p>
          <p>Customer: customer@example.com / Customer@123456</p>
        </div>
      </div>
    </div>
  );
}
