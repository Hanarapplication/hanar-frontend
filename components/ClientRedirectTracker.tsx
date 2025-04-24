'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export default function ClientRedirectTracker() {
  const pathname = usePathname()

  useEffect(() => {
    if (!['/login', '/register'].includes(pathname)) {
      localStorage.setItem('hanar_redirect_after_auth', pathname)
    }
  }, [pathname])

  return null // ✅ Doesn't render anything visible
}
