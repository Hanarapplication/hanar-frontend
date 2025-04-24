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

    try {
      setClicked(true)

      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { name: form.name },
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      toast.success('Registration successful! Please check your email to confirm.')
      router.push('/login')
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setClicked(false)
    }
  }

  const handleOAuthLogin = async (provider: 'google') => {
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
          <h2 className="text-3xl font-semibold text-gray-800 text-center">
            Create Your Hanar Account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Or{' '}
            <a href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              sign in to your account
            </a>
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleRegister}>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <div className="mt-1">
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={form.name}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email address
            </label>
            <div className="mt-1">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={form.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={form.password}
                onChange={handleChange}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5">
                <input
                  id="showPassword"
                  name="showPassword"
                  type="checkbox"
                  className="form-checkbox h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  checked={showPassword}
                  onChange={() => setShowPassword(!showPassword)}
                />
                <label htmlFor="showPassword" className="ml-2 text-gray-500">
                  Show
                </label>
              </div>
            </div>
            {form.password && (
              <div className="mt-2">
                <div className="w-full h-2 rounded-full bg-gray-200">
                  <div
                    className={`h-full rounded-full transition-all ${
                      {
                        1: 'w-1/4 bg-red-500',
                        2: 'w-2/4 bg-orange-400',
                        3: 'w-3/4 bg-yellow-400',
                        4: 'w-full bg-green-500',
                      }[getStrengthScore(form.password)] || 'w-0'
                    }`}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Strength:{' '}
                  {
                    {
                      1: 'Weak',
                      2: 'Moderate',
                      3: 'Strong',
                      4: 'Very Strong',
                    }[getStrengthScore(form.password)] || 'Too short'
                  }
                </p>
              </div>
            )}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
              Confirm Password
            </label>
            <div className="mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                value={form.confirmPassword}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="agreed"
                name="agreed"
                type="checkbox"
                className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300 rounded"
                checked={agreed}
                onChange={() => setAgreed(!agreed)}
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="agreed" className="font-medium text-gray-700">
                I agree to the{' '}
                <a href="/terms" target="_blank" className="text-indigo-600 hover:underline">
                  Terms
                </a>{' '}
                and{' '}
                <a href="/privacy" target="_blank" className="text-indigo-600 hover:underline">
                  Privacy Policy
                </a>
              </label>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={clicked}
              className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-transform duration-200 ${
                clicked ? 'scale-95' : ''
              }`}
            >
              {clicked ? 'Registering...' : 'Create Account'}
            </button>
          </div>
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

          <div className="mt-4 space-y-2">
            <button
              onClick={() => handleOAuthLogin('google')}
              className="w-full flex items-center justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-500 bg-white hover:bg-gray-50"
            >
              <svg className="mr-2 h-5 w-5" viewBox="0 0 48 48">
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.2l6.88-6.88c-5.87-4.75-13.45-7.62-22.09-7.62C7.16 4.8 0.6 11.85 0.6 21.62c0 9.54 7.06 16.62 16.62 16.62 3.48 0 6.7-1.25 9.13-3.3l-6.65-6.65c-2.27 1.5-5.16 2.4-8.12 2.4-6.62 0-12.27-4.95-12.27-11.27 0-6.32 5.65-11.27 12.27-11.27 3.31 0 6.12 1.39 8.16 3.44l6.21-6.21c-3.9-2.68-8.96-4.2-14.31-4.2-11.22 0-20.59 9.1-20.59 20.32 0 11.09 9.37 20.19 20.59 20.19 11.03 0 20.13-8.9 20.13-20.19 0-5.2-2.03-9.92-5.48-13.4l-6.76 6.76c2.58 1.8 5.48 2.82 8.41 2.82 6.62 0 11.97-4.85 11.97-11.47 0-6.42-5.35-11.27-11.97-11.27-3.29 0-6.04 1.26-8.26 3.48z"
                />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

