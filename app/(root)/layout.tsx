import Header from '@/components/Header'
import MobileNavigation from '@/components/MobileNavigation'
import Sidebar from '@/components/Sidebar'
import { getCurrentuser } from '@/lib/actions/user.actions'
import { redirect } from 'next/navigation'
import React from 'react'
import { Toaster } from '@/components/ui/toaster'
export const dynamic = 'force-dynamic'
const layout = async ({children}:{children: React.ReactNode}) => {
    const currentUser =await getCurrentuser()
    if (!currentUser) return redirect('/sign-in')
  return (
    <main className="flex h-screen">
        <Sidebar {...currentUser}/>
        <section className='flex flex-1 flex-col h-full'>
            <MobileNavigation {...currentUser}/>
            <Header userId={currentUser.$id} accountId={currentUser.accountId}/>
            <div className='main-content'>
                {children}

            </div>

        </section>
        <Toaster/>
      
    </main>
  )
}

export default layout
