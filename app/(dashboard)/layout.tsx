import Sidebar from '@/components/layout/Sidebar'
import Providers from '@/components/layout/Providers'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-[#050505]">
      <Sidebar />
      <main className="flex-1 ml-52 p-8">
        <Providers>{children}</Providers>
      </main>
    </div>
  )
}
