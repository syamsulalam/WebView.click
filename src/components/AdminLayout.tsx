import { useEffect, useRef, useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { FileText, Globe2, LayoutDashboard, ListChecks, Users, UserCircle, Webhook, Settings } from "lucide-react";
import { SignIn, useUser, useClerk } from "@clerk/clerk-react";
import { AdminToastProvider, useAdminToast } from "./AdminToast";
import AdminDocsReader from "./AdminDocsReader";
import AdminSidebarFlyout from "./AdminSidebarFlyout";

export default function AdminLayout() {
  const isDevHost = window.location.hostname.includes('run.app') || window.location.hostname.includes('localhost');
  const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
  const isDevBypass = !clerkKey || (clerkKey.startsWith('pk_live_') && isDevHost);

  return (
    <AdminToastProvider>
      {isDevBypass ? <BypassLayout /> : <ClerkSecureLayout />}
    </AdminToastProvider>
  );
}

// Komponen Navbar yang sama
function NavContent({ onSignOut }: { onSignOut: () => void }) {
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [lastRepairAt, setLastRepairAt] = useState("");
  const links = [
    { to: "/admin", icon: <LayoutDashboard size={24} />, label: "Dashboard", description: "CRM overview, revenue, and recent activity." },
    { to: "/admin/leads", icon: <Users size={24} />, label: "CRM Leads", description: "Search Google Maps prospects, gather data, score, and generate demos." },
    { to: "/admin/jobs", icon: <ListChecks size={24} />, label: "Generation Jobs", description: "Audit failed, fallback, copy patch, and retry generation jobs." },
    { to: "/admin/sites", icon: <Globe2 size={24} />, label: "Generated Sites", description: "Preview, inspect, regenerate, and compare saved demo sites." },
    { to: "/admin/orders", icon: <FileText size={24} />, label: "Setup Orders", description: "Review checkout orders, payment status, and requested page add/edit notes." },
    { to: "/admin/schema", icon: <Webhook size={24} />, label: "JSON Schema Info", description: "View generator schema and run D1/R2 maintenance actions." },
    { to: "/admin/settings", icon: <Settings size={24} />, label: "Settings", description: "Manage API keys, checkout settings, pricing estimates, and scoring." }
  ];

  useEffect(() => {
    const readRepairAt = () => setLastRepairAt(window.localStorage.getItem("webview.admin.lastDbRepairAt") || "");
    readRepairAt();
    window.addEventListener("storage", readRepairAt);
    window.addEventListener("focus", readRepairAt);
    const interval = window.setInterval(readRepairAt, 3000);
    return () => {
      window.removeEventListener("storage", readRepairAt);
      window.removeEventListener("focus", readRepairAt);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);

  const repairLabel = (() => {
    if (!lastRepairAt) return "";
    const time = new Date(lastRepairAt);
    if (Number.isNaN(time.getTime())) return "";
    const diffMs = Date.now() - time.getTime();
    const minutes = Math.max(0, Math.round(diffMs / 60000));
    if (minutes < 1) return "DB repaired just now";
    if (minutes < 60) return `DB repaired ${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `DB repaired ${hours}h ago`;
    return `DB repaired ${time.toLocaleDateString()}`;
  })();

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden w-full">
      <div className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 gap-6 relative shrink-0">
        {links.map(link => (
          <AdminSidebarFlyout
            key={link.to}
            widthClass="w-64"
            label={link.label}
            description={link.description}
          >
            <Link
              to={link.to}
              className={`p-3 rounded-xl transition-colors ${
                location.pathname === link.to ? 'bg-indigo-50 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'
              }`}
              aria-label={link.label}
            >
              {link.icon}
            </Link>
          </AdminSidebarFlyout>
        ))}

        {repairLabel && (
          <AdminSidebarFlyout label={repairLabel} widthClass="w-auto min-w-max whitespace-nowrap">
            <Link
              to="/admin/schema"
              className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700 hover:bg-emerald-100"
              aria-label={repairLabel}
            >
              DB
            </Link>
          </AdminSidebarFlyout>
        )}

        <AdminSidebarFlyout
          label="Admin docs"
          description="Open route-specific project docs without leaving the admin area."
          widthClass="w-64"
        >
          <AdminDocsReader
            pathname={location.pathname}
            buttonClassName="p-3 rounded-xl transition-colors text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            iconSize={24}
            showTooltip={false}
          />
        </AdminSidebarFlyout>

        <div className="mt-auto mb-6">
          <AdminSidebarFlyout label="Sign Out" widthClass="w-auto min-w-max whitespace-nowrap">
            <button
              onClick={onSignOut}
              className="p-3 rounded-xl transition-colors text-gray-500 hover:bg-red-50 hover:text-red-600"
              aria-label="Sign Out"
            >
              <UserCircle size={24} />
            </button>
          </AdminSidebarFlyout>
        </div>
      </div>
      <div ref={contentRef} className="flex-1 overflow-auto bg-gray-50 h-screen">
        <Outlet />
      </div>
    </div>
  );
}

// Layout khusus jika bypass Clerk Dev
function BypassLayout() {
  const { showToast } = useAdminToast();
  return (
    <div className="relative h-screen w-screen overflow-hidden">
        <div className="absolute top-0 right-0 bg-yellow-500 text-xs px-2 py-1 text-black font-bold z-[10000] rounded-bl-lg shadow-sm">
          DEV BYPASS MODE
        </div>
        <NavContent onSignOut={() => showToast({ kind: "info", title: "Dev bypass mode", message: "Logout is simulated because Clerk auth is bypassed on this host." })} />
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
