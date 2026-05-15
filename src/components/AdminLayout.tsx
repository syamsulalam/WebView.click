import { Outlet, Link, useLocation } from "react-router-dom";
import { Globe2, LayoutDashboard, Users, UserCircle, Webhook, Settings } from "lucide-react";
import { SignIn, useUser, useClerk } from "@clerk/clerk-react";

export default function AdminLayout() {
  const isDevHost = window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost');
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
  const isDevBypass = !clerkKey || (clerkKey.startsWith('pk_live_') && isDevHost);

  if (isDevBypass) {
    return <BypassLayout />;
  }

  return <ClerkSecureLayout />;
}

// Komponen Navbar yang sama
function NavContent({ onSignOut }: { onSignOut: () => void }) {
  const location = useLocation();
  const links = [
    { to: "/admin", icon: <LayoutDashboard size={24} />, label: "Dashboard" },
    { to: "/admin/leads", icon: <Users size={24} />, label: "CRM Leads" },
    { to: "/admin/sites", icon: <Globe2 size={24} />, label: "Generated Sites" },
    { to: "/admin/schema", icon: <Webhook size={24} />, label: "JSON Schema Info" },
    { to: "/admin/settings", icon: <Settings size={24} />, label: "Settings" } // Ditambahkan setting
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden w-full">
      <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 gap-6 relative shrink-0">
        {links.map(link => (
          <Link 
            key={link.to}
            to={link.to} 
            className={`p-3 rounded-xl transition-colors group relative ${
              location.pathname === link.to ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {link.icon}
            <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
              {link.label}
            </span>
          </Link>
        ))}
        
        <button 
          onClick={onSignOut}
          className="mt-auto mb-6 p-3 rounded-xl transition-colors group relative text-gray-500 hover:bg-red-50 hover:text-red-600"
        >
          <UserCircle size={24} />
          <span className="absolute left-full ml-3 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-[9999] pointer-events-none">
            Sign Out
          </span>
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-50 h-screen">
        <Outlet />
      </div>
    </div>
  );
}

// Layout khusus jika bypass Clerk Dev
function BypassLayout() {
  return (
    <div className="relative h-screen w-screen overflow-hidden">
        <div className="absolute top-0 right-0 bg-yellow-500 text-xs px-2 py-1 text-black font-bold z-[10000] rounded-bl-lg shadow-sm">
          DEV BYPASS MODE
        </div>
        <NavContent onSignOut={() => alert("Logout simulated in Devypass Mode")} />
    </div>
  );
}

// Layout dengan pengamanan Clerk
function ClerkSecureLayout() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();

  if (!isLoaded) {
    return <div className="h-screen flex items-center justify-center bg-gray-50 font-medium text-gray-500">Memuat Sistem Autentikasi...</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6 flex-col font-sans">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">WebView CRM</h1>
          <p className="text-gray-500">Masuk untuk mengelola prospek dan website klien.</p>
        </div>
        <SignIn routing="hash" fallbackRedirectUrl="/admin" signUpFallbackRedirectUrl="/admin" />
      </div>
    );
  }

  if (user.publicMetadata?.role !== 'admin') {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 p-6 font-sans">
        <div className="max-w-xl w-full bg-white p-8 rounded-2xl shadow-xl border border-gray-100 space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Akses Ditolak</h2>
            <p className="text-gray-600">
              Akun Anda (<b>{user.primaryEmailAddress?.emailAddress}</b>) saat ini belum memiliki role admin. 
              Anda harus mengatur metadata publik untuk mengakses dashboard.
            </p>
          </div>
          
          <div className="bg-blue-50 border border-blue-100 p-5 rounded-xl text-sm text-blue-900 space-y-3">
             <p className="font-semibold text-blue-950 text-base">Cara memberikan akses admin:</p>
             <ol className="list-decimal pl-5 space-y-2">
               <li>Masuk ke Dashboard Clerk (<a href="https://dashboard.clerk.com" className="text-indigo-700 font-medium hover:underline" target="_blank" rel="noreferrer">dashboard.clerk.com</a>).</li>
               <li>Pergi ke menu <b>Users</b> dan klik Email Anda yang ada di daftar.</li>
               <li>Gulir ke bawah halaman hingga Anda menemukan bagian <b>Public Metadata</b>.</li>
               <li>Edit dan masukkan format JSON berikut ini secara persis: <br/>
                 <code className="block mt-3 bg-white p-3 rounded-lg border border-blue-200 text-gray-800 font-mono text-xs shadow-sm">
                   {`{\n  "role": "admin"\n}`}
                 </code>
               </li>
               <li>Klik Simpan (Save). Setelah itu, klik tombol muat ulang di bawah ini.</li>
             </ol>
           </div>

          <div className="flex gap-4 pt-2">
            <button 
              onClick={() => window.location.reload()}
              className="flex-1 bg-indigo-600 text-white py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition shadow-sm"
            >
              Muat Ulang Halaman
            </button>
            <button 
              onClick={() => signOut({ redirectUrl: '/admin' })}
              className="flex-1 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition shadow-sm"
            >
              Ubah Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <NavContent onSignOut={() => signOut({ redirectUrl: '/admin' })} />;
}
