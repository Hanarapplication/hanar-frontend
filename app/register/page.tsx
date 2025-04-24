'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const [clicked, setClicked] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [e.target.id]: e.target.value }))
  }

  const getStrengthScore = (password: string) => {
    let score = 0
    if (password.length >= 8) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    return score
  }

  const isStrongPassword = (password: string) => getStrengthScore(password) === 4

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!agreed) {
      toast.error('You must agree to the Terms and Privacy Policy.')
      return
    }

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match.')
      return
    }

    if (!isStrongPassword(form.password)) {
      toast.error('Password must include uppercase, lowercase, number & special char.')
      return
    }

    if (!supabase) {
      toast.error('Supabase client not available.')
      return
    }

    try {
      setClicked(true)

      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name },
        },
      })

      if (error) throw new Error(error.message)

      toast.success('Registration successful! Please check your email to confirm.')
      router.push('/login')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setClicked(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google') => {
    if (!supabase) {
      toast.error('Supabase client not available.')
      return
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      toast.error(error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div>
          <h2 className="text-3xl font-semibold text-gray-800 text-center">Create Your Hanar Account</h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">sign in to your account</a>
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleRegister}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Full Name</label>
            <input id="name" type="text" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 sm:text-sm" value={form.name} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email address</label>
            <input id="email" type="email" required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 sm:text-sm" value={form.email} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
            <input id="password" type={showPassword ? 'text' : 'password'} required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 sm:text-sm" value={form.password} onChange={handleChange} />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirm Password</label>
            <input id="confirmPassword" type={showPassword ? 'text' : 'password'} required className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 sm:text-sm" value={form.confirmPassword} onChange={handleChange} />
          </div>

          <div className="flex items-start">
            <input id="agreed" type="checkbox" className="h-4 w-4 text-indigo-600 border-gray-300 rounded" checked={agreed} onChange={() => setAgreed(!agreed)} />
            <label htmlFor="agreed" className="ml-2 text-sm text-gray-700">
              I agree to the <a href="/terms" className="text-indigo-600 hover:underline">Terms</a> and <a href="/privacy" className="text-indigo-600 hover:underline">Privacy Policy</a>
            </label>
          </div>

          <button type="submit" disabled={clicked} className={`w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 ${clicked ? 'scale-95' : ''}`}>
            {clicked ? 'Registering...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-4">
            <button onClick={() => handleOAuthLogin('google')} className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-500 bg-white hover:bg-gray-50">
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
