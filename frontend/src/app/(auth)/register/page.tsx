'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';

export default function RegisterPage() {
  const router = useRouter();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      await register({
        email: form.email,
        password: form.password,
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || undefined,
      });
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
          maxWidth: '480px',
          background: 'white',
          borderRadius: '1rem',
          padding: '2.5rem',
          boxShadow: 'var(--shadow-xl)',
        }}
      >
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
          Create Account
        </h1>
        <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem', marginBottom: '2rem' }}>
          Join TextileShop and start shopping premium fabrics
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label className="input-label">First Name</label>
              <input className="input" name="firstName" value={form.firstName} onChange={handleChange} placeholder="John" required />
            </div>
            <div>
              <label className="input-label">Last Name</label>
              <input className="input" name="lastName" value={form.lastName} onChange={handleChange} placeholder="Doe" required />
            </div>
          </div>
          <div>
            <label className="input-label">Email Address</label>
            <input className="input" type="email" name="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          </div>
          <div>
            <label className="input-label">Phone (Optional)</label>
            <input className="input" name="phone" value={form.phone} onChange={handleChange} placeholder="+94 77 123 4567" />
          </div>
          <div>
            <label className="input-label">Password</label>
            <input className="input" type="password" name="password" value={form.password} onChange={handleChange} placeholder="Min 8 characters" required minLength={8} />
          </div>
          <div>
            <label className="input-label">Confirm Password</label>
            <input className="input" type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="••••••••" required minLength={8} />
          </div>
          <button type="submit" className="btn btn-primary btn-lg" disabled={isLoading} style={{ width: '100%', marginTop: '0.5rem' }}>
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: 'var(--color-accent)', fontWeight: 500, textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
