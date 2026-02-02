'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import toast from 'react-hot-toast'

export default function AuthCallback() {
  const router = useRouter()

  useEffect(() => {
    const handleRedirect = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (error || !data?.session) {
        toast.error('Login failed. Please try again.')
        router.push('/login')
      } else {
        // Get user type and store it
        const userId = data.session.user?.id
        if (userId) {
          const { data: profile } = await supabase
            .from('registeredaccounts')
            .select('business, organization')
            .eq('user_id', userId)
            .maybeSingle()

          let userType: 'business' | 'individual' | 'organization' = 'individual'
          
          if (profile?.business === true) {
            userType = 'business'
          } else if (profile?.organization === true) {
            userType = 'organization'
          }

          // Store user type in localStorage
          if (typeof window !== 'undefined') {
            localStorage.setItem('userType', userType)
          }
        }

        toast.success('Signed in successfully!')
        router.push('/')
      }
    }

    handleRedirect()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-lg text-gray-700">Signing you in...</p>
    </div>
  )
}
