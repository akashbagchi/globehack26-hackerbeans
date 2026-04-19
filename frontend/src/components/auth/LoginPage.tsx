'use client'
import { useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { loginDispatcher } from '../../api/client'

export function LoginPage() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('maria@sauron.fleet')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await loginDispatcher(email, password)
      setAuth(data.access_token, {
        dispatcher_id: data.dispatcher_id,
        name: data.name,
        email: data.email,
        fleet_id: data.fleet_id,
      })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-[#f8f9fa] flex items-center justify-center">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 bg-[#1a73e8] rounded flex items-center justify-center">
            <span className="text-white font-black text-lg">S</span>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[11px] font-medium text-[#5f6368] uppercase tracking-widest">AI Fleet</span>
            <span className="text-lg font-bold text-[#202124] tracking-wide">SAURON</span>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#dadce0] rounded-xl p-8">
          <h1 className="text-xl font-semibold text-[#202124] mb-1">Sign in</h1>
          <p className="text-sm text-[#5f6368] mb-6">to your dispatcher account</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full border border-[#dadce0] rounded px-3 py-2.5 text-sm text-[#202124] focus:outline-none focus:border-[#1a73e8] bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#202124] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="demo1234"
                required
                className="w-full border border-[#dadce0] rounded px-3 py-2.5 text-sm text-[#202124] focus:outline-none focus:border-[#1a73e8] bg-white"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[#1a73e8] hover:bg-[#1557b0] disabled:opacity-60 text-white font-medium text-sm rounded transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-[#5f6368] text-center mt-5">
            Demo: <span className="font-medium">maria@sauron.fleet</span> / <span className="font-medium">demo1234</span>
          </p>
        </div>
      </div>
    </div>
  )
}
