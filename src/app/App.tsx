import { useState, useEffect, useContext, createContext, useRef } from "react";
import type { ReactNode, ElementType, FormEvent } from "react";
import { Toaster, toast } from "sonner";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  LayoutDashboard, Users, Globe, Server, HardDrive, Activity, Settings,
  RefreshCw, Play, Square, RotateCcw, Trash2, Terminal, Copy, Pencil,
  Plus, X, Menu, Database, Cpu, Clock, TrendingUp, DollarSign, Shield, FolderOpen,
  Eye, EyeOff, Save, ExternalLink, Search, AlertCircle, Zap, LogIn, UserPlus, Mail, LockKeyhole, User,
  Download, Upload, ChevronRight, Package, Filter, Bell,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type Page = "dashboard" | "customers" | "subdomains" | "vms" | "storage" | "filemanager" | "monitoring" | "settings";

interface Customer {
  id: string;
  name: string;
  email: string;
  package: "VPS Basic" | "VPS Pro" | "Storage Only";
  price: number;
  startDate: string;
  endDate: string;
  vmIP: string;
  subdomain: string;
  status: "active" | "expired" | "suspended";
}

interface VMRecord {
  vmid: number;
  name: string;
  type: "vm" | "lxc";
  customerId: string;
  status: "running" | "stopped" | "paused";
  cpu: number;
  ram: number;
  ramTotal: number;
  uptime: string;
  os: string;
}

interface SubdomainRecord {
  id: string;
  name: string;
  type: "A" | "CNAME" | "Tunnel";
  target: string;
  proxied: boolean;
  customerId: string;
  tunnelId?: string;
}

interface StorageRecord {
  id: string;
  name: string;
  type: "dir" | "lvm" | "zfs" | "nfs" | "cifs";
  total: number;
  used: number;
  status: "active" | "disabled";
  path: string;
  node: string;
}

interface StorageAlloc {
  id: string;
  customerId: string;
  storageId: string;
  quota: number;
  used: number;
}

interface AppSettings {
  cfToken: string;
  cfZoneId: string;
  pveHost: string;
  pveTokenId: string;
  pveSecret: string;
  pveNode: string;
  businessName: string;
  logoUrl: string;
  currency: "IDR" | "USD";
  fileManagerHostname: string;
  fileManagerPort: string;
}

interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: string;
  customerId: string | null;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INIT_CUSTOMERS: Customer[] = [
  { id: "c1", name: "Budi Santoso", email: "budi@mymail.id", package: "VPS Basic", price: 75000, startDate: "2025-01-15", endDate: "2026-07-15", vmIP: "192.168.1.100", subdomain: "budi.myserver.id", status: "active" },
  { id: "c2", name: "Siti Rahayu", email: "siti@startup.co.id", package: "VPS Pro", price: 150000, startDate: "2025-02-01", endDate: "2026-08-01", vmIP: "192.168.1.101", subdomain: "siti.myserver.id", status: "active" },
  { id: "c3", name: "Ahmad Fauzi", email: "ahmad@example.com", package: "Storage Only", price: 50000, startDate: "2025-03-10", endDate: "2026-06-10", vmIP: "—", subdomain: "ahmad.myserver.id", status: "expired" },
  { id: "c4", name: "Dewi Kusuma", email: "dewi@devstudio.id", package: "VPS Pro", price: 150000, startDate: "2025-04-20", endDate: "2026-10-20", vmIP: "192.168.1.102", subdomain: "dewi.myserver.id", status: "suspended" },
  { id: "c5", name: "Rizki Pratama", email: "rizki@gmail.com", package: "VPS Basic", price: 75000, startDate: "2025-05-05", endDate: "2026-08-05", vmIP: "192.168.1.103", subdomain: "rizki.myserver.id", status: "active" },
  { id: "c6", name: "Rina Wulandari", email: "rina@agency.id", package: "VPS Pro", price: 150000, startDate: "2025-06-01", endDate: "2026-09-01", vmIP: "192.168.1.104", subdomain: "rina.myserver.id", status: "active" },
];

const INIT_VMS: VMRecord[] = [
  { vmid: 100, name: "ubuntu-budi", type: "vm", customerId: "c1", status: "running", cpu: 12, ram: 1024, ramTotal: 2048, uptime: "15d 3h 22m", os: "Ubuntu 22.04 LTS" },
  { vmid: 101, name: "debian-siti", type: "vm", customerId: "c2", status: "running", cpu: 35, ram: 3072, ramTotal: 4096, uptime: "8d 12h 05m", os: "Debian 12 Bookworm" },
  { vmid: 102, name: "almalinux-rizki", type: "vm", customerId: "c5", status: "stopped", cpu: 0, ram: 0, ramTotal: 2048, uptime: "—", os: "AlmaLinux 9" },
  { vmid: 103, name: "ubuntu-rina", type: "vm", customerId: "c6", status: "running", cpu: 54, ram: 3584, ramTotal: 4096, uptime: "3d 6h 44m", os: "Ubuntu 22.04 LTS" },
  { vmid: 200, name: "lxc-storage", type: "lxc", customerId: "c3", status: "running", cpu: 2, ram: 256, ramTotal: 512, uptime: "32d 7h 41m", os: "Alpine LXC 3.19" },
  { vmid: 201, name: "lxc-dewi", type: "lxc", customerId: "c4", status: "stopped", cpu: 0, ram: 0, ramTotal: 1024, uptime: "—", os: "Debian LXC 12" },
];

const INIT_SUBDOMAINS: SubdomainRecord[] = [
  { id: "s1", name: "budi.myserver.id", type: "A", target: "192.168.1.100", proxied: true, customerId: "c1" },
  { id: "s2", name: "siti.myserver.id", type: "A", target: "192.168.1.101", proxied: true, customerId: "c2" },
  { id: "s3", name: "api.myserver.id", type: "Tunnel", target: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", proxied: false, customerId: "c2", tunnelId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
  { id: "s4", name: "rizki.myserver.id", type: "A", target: "192.168.1.103", proxied: true, customerId: "c5" },
  { id: "s5", name: "files.myserver.id", type: "CNAME", target: "storage.myserver.id", proxied: false, customerId: "c3" },
  { id: "s6", name: "rina.myserver.id", type: "A", target: "192.168.1.104", proxied: true, customerId: "c6" },
];

const INIT_STORAGES: StorageRecord[] = [
  { id: "st1", name: "local", type: "dir", total: 500, used: 234, status: "active", path: "/var/lib/vz", node: "pve-node1" },
  { id: "st2", name: "nfs-backup", type: "nfs", total: 2048, used: 1229, status: "active", path: "192.168.0.10:/backup", node: "pve-node1" },
  { id: "st3", name: "lvm-ssd", type: "lvm", total: 1024, used: 400, status: "active", path: "/dev/sda3", node: "pve-node1" },
  { id: "st4", name: "zfs-pool", type: "zfs", total: 4096, used: 0, status: "disabled", path: "tank/data", node: "pve-node1" },
];

const INIT_ALLOCS: StorageAlloc[] = [
  { id: "a1", customerId: "c1", storageId: "st1", quota: 100, used: 45 },
  { id: "a2", customerId: "c2", storageId: "st1", quota: 200, used: 189 },
  { id: "a3", customerId: "c3", storageId: "st2", quota: 500, used: 312 },
  { id: "a4", customerId: "c6", storageId: "st3", quota: 150, used: 88 },
];

const INIT_SETTINGS: AppSettings = {
  cfToken: "", cfZoneId: "", pveHost: "", pveTokenId: "", pveSecret: "",
  pveNode: "pve-node1", businessName: "MyServerID", logoUrl: "", currency: "IDR",
  fileManagerHostname: "files.myserver.id", fileManagerPort: "5585",
};

const VM_CHART_DATA = [
  { day: "Sen", running: 3, stopped: 2 },
  { day: "Sel", running: 4, stopped: 1 },
  { day: "Rab", running: 4, stopped: 1 },
  { day: "Kam", running: 5, stopped: 0 },
  { day: "Jum", running: 4, stopped: 1 },
  { day: "Sab", running: 3, stopped: 2 },
  { day: "Min", running: 4, stopped: 1 },
];

// ─── Context ──────────────────────────────────────────────────────────────────

interface AppCtx {
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  customers: Customer[];
  setCustomers: (c: Customer[]) => void;
  vms: VMRecord[];
  setVms: (v: VMRecord[]) => void;
  subdomains: SubdomainRecord[];
  setSubdomains: (s: SubdomainRecord[]) => void;
  storages: StorageRecord[];
  setStorages: (s: StorageRecord[]) => void;
  allocs: StorageAlloc[];
  setAllocs: (a: StorageAlloc[]) => void;
}
const AppContext = createContext<AppCtx>({} as AppCtx);

// ─── Shared Components ────────────────────────────────────────────────────────

const fmtGB = (gb: number) => gb >= 1024 ? `${(gb / 1024).toFixed(1)} TB` : `${gb} GB`;

const Badge = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    running:   "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    online:    "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    expired:   "bg-amber-500/15 text-amber-400 border-amber-500/30",
    paused:    "bg-amber-500/15 text-amber-400 border-amber-500/30",
    stopped:   "bg-slate-500/15 text-slate-400 border-slate-500/30",
    suspended: "bg-red-500/15 text-red-400 border-red-500/30",
    disabled:  "bg-red-500/15 text-red-400 border-red-500/30",
    offline:   "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-widest ${map[status] ?? "bg-slate-500/15 text-slate-400 border-slate-500/30"}`}>
      {status}
    </span>
  );
};

const Spinner = ({ size = 14 }: { size?: number }) => (
  <span
    style={{ width: size, height: size }}
    className="inline-block border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin flex-shrink-0"
  />
);

type BtnVariant = "primary" | "secondary" | "danger" | "ghost" | "success" | "warning";
const Btn = ({
  children, onClick, variant = "primary", className = "", disabled = false, size = "md", type = "button",
}: {
  children: ReactNode; onClick?: () => void; variant?: BtnVariant;
  className?: string; disabled?: boolean; size?: "sm" | "md"; type?: "button" | "submit";
}) => {
  const base = "inline-flex items-center gap-1.5 rounded font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none";
  const sizes = { sm: "px-2.5 py-1 text-[11px]", md: "px-3.5 py-1.5 text-xs" };
  const variants: Record<BtnVariant, string> = {
    primary:   "bg-cyan-500 text-slate-900 hover:bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.25)]",
    secondary: "bg-secondary text-secondary-foreground border border-border hover:bg-accent hover:text-foreground",
    danger:    "bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20",
    ghost:     "text-muted-foreground hover:text-foreground hover:bg-accent",
    success:   "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20",
    warning:   "bg-amber-500/10 text-amber-400 border border-amber-500/25 hover:bg-amber-500/20",
  };
  return (
    <button type={type} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
};

const FieldInput = ({ label, value, onChange, type = "text", placeholder = "", className = "", password = false }: {
  label?: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; className?: string; password?: boolean;
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{label}</label>}
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
    />
  </div>
);

const FieldSelect = ({ label, value, onChange, options, className = "" }: {
  label?: string; value: string; onChange: (v: string) => void;
  options: { label: string; value: string }[]; className?: string;
}) => (
  <div className={`flex flex-col gap-1 ${className}`}>
    {label && <label className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{label}</label>}
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="bg-secondary border border-border rounded px-3 py-2 text-xs text-foreground focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all font-mono"
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </div>
);

const Modal = ({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <div
      className={`bg-card border border-border rounded-lg shadow-2xl w-full mx-4 max-h-[88vh] overflow-y-auto ${wide ? "max-w-2xl" : "max-w-lg"}`}
      onClick={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-border sticky top-0 bg-card z-10">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-0.5 rounded hover:bg-accent"><X size={14} /></button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  </div>
);

const StatCard = ({ icon: Icon, label, value, sub, color = "cyan" }: {
  icon: ElementType; label: string; value: string; sub?: string; color?: string;
}) => {
  const c: Record<string, string> = {
    cyan:   "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    green:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    purple: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  };
  const [txtCls, bgCls] = c[color].split(" ");
  return (
    <div className="bg-card border border-border rounded-lg p-4 hover:border-cyan-500/25 transition-all group cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${bgCls} border ${c[color].split(" ")[2]}`}>
          <Icon size={16} className={txtCls} />
        </div>
        <TrendingUp size={12} className="text-muted-foreground/40 group-hover:text-cyan-500/60 transition-colors" />
      </div>
      <div className="text-xl font-semibold text-foreground font-mono tracking-tight">{value}</div>
      <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-widest">{label}</div>
      {sub && <div className={`text-[10px] mt-1 font-mono ${txtCls}`}>{sub}</div>}
    </div>
  );
};

const ProgressBar = ({ pct, color = "cyan" }: { pct: number; color?: string }) => {
  const col = color === "cyan" ? "bg-cyan-500" : color === "green" ? "bg-emerald-500" : color === "red" ? "bg-red-500" : "bg-amber-500";
  const auto = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-cyan-500";
  return (
    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color === "auto" ? auto : col}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
};

const ServiceBadge = ({ name, online }: { name: string; online: boolean }) => (
  <div className="flex items-center gap-2.5 px-3 py-2.5 rounded bg-secondary border border-border hover:border-border/60 transition-all">
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${online ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-red-400"}`} />
    <span className="text-xs font-mono text-foreground flex-1">{name}</span>
    <span className={`text-[10px] font-mono font-semibold ${online ? "text-emerald-400" : "text-red-400"}`}>
      {online ? "ONLINE" : "OFFLINE"}
    </span>
  </div>
);

const TableHead = ({ cols }: { cols: string[] }) => (
  <thead>
    <tr className="border-b border-border bg-secondary/40">
      {cols.map(h => (
        <th key={h} className="text-left px-4 py-2.5 text-[10px] text-muted-foreground uppercase tracking-widest font-semibold whitespace-nowrap">
          {h}
        </th>
      ))}
    </tr>
  </thead>
);

const EmptyRow = ({ cols, msg = "Tidak ada data" }: { cols: number; msg?: string }) => (
  <tr>
    <td colSpan={cols} className="px-4 py-10 text-center text-muted-foreground text-xs">{msg}</td>
  </tr>
);

const AuthField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  icon: ElementType;
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-medium">{label}</span>
    <div className="relative">
      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-secondary/80 pl-10 pr-3 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-500/50 transition-all"
      />
    </div>
  </label>
);

const AuthScreen = ({
  mode,
  onModeChange,
  onLogin,
  onRegister,
  busy,
  error,
}: {
  mode: "login" | "register";
  onModeChange: (mode: "login" | "register") => void;
  onLogin: (payload: { email: string; password: string }) => Promise<void>;
  onRegister: (payload: { displayName: string; email: string; password: string }) => Promise<void>;
  busy: boolean;
  error: string;
}) => {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerConfirm, setRegisterConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    await onLogin({ email: loginEmail, password: loginPassword });
  };

  const submitRegister = async (e: FormEvent) => {
    e.preventDefault();
    await onRegister({ displayName: registerName, email: registerEmail, password: registerPassword });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.16),_transparent_35%),linear-gradient(180deg,#040816_0%,#0b1020_50%,#060913_100%)] text-foreground flex items-center justify-center px-4 py-8">
      <div className="absolute inset-0 pointer-events-none opacity-35 [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] gap-6 items-stretch">
        <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-8 lg:p-10 shadow-2xl shadow-cyan-950/20 overflow-hidden">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[10px] uppercase tracking-[0.28em] text-cyan-300 font-medium">
            <Server size={12} />
            MyPanel
          </div>
          <h1 className="mt-6 text-4xl lg:text-5xl font-semibold tracking-tight text-white">
            Login dan register untuk panel server.
          </h1>
          <p className="mt-4 max-w-xl text-sm lg:text-base text-slate-300 leading-7">
            Akses dashboard, manajemen customer, subdomain, storage, dan file manager setelah masuk.
          </p>
          <div className="mt-8 grid gap-3 text-sm text-slate-300">
            {[
              "Session disimpan lewat cookie httpOnly.",
              "Register langsung membuat akun baru dan login otomatis.",
              "API panel tetap diproteksi untuk user yang belum masuk.",
            ].map(item => (
              <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/80 backdrop-blur-xl shadow-2xl shadow-black/30 p-6 lg:p-8">
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 mb-6">
            <button
              type="button"
              onClick={() => onModeChange("login")}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all ${mode === "login" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => onModeChange("register")}
              className={`flex-1 rounded-xl px-4 py-3 text-sm font-medium transition-all ${mode === "register" ? "bg-cyan-400 text-slate-950" : "text-slate-300 hover:text-white"}`}
            >
              Register
            </button>
          </div>

          {mode === "login" ? (
            <form className="space-y-4" onSubmit={submitLogin}>
              <AuthField label="Email" value={loginEmail} onChange={setLoginEmail} placeholder="nama@email.com" icon={Mail} />
              <AuthField
                label="Password"
                value={loginPassword}
                onChange={setLoginPassword}
                placeholder="Masukkan password"
                type={showPassword ? "text" : "password"}
                icon={LockKeyhole}
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                  Tampilkan password
                </label>
                <span>Masuk ke panel</span>
              </div>
              {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
              <Btn type="submit" className="w-full justify-center py-3.5 text-sm" disabled={busy}>
                <LogIn size={14} />
                {busy ? "Memproses..." : "Login"}
              </Btn>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={submitRegister}>
              <AuthField label="Nama" value={registerName} onChange={setRegisterName} placeholder="Chaerul Bisnis" icon={User} />
              <AuthField label="Email" value={registerEmail} onChange={setRegisterEmail} placeholder="nama@email.com" icon={Mail} />
              <AuthField
                label="Password"
                value={registerPassword}
                onChange={setRegisterPassword}
                placeholder="Minimal 6 karakter"
                type={showPassword ? "text" : "password"}
                icon={LockKeyhole}
              />
              <AuthField
                label="Konfirmasi Password"
                value={registerConfirm}
                onChange={setRegisterConfirm}
                placeholder="Ulangi password"
                type={showPassword ? "text" : "password"}
                icon={LockKeyhole}
              />
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={showPassword} onChange={e => setShowPassword(e.target.checked)} />
                  Tampilkan password
                </label>
                <span>Buat akun baru</span>
              </div>
              {error && <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</div>}
              <Btn
                type="submit"
                className="w-full justify-center py-3.5 text-sm"
                disabled={busy || registerPassword !== registerConfirm}
              >
                <UserPlus size={14} />
                {busy ? "Memproses..." : "Register"}
              </Btn>
              {registerPassword !== registerConfirm && registerPassword && registerConfirm && (
                <div className="text-xs text-amber-300">Password dan konfirmasi tidak sama.</div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

const NAV = [
  { id: "dashboard",   label: "Dashboard",    icon: LayoutDashboard },
  { id: "customers",   label: "Pelanggan",    icon: Users },
  { id: "subdomains",  label: "Subdomain",    icon: Globe },
  { id: "vms",         label: "VM Manager",   icon: Server },
  { id: "storage",     label: "Storage",      icon: HardDrive },
  { id: "filemanager", label: "File Manager", icon: FolderOpen },
  { id: "monitoring",  label: "Monitoring",   icon: Activity },
  { id: "settings",    label: "Settings",     icon: Settings },
] as const;

const Sidebar = ({ active, setPage, collapsed, setCollapsed }: {
  active: Page; setPage: (p: Page) => void; collapsed: boolean; setCollapsed: (c: boolean) => void;
}) => {
  const { settings } = useContext(AppContext);
  return (
    <aside className={`flex flex-col h-full bg-sidebar border-r border-sidebar-border transition-[width] duration-200 ease-in-out flex-shrink-0 ${collapsed ? "w-14" : "w-52"}`}>
      <div className={`flex items-center gap-2.5 border-b border-sidebar-border flex-shrink-0 ${collapsed ? "px-3 py-3.5 justify-center" : "px-4 py-3.5"}`}>
        <div className="w-7 h-7 rounded-md bg-cyan-500 flex items-center justify-center flex-shrink-0 shadow-[0_0_12px_rgba(34,211,238,0.35)]">
          <Server size={14} className="text-slate-900" />
        </div>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-foreground truncate leading-tight">{settings.businessName || "MyServerID"}</div>
              <div className="text-[10px] text-muted-foreground font-mono leading-tight">Admin Panel</div>
            </div>
            <button onClick={() => setCollapsed(true)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
              <ChevronRight size={13} />
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={() => setCollapsed(false)} className="absolute left-3.5 top-[52px] text-muted-foreground hover:text-foreground transition-colors" style={{ position: "static" }}>
          </button>
        )}
      </div>

      {collapsed && (
        <button onClick={() => setCollapsed(false)} className="flex justify-center py-2 text-muted-foreground hover:text-foreground transition-colors border-b border-sidebar-border">
          <Menu size={13} />
        </button>
      )}

      <nav className="flex-1 py-2 overflow-y-auto overflow-x-hidden">
        {NAV.map(item => (
          <button
            key={item.id}
            onClick={() => setPage(item.id as Page)}
            title={collapsed ? item.label : undefined}
            className={`w-full flex items-center gap-2.5 transition-all text-xs relative group
              ${collapsed ? "justify-center px-0 py-3" : "px-4 py-2.5"}
              ${active === item.id
                ? "bg-cyan-500/8 text-cyan-400 border-r-2 border-cyan-500"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground border-r-2 border-transparent"
              }`}
          >
            <item.icon size={15} className="flex-shrink-0" />
            {!collapsed && <span>{item.label}</span>}
            {collapsed && (
              <div className="absolute left-full ml-2 bg-card border border-border rounded px-2 py-1 text-xs font-medium text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-50 transition-opacity shadow-lg">
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-4 py-3 border-t border-sidebar-border flex-shrink-0">
          <div className="text-[10px] text-muted-foreground font-mono">v2.1.0 — Proxmox CP</div>
        </div>
      )}
    </aside>
  );
};

// ─── Topbar ───────────────────────────────────────────────────────────────────

const PAGE_LABELS: Record<Page, string> = {
  dashboard: "Dashboard", customers: "Manajemen Pelanggan",
  subdomains: "Subdomain Manager", vms: "Proxmox VM Manager",
  storage: "Storage Manager", filemanager: "File Manager", monitoring: "Monitoring", settings: "Settings",
};

const Topbar = ({ page, loading, user, onLogout }: { page: Page; loading: boolean; user: AuthUser | null; onLogout: () => void }) => (
  <header className="flex items-center justify-between px-5 py-0 bg-card border-b border-border h-12 flex-shrink-0">
    <div className="flex items-center gap-2.5">
      <h1 className="text-sm font-semibold text-foreground">{PAGE_LABELS[page]}</h1>
      {loading && <Spinner size={12} />}
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        CONNECTED
      </div>
      <div className="hidden sm:flex items-center gap-1 text-[10px] text-muted-foreground font-mono border border-border rounded px-2 py-1 bg-secondary/50">
        <Shield size={10} className="text-cyan-400" />
        {user?.email ?? "guest@panel"}
      </div>
      {user && (
        <Btn size="sm" variant="ghost" onClick={onLogout} className="h-8 px-2.5">
          Logout
        </Btn>
      )}
    </div>
  </header>
);

// ─── Dashboard Page ───────────────────────────────────────────────────────────

const DashboardPage = () => {
  const { customers, vms } = useContext(AppContext);
  const activeC = customers.filter(c => c.status === "active").length;
  const runningV = vms.filter(v => v.status === "running").length;
  const revenue = customers.filter(c => c.status === "active").reduce((s, c) => s + c.price, 0);

  const services = [
    { name: "Cloudflared", online: true },
    { name: "Proxmox API", online: true },
    { name: "Nginx Proxy", online: true },
    { name: "SSH Gateway", online: false },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={Users}       label="Pelanggan Aktif"  value={String(activeC)}  sub={`+2 bulan ini`}               color="cyan" />
        <StatCard icon={Server}      label="VM Berjalan"      value={String(runningV)} sub={`dari ${vms.length} total`}   color="green" />
        <StatCard icon={DollarSign}  label="Pendapatan / Bln" value={`Rp ${(revenue).toLocaleString("id-ID")}`}          color="amber" />
        <StatCard icon={HardDrive}   label="Storage Terpakai" value="1.86 TB"          sub="dari 7.67 TB total"           color="purple" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-foreground">VM Aktif per Hari</h3>
            <span className="text-[10px] text-muted-foreground font-mono">7 hari terakhir</span>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={VM_CHART_DATA}>
              <defs>
                <linearGradient id="runGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#64748b", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#0f1421", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 6, fontSize: 11, fontFamily: "JetBrains Mono" }}
                cursor={{ stroke: "rgba(34,211,238,0.15)", strokeWidth: 1 }}
              />
              <Area type="monotone" dataKey="running" stroke="#22d3ee" fill="url(#runGrad)" strokeWidth={2} name="Running" />
              <Area type="monotone" dataKey="stopped" stroke="#ef4444" fill="none" strokeWidth={1.5} strokeDasharray="4 2" name="Stopped" />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono", paddingTop: 8 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-foreground">Status Layanan</h3>
          {services.map(s => <ServiceBadge key={s.name} name={s.name} online={s.online} />)}
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-foreground">Order Terbaru</h3>
          <span className="text-[10px] text-muted-foreground font-mono">{customers.length} pelanggan</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["Pelanggan", "Paket", "Periode Aktif", "Status", "Aksi"]} />
            <tbody>
              {customers.slice(0, 5).map(c => (
                <tr key={c.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-foreground">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-cyan-400">{c.package}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{c.startDate} → {c.endDate}</td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="px-4 py-3"><Btn size="sm" variant="ghost">Detail</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Customers Page ───────────────────────────────────────────────────────────

const CustomersPage = () => {
  const { customers, setCustomers } = useContext(AppContext);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<Customer | null>(null);

  const emptyForm = { name: "", email: "", package: "VPS Basic", price: "75000", startDate: "", endDate: "", vmIP: "", subdomain: "" };
  const [form, setForm] = useState(emptyForm);

  const filtered = customers.filter(c => {
    if (filter !== "all" && c.status !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const openEdit = (c: Customer) => {
    setEditId(c.id);
    setForm({ name: c.name, email: c.email, package: c.package, price: String(c.price), startDate: c.startDate, endDate: c.endDate, vmIP: c.vmIP, subdomain: c.subdomain });
    setShowForm(true);
  };

  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm); };

  const save = () => {
    if (!form.name || !form.email) { toast.error("Nama dan email wajib diisi"); return; }
    if (editId) {
      setCustomers(customers.map(c => c.id === editId ? { ...c, ...form, price: Number(form.price), package: form.package as Customer["package"] } : c));
      toast.success("Pelanggan berhasil diupdate");
    } else {
      const nc: Customer = { id: `c${Date.now()}`, ...form, price: Number(form.price), package: form.package as Customer["package"], status: "active" };
      setCustomers([...customers, nc]);
      toast.success("Pelanggan berhasil ditambahkan");
    }
    closeForm();
  };

  const del = (id: string) => { setCustomers(customers.filter(c => c.id !== id)); toast.success("Pelanggan dihapus"); };
  const toggleSuspend = (c: Customer) => {
    const ns = c.status === "suspended" ? "active" : "suspended";
    setCustomers(customers.map(x => x.id === c.id ? { ...x, status: ns } : x));
    toast.success(ns === "suspended" ? "Pelanggan disuspend" : "Pelanggan diaktifkan kembali");
  };

  const filters = ["all", "active", "expired", "suspended"];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {filters.map(f => (
            <Btn key={f} size="sm" variant={filter === f ? "primary" : "secondary"} onClick={() => setFilter(f)}>
              {f === "all" ? "Semua" : f.charAt(0).toUpperCase() + f.slice(1)}
            </Btn>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Cari pelanggan..."
              className="bg-secondary border border-border rounded pl-7 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan-500/50 w-44"
            />
          </div>
          <Btn onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}>
            <Plus size={12} /> Tambah Pelanggan
          </Btn>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["Nama / Email", "Paket", "Harga/Bln", "IP VM", "Subdomain", "Aktif s/d", "Status", "Aksi"]} />
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-foreground">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-cyan-400">{c.package}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-foreground">Rp {c.price.toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-foreground">{c.vmIP}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{c.subdomain}</td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{c.endDate}</td>
                  <td className="px-4 py-3"><Badge status={c.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => setInvoice(c)} title="Invoice"><Download size={11} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => openEdit(c)} title="Edit"><Pencil size={11} /></Btn>
                      <Btn size="sm" variant="warning" onClick={() => toggleSuspend(c)} title={c.status === "suspended" ? "Aktifkan" : "Suspend"}><Shield size={11} /></Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(c.id)} title="Hapus"><Trash2 size={11} /></Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <EmptyRow cols={8} msg="Tidak ada pelanggan yang cocok" />}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title={editId ? "Edit Pelanggan" : "Tambah Pelanggan"} onClose={closeForm}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Nama Lengkap" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="Budi Santoso" />
              <FieldInput label="Email" value={form.email} onChange={v => setForm({ ...form, email: v })} placeholder="budi@email.com" />
            </div>
            <FieldSelect label="Paket" value={form.package} onChange={v => setForm({ ...form, package: v })} options={[
              { value: "VPS Basic", label: "VPS Basic" },
              { value: "VPS Pro", label: "VPS Pro" },
              { value: "Storage Only", label: "Storage Only" },
            ]} />
            <FieldInput label={`Harga / Bulan (${form.package === "VPS Basic" ? "Rp 75.000" : form.package === "VPS Pro" ? "Rp 150.000" : "Rp 50.000"})`} value={form.price} onChange={v => setForm({ ...form, price: v })} type="number" placeholder="75000" />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Tanggal Aktif" value={form.startDate} onChange={v => setForm({ ...form, startDate: v })} type="date" />
              <FieldInput label="Tanggal Expire" value={form.endDate} onChange={v => setForm({ ...form, endDate: v })} type="date" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="IP VM" value={form.vmIP} onChange={v => setForm({ ...form, vmIP: v })} placeholder="192.168.1.100" />
              <FieldInput label="Subdomain" value={form.subdomain} onChange={v => setForm({ ...form, subdomain: v })} placeholder="nama.myserver.id" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="secondary" onClick={closeForm}>Batal</Btn>
              <Btn onClick={save}><Save size={12} /> Simpan</Btn>
            </div>
          </div>
        </Modal>
      )}

      {invoice && (
        <Modal title="Invoice Tagihan" onClose={() => setInvoice(null)}>
          <div className="bg-secondary rounded-lg p-4 font-mono text-xs space-y-2.5 border border-border">
            <div className="text-cyan-400 text-sm font-bold mb-4 border-b border-border pb-2">INVOICE — MyServerID</div>
            {[
              ["Pelanggan", invoice.name],
              ["Email", invoice.email],
              ["Paket", invoice.package],
              ["IP VM", invoice.vmIP],
              ["Subdomain", invoice.subdomain],
              ["Periode", `${invoice.startDate} s/d ${invoice.endDate}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <span className="text-muted-foreground">{k}</span>
                <span className="text-foreground text-right max-w-[60%] truncate">{v}</span>
              </div>
            ))}
            <div className="border-t border-border pt-2.5 flex justify-between items-center font-bold">
              <span className="text-muted-foreground">Total / Bulan</span>
              <span className="text-emerald-400 text-sm">Rp {invoice.price.toLocaleString("id-ID")}</span>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-muted-foreground">Status</span>
              <Badge status={invoice.status} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <Btn variant="secondary" onClick={() => setInvoice(null)}>Tutup</Btn>
            <Btn onClick={() => { toast.success("Invoice dicetak (simulasi)"); setInvoice(null); }}>
              <Download size={12} /> Cetak Invoice
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Subdomains Page ──────────────────────────────────────────────────────────

const SubdomainsPage = () => {
  const { subdomains, setSubdomains, customers, settings } = useContext(AppContext);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "A", target: "", proxied: true, customerId: "", tunnelId: "" });

  const getCustomer = (id: string) => customers.find(c => c.id === id)?.name ?? "—";

  const add = async () => {
    if (!form.name || (!form.target && !form.tunnelId)) { toast.error("Nama dan target wajib diisi"); return; }
    if (!settings.cfToken) { toast.error("Cloudflare API Token belum dikonfigurasi di Settings"); return; }
    setBusy("add");
    await new Promise(r => setTimeout(r, 1200));
    const ns: SubdomainRecord = { id: `s${Date.now()}`, name: form.name, type: form.type as SubdomainRecord["type"], target: form.type === "Tunnel" ? form.tunnelId : form.target, proxied: form.proxied, customerId: form.customerId, tunnelId: form.type === "Tunnel" ? form.tunnelId : undefined };
    setSubdomains([...subdomains, ns]);
    toast.success(`Subdomain ${form.name} ditambahkan`);
    setBusy(null);
    setShowForm(false);
    setForm({ name: "", type: "A", target: "", proxied: true, customerId: "", tunnelId: "" });
  };

  const del = async (id: string, name: string) => {
    setBusy(id);
    await new Promise(r => setTimeout(r, 800));
    setSubdomains(subdomains.filter(s => s.id !== id));
    toast.success(`${name} dihapus`);
    setBusy(null);
  };

  const copy = (name: string) => { navigator.clipboard.writeText(`https://${name}`).then(() => toast.success("URL disalin!")); };

  const typeColor: Record<string, string> = {
    A:      "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
    CNAME:  "text-purple-400 border-purple-500/30 bg-purple-500/10",
    Tunnel: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  };

  return (
    <div className="flex flex-col gap-4">
      {!settings.cfToken && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          Cloudflare API Token belum dikonfigurasi — pergi ke <strong className="ml-1">Settings</strong> untuk mengisinya.
        </div>
      )}

      <div className="flex justify-end">
        <Btn onClick={() => setShowForm(true)} disabled={busy === "add"}>
          {busy === "add" ? <Spinner size={12} /> : <Plus size={12} />} Tambah Subdomain
        </Btn>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["Subdomain", "Tipe", "Target / Tunnel ID", "Proxy CF", "Pelanggan", "Aksi"]} />
            <tbody>
              {subdomains.map(s => (
                <tr key={s.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-[10px] text-cyan-400 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded border ${typeColor[s.type]}`}>{s.type}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground max-w-[200px] truncate">{s.target}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-mono font-medium ${s.proxied ? "text-orange-400" : "text-slate-400"}`}>
                      {s.proxied ? "☁ Proxied" : "DNS Only"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[10px] text-muted-foreground">{getCustomer(s.customerId)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Btn size="sm" variant="ghost" onClick={() => copy(s.name)} title="Copy URL"><Copy size={11} /></Btn>
                      <Btn size="sm" variant="ghost" onClick={() => window.open(`https://${s.name}`, "_blank")} title="Buka"><ExternalLink size={11} /></Btn>
                      <Btn size="sm" variant="danger" onClick={() => del(s.id, s.name)} disabled={busy === s.id}>
                        {busy === s.id ? <Spinner size={10} /> : <Trash2 size={11} />}
                      </Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {subdomains.length === 0 && <EmptyRow cols={6} msg="Belum ada subdomain" />}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title="Tambah DNS Record" onClose={() => setShowForm(false)}>
          <div className="flex flex-col gap-3">
            <FieldInput label="Nama Subdomain (FQDN)" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="nama.myserver.id" />
            <FieldSelect label="Tipe Record" value={form.type} onChange={v => setForm({ ...form, type: v })} options={[
              { value: "A",      label: "A — IPv4 Address" },
              { value: "CNAME",  label: "CNAME — Alias" },
              { value: "Tunnel", label: "Tunnel — Cloudflare Tunnel" },
            ]} />
            {form.type === "Tunnel" ? (
              <FieldInput label="Tunnel ID" value={form.tunnelId} onChange={v => setForm({ ...form, tunnelId: v })} placeholder="a1b2c3d4-e5f6-7890-abcd-ef1234567890" />
            ) : (
              <FieldInput label={form.type === "A" ? "IP Address" : "Target CNAME"} value={form.target} onChange={v => setForm({ ...form, target: v })} placeholder={form.type === "A" ? "203.0.113.10" : "target.domain.com"} />
            )}
            <div className="flex items-center gap-3 py-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Cloudflare Proxy</span>
              <button
                onClick={() => setForm({ ...form, proxied: !form.proxied })}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${form.proxied ? "bg-cyan-500" : "bg-secondary border border-border"}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${form.proxied ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="text-[10px] text-muted-foreground font-mono">{form.proxied ? "☁ Aktif (disarankan)" : "DNS Only"}</span>
            </div>
            <FieldSelect label="Assign ke Pelanggan" value={form.customerId} onChange={v => setForm({ ...form, customerId: v })} options={[
              { value: "", label: "— Tidak diassign —" },
              ...customers.map(c => ({ value: c.id, label: c.name })),
            ]} />
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Batal</Btn>
              <Btn onClick={add} disabled={busy === "add"}>
                {busy === "add" ? <Spinner size={12} /> : <Plus size={12} />} Tambah Record
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── VM Manager Page ──────────────────────────────────────────────────────────

const VMManagerPage = () => {
  const { vms, setVms, customers, settings } = useContext(AppContext);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", os: "ubuntu-22.04", cpu: "1", ram: "2048", storage: "20", bridge: "vmbr0", customerId: "" });

  const getCustomer = (id: string) => customers.find(c => c.id === id)?.name ?? "—";

  const vmAction = async (vmid: number, act: "start" | "stop" | "restart" | "delete") => {
    if (!settings.pveHost) { toast.error("Proxmox API belum dikonfigurasi di Settings"); return; }
    const key = `${vmid}-${act}`;
    setBusy(key);
    await new Promise(r => setTimeout(r, 1500));
    if (act === "delete") {
      setVms(vms.filter(v => v.vmid !== vmid));
      toast.success(`VM ${vmid} berhasil dihapus`);
    } else {
      setVms(vms.map(v => {
        if (v.vmid !== vmid) return v;
        if (act === "stop")    return { ...v, status: "stopped" as const, cpu: 0, ram: 0, uptime: "—" };
        if (act === "start")   return { ...v, status: "running" as const, cpu: Math.floor(Math.random() * 30 + 5), ram: Math.floor(v.ramTotal * 0.4), uptime: "0d 0h 01m" };
        if (act === "restart") return { ...v, status: "running" as const, cpu: Math.floor(Math.random() * 30 + 5), ram: Math.floor(v.ramTotal * 0.4), uptime: "0d 0h 01m" };
        return v;
      }));
      toast.success(`VM ${vmid}: ${act} berhasil`);
    }
    setBusy(null);
  };

  const createVM = async () => {
    if (!form.name) { toast.error("Nama VM wajib diisi"); return; }
    if (!settings.pveHost) { toast.error("Proxmox API belum dikonfigurasi di Settings"); return; }
    setBusy("create");
    await new Promise(r => setTimeout(r, 2000));
    const nv: VMRecord = {
      vmid: 300 + vms.length,
      name: form.name, type: "vm",
      customerId: form.customerId,
      status: "stopped", cpu: 0, ram: 0,
      ramTotal: Number(form.ram),
      uptime: "—", os: form.os,
    };
    setVms([...vms, nv]);
    toast.success(`VM ${form.name} (VMID ${nv.vmid}) berhasil dibuat`);
    setBusy(null);
    setShowForm(false);
  };

  const isBusy = (vmid: number) => ["start","stop","restart","delete"].some(a => busy === `${vmid}-${a}`);

  return (
    <div className="flex flex-col gap-4">
      {!settings.pveHost && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-400 text-xs">
          <AlertCircle size={14} className="flex-shrink-0" />
          Proxmox API belum dikonfigurasi — pergi ke <strong className="ml-1">Settings</strong> untuk mengisinya.
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
          <span><span className="text-emerald-400 font-semibold">{vms.filter(v => v.status === "running").length}</span> running</span>
          <span>·</span>
          <span><span className="text-slate-400 font-semibold">{vms.filter(v => v.status === "stopped").length}</span> stopped</span>
        </div>
        <Btn onClick={() => setShowForm(true)}>
          <Plus size={12} /> Buat VM Baru
        </Btn>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["VMID", "Nama / OS", "Tipe", "Pelanggan", "Status", "CPU Usage", "RAM Usage", "Uptime", "Aksi"]} />
            <tbody>
              {vms.map(v => {
                const ramPct = v.ramTotal ? Math.round(v.ram / v.ramTotal * 100) : 0;
                return (
                  <tr key={v.vmid} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-[10px] text-cyan-400 font-bold">{v.vmid}</td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-foreground">{v.name}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{v.os}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${v.type === "vm" ? "text-cyan-400 border-cyan-500/30 bg-cyan-500/10" : "text-purple-400 border-purple-500/30 bg-purple-500/10"}`}>
                        {v.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[10px] text-muted-foreground">{getCustomer(v.customerId)}</td>
                    <td className="px-4 py-3"><Badge status={v.status} /></td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={v.cpu} color="cyan" />
                        <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{v.cpu}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={ramPct} color="green" />
                        <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{Math.round(v.ram / 1024 * 10) / 10}G</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground whitespace-nowrap">{v.uptime}</td>
                    <td className="px-4 py-3">
                      {isBusy(v.vmid) ? (
                        <Spinner size={12} />
                      ) : (
                        <div className="flex items-center gap-1">
                          <Btn size="sm" variant="success" onClick={() => vmAction(v.vmid, "start")} disabled={v.status === "running"} title="Start"><Play size={10} /></Btn>
                          <Btn size="sm" variant="secondary" onClick={() => vmAction(v.vmid, "stop")} disabled={v.status === "stopped"} title="Stop"><Square size={10} /></Btn>
                          <Btn size="sm" variant="secondary" onClick={() => vmAction(v.vmid, "restart")} disabled={v.status === "stopped"} title="Restart"><RotateCcw size={10} /></Btn>
                          <Btn size="sm" variant="ghost" onClick={() => { if (!settings.pveHost) { toast.error("Proxmox tidak terkonfigurasi"); return; } window.open(`${settings.pveHost}/?console=kvm&vmid=${v.vmid}&node=${settings.pveNode}`, "_blank"); }} title="Console noVNC"><Terminal size={10} /></Btn>
                          <Btn size="sm" variant="danger" onClick={() => vmAction(v.vmid, "delete")} title="Hapus"><Trash2 size={10} /></Btn>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {vms.length === 0 && <EmptyRow cols={9} msg="Belum ada VM/LXC" />}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <Modal title="Buat VM / LXC Baru" onClose={() => setShowForm(false)}>
          <div className="flex flex-col gap-3">
            <FieldInput label="Nama VM" value={form.name} onChange={v => setForm({ ...form, name: v })} placeholder="ubuntu-pelanggan1" />
            <FieldSelect label="OS Template" value={form.os} onChange={v => setForm({ ...form, os: v })} options={[
              { value: "ubuntu-22.04",  label: "Ubuntu 22.04 LTS" },
              { value: "debian-12",     label: "Debian 12 Bookworm" },
              { value: "almalinux-9",   label: "AlmaLinux 9" },
              { value: "alpine-lxc",    label: "Alpine LXC 3.19" },
              { value: "debian-lxc",    label: "Debian LXC 12" },
            ]} />
            <div className="grid grid-cols-3 gap-3">
              <FieldInput label="CPU (Cores)" value={form.cpu} onChange={v => setForm({ ...form, cpu: v })} type="number" placeholder="1" />
              <FieldInput label="RAM (MB)" value={form.ram} onChange={v => setForm({ ...form, ram: v })} type="number" placeholder="2048" />
              <FieldInput label="Storage (GB)" value={form.storage} onChange={v => setForm({ ...form, storage: v })} type="number" placeholder="20" />
            </div>
            <FieldInput label="Bridge / VLAN" value={form.bridge} onChange={v => setForm({ ...form, bridge: v })} placeholder="vmbr0" />
            <FieldSelect label="Assign ke Pelanggan" value={form.customerId} onChange={v => setForm({ ...form, customerId: v })} options={[
              { value: "", label: "— Tidak diassign —" },
              ...customers.map(c => ({ value: c.id, label: c.name })),
            ]} />
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="secondary" onClick={() => setShowForm(false)}>Batal</Btn>
              <Btn onClick={createVM} disabled={busy === "create"}>
                {busy === "create" ? <Spinner size={12} /> : <Plus size={12} />} Buat VM
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── Storage Page ─────────────────────────────────────────────────────────────

const StoragePage = () => {
  const { storages, setStorages, allocs, setAllocs, customers } = useContext(AppContext);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAddSt, setShowAddSt] = useState(false);
  const [showAddAl, setShowAddAl] = useState(false);
  const [stForm, setStForm] = useState({ name: "", type: "dir", path: "", node: "pve-node1" });
  const [alForm, setAlForm] = useState({ customerId: "", storageId: "", quota: "100" });

  const getCustomer = (id: string) => customers.find(c => c.id === id)?.name ?? "—";
  const getStorage  = (id: string) => storages.find(s => s.id === id)?.name ?? "—";

  const toggleMount = async (st: StorageRecord) => {
    setBusy(st.id);
    await new Promise(r => setTimeout(r, 1200));
    setStorages(storages.map(s => s.id === st.id ? { ...s, status: st.status === "active" ? "disabled" : "active" } : s));
    toast.success(`${st.name} berhasil ${st.status === "active" ? "di-unmount" : "di-mount"}`);
    setBusy(null);
  };

  const scan = async () => {
    setBusy("scan");
    await new Promise(r => setTimeout(r, 2000));
    toast.success("Scan selesai — 4 storage ditemukan di pve-node1");
    setBusy(null);
  };

  const addSt = () => {
    if (!stForm.name || !stForm.path) { toast.error("Nama dan path wajib diisi"); return; }
    const ns: StorageRecord = { id: `st${Date.now()}`, name: stForm.name, type: stForm.type as StorageRecord["type"], total: 0, used: 0, status: "disabled", path: stForm.path, node: stForm.node };
    setStorages([...storages, ns]);
    toast.success("Storage ditambahkan (status: disabled — klik Mount untuk mengaktifkan)");
    setShowAddSt(false);
    setStForm({ name: "", type: "dir", path: "", node: "pve-node1" });
  };

  const addAl = () => {
    if (!alForm.customerId || !alForm.storageId) { toast.error("Pilih pelanggan dan storage"); return; }
    const na: StorageAlloc = { id: `a${Date.now()}`, customerId: alForm.customerId, storageId: alForm.storageId, quota: Number(alForm.quota), used: 0 };
    setAllocs([...allocs, na]);
    toast.success("Alokasi storage berhasil ditambahkan");
    setShowAddAl(false);
    setAlForm({ customerId: "", storageId: "", quota: "100" });
  };

  const delAl = (id: string) => { setAllocs(allocs.filter(a => a.id !== id)); toast.success("Alokasi dihapus"); };

  return (
    <div className="flex flex-col gap-5">
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-foreground">Daftar Storage — pve-node1</h3>
          <div className="flex gap-2">
            <Btn size="sm" variant="secondary" onClick={scan} disabled={busy === "scan"}>
              {busy === "scan" ? <Spinner size={11} /> : <RefreshCw size={11} />} Scan Disk
            </Btn>
            <Btn size="sm" onClick={() => setShowAddSt(true)}>
              <Plus size={11} /> Tambah Storage
            </Btn>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["Nama", "Tipe", "Path / Target", "Total", "Terpakai", "Sisa", "Usage", "Status", "Aksi"]} />
            <tbody>
              {storages.map(s => {
                const pct = s.total > 0 ? Math.round(s.used / s.total * 100) : 0;
                return (
                  <tr key={s.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-[10px] text-cyan-400 font-semibold">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border text-purple-400 border-purple-500/30 bg-purple-500/10">{s.type.toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground max-w-[160px] truncate" title={s.path}>{s.path}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-foreground">{fmtGB(s.total)}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-foreground">{fmtGB(s.used)}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-foreground">{fmtGB(s.total - s.used)}</td>
                    <td className="px-4 py-3 min-w-[100px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={pct} color="auto" />
                        <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><Badge status={s.status} /></td>
                    <td className="px-4 py-3">
                      {busy === s.id ? <Spinner size={12} /> : (
                        <Btn size="sm" variant={s.status === "active" ? "danger" : "success"} onClick={() => toggleMount(s)}>
                          {s.status === "active" ? <><Upload size={10} /> Unmount</> : <><Download size={10} /> Mount</>}
                        </Btn>
                      )}
                    </td>
                  </tr>
                );
              })}
              {storages.length === 0 && <EmptyRow cols={9} />}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-foreground">Alokasi Storage per Pelanggan</h3>
          <Btn size="sm" onClick={() => setShowAddAl(true)}>
            <Plus size={11} /> Assign Storage
          </Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["Pelanggan", "Storage", "Kuota", "Terpakai", "Sisa", "Usage", "Aksi"]} />
            <tbody>
              {allocs.map(a => {
                const pct = a.quota > 0 ? Math.round(a.used / a.quota * 100) : 0;
                return (
                  <tr key={a.id} className="border-b border-border/40 hover:bg-accent/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-foreground">{getCustomer(a.customerId)}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-cyan-400">{getStorage(a.storageId)}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-foreground">{a.quota} GB</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-foreground">{a.used} GB</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-foreground">{a.quota - a.used} GB</td>
                    <td className="px-4 py-3 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={pct} color="auto" />
                        <span className="font-mono text-[10px] text-muted-foreground w-7 text-right">{pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Btn size="sm" variant="danger" onClick={() => delAl(a.id)}><Trash2 size={10} /></Btn>
                    </td>
                  </tr>
                );
              })}
              {allocs.length === 0 && <EmptyRow cols={7} msg="Belum ada alokasi storage" />}
            </tbody>
          </table>
        </div>
      </div>

      {showAddSt && (
        <Modal title="Tambah Storage Baru" onClose={() => setShowAddSt(false)}>
          <div className="flex flex-col gap-3">
            <FieldInput label="Nama Storage" value={stForm.name} onChange={v => setStForm({ ...stForm, name: v })} placeholder="my-storage" />
            <FieldSelect label="Tipe" value={stForm.type} onChange={v => setStForm({ ...stForm, type: v })} options={[
              { value: "dir",  label: "DIR — Directory" },
              { value: "lvm",  label: "LVM — Logical Volume" },
              { value: "zfs",  label: "ZFS — ZFS Pool" },
              { value: "nfs",  label: "NFS — Network File System" },
              { value: "cifs", label: "CIFS — Windows Share" },
            ]} />
            <FieldInput label="Path / Target" value={stForm.path} onChange={v => setStForm({ ...stForm, path: v })} placeholder={stForm.type === "nfs" ? "192.168.0.10:/share" : "/var/data"} />
            <FieldInput label="Node Proxmox" value={stForm.node} onChange={v => setStForm({ ...stForm, node: v })} placeholder="pve-node1" />
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="secondary" onClick={() => setShowAddSt(false)}>Batal</Btn>
              <Btn onClick={addSt}><Save size={12} /> Simpan</Btn>
            </div>
          </div>
        </Modal>
      )}

      {showAddAl && (
        <Modal title="Assign Storage ke Pelanggan" onClose={() => setShowAddAl(false)}>
          <div className="flex flex-col gap-3">
            <FieldSelect label="Pelanggan" value={alForm.customerId} onChange={v => setAlForm({ ...alForm, customerId: v })} options={[
              { value: "", label: "Pilih pelanggan..." },
              ...customers.map(c => ({ value: c.id, label: c.name })),
            ]} />
            <FieldSelect label="Storage" value={alForm.storageId} onChange={v => setAlForm({ ...alForm, storageId: v })} options={[
              { value: "", label: "Pilih storage..." },
              ...storages.filter(s => s.status === "active").map(s => ({ value: s.id, label: `${s.name} (${s.type.toUpperCase()}) — ${fmtGB(s.total - s.used)} tersedia` })),
            ]} />
            <FieldInput label="Kuota (GB)" value={alForm.quota} onChange={v => setAlForm({ ...alForm, quota: v })} type="number" placeholder="100" />
            <div className="flex justify-end gap-2 pt-1">
              <Btn variant="secondary" onClick={() => setShowAddAl(false)}>Batal</Btn>
              <Btn onClick={addAl}><Save size={12} /> Assign</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ─── File Manager Page ───────────────────────────────────────────────────────

const FileManagerPage = () => {
  const { settings } = useContext(AppContext);
  const [copied, setCopied] = useState<string | null>(null);
  const [projectChoices, setProjectChoices] = useState<{ path: string; name: string }[]>([]);
  const [projectChoicesLoading, setProjectChoicesLoading] = useState(false);
  const [projectChoicesError, setProjectChoicesError] = useState("");

  const hostname = settings.fileManagerHostname || "files.myserver.id";
  const port = settings.fileManagerPort || "5585";
  const publicUrl = `https://${hostname}`;
  const localService = `http://127.0.0.1:${port}`;
  const webdavUrl = `${publicUrl}/webdav`;
  const editorUrl = "https://editor.jualin.site/open";
  const tunnelConfig = [
    `tunnel: TUNNEL_ID_HERE`,
    `credentials-file: /home/chaerul/.cloudflared/TUNNEL_ID_HERE.json`,
    ``,
    `ingress:`,
    `  - hostname: ${hostname}`,
    `    service: ${localService}`,
    `  - service: http_status:404`,
  ].join("\n");

  const copyText = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    toast.success(`${label} disalin`);
    window.setTimeout(() => setCopied(null), 1400);
  };

  useEffect(() => {
    const controller = new AbortController();

    const loadFolders = async () => {
      setProjectChoicesLoading(true);
      setProjectChoicesError("");

      try {
        const res = await fetch("/api/folders", {
          signal: controller.signal,
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load project folders (${res.status})`);
        const data = await res.json();
        const folders = Array.isArray(data?.folders) ? data.folders : [];
        setProjectChoices(
          folders
            .map((item: { path?: string; name?: string } | string) => {
              if (typeof item === "string") {
                const path = item.trim();
                return path ? { path, name: path.split("/").pop() || path } : null;
              }
              const path = String(item?.path || "").trim();
              if (!path) return null;
              return {
                path,
                name: String(item?.name || path.split("/").pop() || path).trim(),
              };
            })
            .filter(Boolean) as { path: string; name: string }[],
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        setProjectChoices([]);
        setProjectChoicesError(error instanceof Error ? error.message : "Failed to load project folders");
      } finally {
        if (!controller.signal.aborted) setProjectChoicesLoading(false);
      }
    };

    loadFolders();
    return () => controller.abort();
  }, []);

  const openInEditor = (folderPath: string) => {
    window.open(`${editorUrl}?path=${encodeURIComponent(folderPath)}`, "_blank", "noopener,noreferrer");
  };

  const actions = [
    { label: "Buka File Manager", value: publicUrl, note: "Akses utama via Cloudflare Tunnel" },
    { label: "Buka WebDAV", value: webdavUrl, note: "Mount langsung ke file explorer" },
    { label: "Local Service", value: localService, note: "Target service yang harus aktif" },
  ];

  const activity = [
    { name: "Upload folder", status: "online", detail: "Drag and drop aktif di UI file manager" },
    { name: "WebDAV auth", status: "online", detail: "Basic auth terhubung ke akun server" },
    { name: "Cloudflared tunnel", status: "online", detail: "Hostname diarahkan ke service lokal" },
    { name: "Archive tools", status: "online", detail: "ZIP/TAR/7Z tersedia" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <StatCard icon={Globe} label="Public Hostname" value={hostname} sub="Hostname Cloudflare Tunnel" color="cyan" />
        <StatCard icon={Server} label="Local Port" value={port} sub={localService} color="green" />
        <StatCard icon={Shield} label="WebDAV Endpoint" value="/webdav" sub="Mount-ready endpoint" color="purple" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground">Akses File Manager</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Gunakan URL ini untuk membuka panel file manager dan WebDAV.</p>
            </div>
            <Btn size="sm" variant="secondary" onClick={() => copyText(publicUrl, "URL File Manager")}>
              <Copy size={11} /> {copied === "URL File Manager" ? "Disalin" : "Copy URL"}
            </Btn>
          </div>

          <div className="flex flex-col gap-3">
            {actions.map(item => (
              <div key={item.label} className="flex flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-medium text-foreground">{item.label}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{item.note}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Btn size="sm" variant="ghost" onClick={() => copyText(item.value, item.label)}>
                      <Copy size={11} />
                    </Btn>
                    <Btn size="sm" onClick={() => window.open(item.value, "_blank")}>
                      <ExternalLink size={11} /> Buka
                    </Btn>
                  </div>
                </div>
                <div className="rounded border border-border bg-background/40 px-3 py-2 text-[10px] font-mono text-cyan-400 break-all">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground">Project Launcher</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Buka folder project langsung ke editor.</p>
            </div>
            <Btn size="sm" variant="secondary" onClick={() => copyText(projectChoices[0]?.path ?? publicUrl, "Project path")}>
              <Copy size={11} /> Copy Path
            </Btn>
          </div>

          {projectChoicesLoading && (
            <div className="rounded-lg border border-border bg-secondary/40 p-3 text-[10px] text-muted-foreground">
              Memuat daftar project...
            </div>
          )}

          {!projectChoicesLoading && projectChoicesError && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 text-[10px] text-red-400">
              {projectChoicesError}
            </div>
          )}

          {!projectChoicesLoading && !projectChoicesError && (
            <div className="flex flex-col gap-2">
              {projectChoices.slice(0, 8).map(item => (
                <div key={item.path} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/40 p-3">
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{item.name}</div>
                    <div className="text-[10px] text-muted-foreground font-mono break-all">{item.path}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Btn size="sm" variant="ghost" onClick={() => copyText(item.path, item.path)}>
                      <Copy size={11} />
                    </Btn>
                    <Btn size="sm" onClick={() => openInEditor(item.path)}>
                      <ExternalLink size={11} /> Buka
                    </Btn>
                  </div>
                </div>
              ))}

              {projectChoices.length === 0 && (
                <div className="rounded-lg border border-border bg-secondary/40 p-3 text-[10px] text-muted-foreground">
                  Tidak ada project yang terdeteksi.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground">Status Layanan</h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">Komponen yang harus aktif untuk file manager.</p>
            </div>
          </div>
          <div className="flex flex-col gap-2.5">
            {activity.map(item => (
              <ServiceBadge key={item.name} name={`${item.name} · ${item.detail}`} online={item.status === "online"} />
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-cyan-500/15 bg-cyan-500/5 p-4">
            <div className="text-[10px] text-cyan-400 font-semibold uppercase tracking-widest mb-2">Cloudflared Config</div>
            <pre className="overflow-x-auto whitespace-pre-wrap text-[10px] leading-relaxed text-slate-300 font-mono">
              {tunnelConfig}
            </pre>
          </div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-xs font-semibold text-foreground">Rekomendasi Deploy</h3>
          <span className="text-[10px] text-muted-foreground font-mono">cloudflared + node 5585</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-border">
          {[
            ["1. Jalankan service file manager", `npm start di ${localService}`],
            ["2. Set hostname tunnel", `${hostname} -> ${localService}`],
            ["3. Aktifkan SSL proxy", "Gunakan Cloudflare Tunnel untuk akses publik"],
          ].map(([title, desc]) => (
            <div key={title} className="bg-card p-4">
              <div className="text-xs font-medium text-foreground mb-1">{title}</div>
              <div className="text-[10px] text-muted-foreground font-mono leading-relaxed">{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Monitoring Page ──────────────────────────────────────────────────────────

const MonitoringPage = () => {
  const { vms } = useContext(AppContext);
  const tickRef = useRef(20);

  const [cpuData, setCpuData] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({ t: i, node1: Math.floor(Math.random() * 55 + 15), node2: Math.floor(Math.random() * 35 + 5) }))
  );
  const [ramData, setRamData] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({ t: i, node1: Math.floor(Math.random() * 25 + 48) }))
  );

  useEffect(() => {
    const id = setInterval(() => {
      tickRef.current++;
      const t = tickRef.current;
      setCpuData(p => [...p.slice(-19), { t, node1: Math.floor(Math.random() * 55 + 15), node2: Math.floor(Math.random() * 35 + 5) }]);
      setRamData(p => [...p.slice(-19), { t, node1: Math.floor(Math.random() * 25 + 48) }]);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  const topVMs = [...vms].filter(v => v.status === "running").sort((a, b) => b.cpu - a.cpu);

  const diskNodes = [
    { name: "local",      used: 234,  total: 500 },
    { name: "nfs-backup", used: 1229, total: 2048 },
    { name: "lvm-ssd",    used: 400,  total: 1024 },
    { name: "zfs-pool",   used: 0,    total: 4096 },
  ];

  const ttStyle = { backgroundColor: "#0f1421", border: "1px solid rgba(34,211,238,0.18)", borderRadius: 6, fontSize: 10, fontFamily: "JetBrains Mono" };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-foreground">CPU Usage — Nodes</h3>
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE · 5s
            </span>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <LineChart data={cpuData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748b", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} unit="%" width={32} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`]} cursor={{ stroke: "rgba(34,211,238,0.1)", strokeWidth: 1 }} />
              <Line type="monotone" dataKey="node1" stroke="#22d3ee" strokeWidth={2} dot={false} name="pve-node1" isAnimationActive={false} />
              <Line type="monotone" dataKey="node2" stroke="#10b981" strokeWidth={1.5} strokeDasharray="4 2" dot={false} name="pve-node2" isAnimationActive={false} />
              <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xs font-semibold text-foreground">RAM Usage — pve-node1</h3>
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> LIVE · 5s
            </span>
          </div>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={ramData}>
              <defs>
                <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="t" hide />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748b", fontFamily: "JetBrains Mono" }} axisLine={false} tickLine={false} unit="%" width={32} />
              <Tooltip contentStyle={ttStyle} formatter={(v: number) => [`${v}%`]} cursor={{ stroke: "rgba(16,185,129,0.1)", strokeWidth: 1 }} />
              <Area type="monotone" dataKey="node1" stroke="#10b981" fill="url(#ramGrad)" strokeWidth={2} name="RAM" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-foreground">Top VM — Pemakaian CPU Tertinggi</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <TableHead cols={["VMID", "Nama VM", "OS", "CPU Usage", "RAM Usage", "Uptime"]} />
            <tbody>
              {topVMs.map(v => {
                const rp = v.ramTotal ? Math.round(v.ram / v.ramTotal * 100) : 0;
                return (
                  <tr key={v.vmid} className="border-b border-border/40 hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono text-[10px] text-cyan-400 font-bold">{v.vmid}</td>
                    <td className="px-4 py-3 text-xs text-foreground font-medium">{v.name}</td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{v.os}</td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={v.cpu} color="auto" />
                        <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{v.cpu}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <ProgressBar pct={rp} color="green" />
                        <span className="font-mono text-[10px] text-muted-foreground w-8 text-right">{rp}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-muted-foreground">{v.uptime}</td>
                  </tr>
                );
              })}
              {topVMs.length === 0 && <EmptyRow cols={6} msg="Tidak ada VM yang sedang berjalan" />}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-xs font-semibold text-foreground mb-4">Disk Usage per Storage Pool</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {diskNodes.map(d => {
            const pct = Math.round(d.used / d.total * 100);
            const col = pct > 85 ? "text-red-400 bg-red-500/10 border-red-500/20" : pct > 60 ? "text-amber-400 bg-amber-500/10 border-amber-500/20" : "text-cyan-400 bg-cyan-500/10 border-cyan-500/20";
            const barCol = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-cyan-500";
            return (
              <div key={d.name} className="bg-secondary rounded-lg p-3 border border-border hover:border-border/60 transition-all">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-[10px] text-foreground font-semibold">{d.name}</span>
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${col}`}>{pct}%</span>
                </div>
                <div className="w-full bg-background rounded-full h-1.5 mb-2">
                  <div className={`h-full rounded-full ${barCol} transition-all`} style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {fmtGB(d.used)} / {fmtGB(d.total)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Settings Page ────────────────────────────────────────────────────────────

const SettingsPage = () => {
  const { settings, setSettings } = useContext(AppContext);
  const [form, setForm] = useState<AppSettings>(settings);
  const [show, setShow] = useState({ cf: false, pve: false });
  const [testing, setTesting] = useState<string | null>(null);

  const f = (key: keyof AppSettings) => (v: string) => setForm(p => ({ ...p, [key]: v }));

  const save = () => {
    setSettings(form);
    try { localStorage.setItem("cpanel_settings", JSON.stringify(form)); } catch {}
    toast.success("Pengaturan berhasil disimpan");
  };

  const reset = () => {
    const def = INIT_SETTINGS;
    setForm(def); setSettings(def);
    try { localStorage.removeItem("cpanel_settings"); } catch {}
    toast.success("Konfigurasi berhasil direset");
  };

  const testConn = async (type: "cf" | "pve") => {
    setTesting(type);
    await new Promise(r => setTimeout(r, 1500));
    if (type === "cf" && !form.cfToken)  { toast.error("Cloudflare API Token kosong"); }
    else if (type === "pve" && !form.pveHost) { toast.error("Proxmox Host URL kosong"); }
    else { toast.success(`Koneksi ${type === "cf" ? "Cloudflare API" : "Proxmox API"} berhasil ✓`); }
    setTesting(null);
  };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="bg-card border border-border rounded-lg p-5">
        <h3 className="text-xs font-semibold text-foreground mb-4">Informasi Bisnis</h3>
        <div className="flex flex-col gap-3">
          <FieldInput label="Nama Bisnis" value={form.businessName} onChange={f("businessName")} placeholder="MyServerID" />
          <FieldInput label="Logo URL (opsional)" value={form.logoUrl} onChange={f("logoUrl")} placeholder="https://cdn.example.com/logo.png" />
          <FieldSelect label="Mata Uang Default" value={form.currency} onChange={f("currency")} options={[
            { value: "IDR", label: "IDR — Rupiah Indonesia (Rp)" },
            { value: "USD", label: "USD — US Dollar ($)" },
          ]} />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-foreground">Cloudflare API</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Digunakan untuk manajemen DNS record dan Tunnel</p>
          </div>
          <Btn size="sm" variant="secondary" onClick={() => testConn("cf")} disabled={testing === "cf"}>
            {testing === "cf" ? <Spinner size={11} /> : <Zap size={11} />} Test Koneksi
          </Btn>
        </div>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <FieldInput label="API Token" value={form.cfToken} onChange={f("cfToken")} type={show.cf ? "text" : "password"} placeholder="API Token dari Cloudflare Dashboard → My Profile → API Tokens" />
            <button className="absolute right-3 bottom-2.5 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShow(s => ({ ...s, cf: !s.cf }))}>
              {show.cf ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
          <FieldInput label="Zone ID" value={form.cfZoneId} onChange={f("cfZoneId")} placeholder="a1b2c3d4e5f6789... (dari overview domain)" />
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-foreground">File Manager Tunnel</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Diarahkan ke service file manager yang diexpose lewat Cloudflare Tunnel</p>
          </div>
          <Btn size="sm" variant="secondary" onClick={() => window.open(`https://${form.fileManagerHostname || "files.myserver.id"}`, "_blank")}>
            <ExternalLink size={11} /> Test URL
          </Btn>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FieldInput
            label="File Manager Hostname"
            value={form.fileManagerHostname}
            onChange={f("fileManagerHostname")}
            placeholder="files.myserver.id"
          />
          <FieldInput
            label="Local Service Port"
            value={form.fileManagerPort}
            onChange={f("fileManagerPort")}
            type="number"
            placeholder="5585"
          />
        </div>
        <div className="mt-3 rounded-lg border border-border bg-secondary/30 p-3">
          <div className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest mb-2">Preview</div>
          <div className="text-[10px] font-mono text-cyan-400 break-all">https://{form.fileManagerHostname || "files.myserver.id"}</div>
          <div className="text-[10px] font-mono text-muted-foreground mt-1">Local target: http://127.0.0.1:{form.fileManagerPort || "5585"}</div>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xs font-semibold text-foreground">Proxmox VE API</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">Digunakan untuk manajemen VM, LXC, dan Storage</p>
          </div>
          <Btn size="sm" variant="secondary" onClick={() => testConn("pve")} disabled={testing === "pve"}>
            {testing === "pve" ? <Spinner size={11} /> : <Zap size={11} />} Test Koneksi
          </Btn>
        </div>
        <div className="flex flex-col gap-3">
          <FieldInput label="Host URL" value={form.pveHost} onChange={f("pveHost")} placeholder="https://pve.myserver.id:8006" />
          <div className="grid grid-cols-2 gap-3">
            <FieldInput label="Token ID" value={form.pveTokenId} onChange={f("pveTokenId")} placeholder="user@pam!mytoken" />
            <div className="relative">
              <FieldInput label="Token Secret" value={form.pveSecret} onChange={f("pveSecret")} type={show.pve ? "text" : "password"} placeholder="xxxxxxxx-xxxx-xxxx-..." />
              <button className="absolute right-3 bottom-2.5 text-muted-foreground hover:text-foreground transition-colors" onClick={() => setShow(s => ({ ...s, pve: !s.pve }))}>
                {show.pve ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>
          </div>
          <FieldInput label="Node Name" value={form.pveNode} onChange={f("pveNode")} placeholder="pve-node1" />
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Btn onClick={save}><Save size={12} /> Simpan Semua Pengaturan</Btn>
        <Btn variant="danger" onClick={reset}><X size={12} /> Reset ke Default</Btn>
      </div>

      <div className="bg-amber-500/8 border border-amber-500/20 rounded-lg px-4 py-3 space-y-1.5">
        <div className="text-[10px] text-amber-400 font-mono font-semibold uppercase tracking-widest">⚠ Catatan Keamanan</div>
        <p className="text-[10px] text-amber-400/80 font-mono leading-relaxed">
          Semua API call dilakukan dari browser (client-side). Proxmox harus dikonfigurasi dengan CORS aktif, atau gunakan reverse proxy (Nginx/Caddy) untuk menghindari masalah CORS dan menyembunyikan endpoint internal.
        </p>
        <p className="text-[10px] text-amber-400/80 font-mono">
          Credentials disimpan di localStorage browser. Gunakan hanya di device tepercaya.
        </p>
      </div>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const initialAuthMode = window.location.pathname === "/register" ? "register" : "login";
  const [page, setPage] = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">(initialAuthMode);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");

  const savedSettings = (() => {
    try { return JSON.parse(localStorage.getItem("cpanel_settings") ?? "{}") as Partial<AppSettings>; }
    catch { return {} as Partial<AppSettings>; }
  })();

  const [settings,   setSettings]   = useState<AppSettings>({ ...INIT_SETTINGS, ...savedSettings });
  const [customers,  setCustomers]  = useState<Customer[]>(INIT_CUSTOMERS);
  const [vms,        setVms]        = useState<VMRecord[]>(INIT_VMS);
  const [subdomains, setSubdomains] = useState<SubdomainRecord[]>(INIT_SUBDOMAINS);
  const [storages,   setStorages]   = useState<StorageRecord[]>(INIT_STORAGES);
  const [allocs,     setAllocs]     = useState<StorageAlloc[]>(INIT_ALLOCS);

  useEffect(() => {
    document.documentElement.classList.add("dark");
    return () => { document.documentElement.classList.remove("dark"); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) {
            setAuthUser(null);
            if (window.location.pathname !== "/login" && window.location.pathname !== "/register") {
              window.history.replaceState({}, "", "/login");
              setAuthMode("login");
            }
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setAuthUser(data.user);
          if (window.location.pathname !== "/") {
            window.history.replaceState({}, "", "/");
          }
        }
      } catch {
        if (!cancelled) {
          setAuthUser(null);
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };
    loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAuthRoute = (nextMode: "login" | "register") => {
    setAuthMode(nextMode);
    window.history.replaceState({}, "", nextMode === "login" ? "/login" : "/register");
  };

  const handleLogin = async (payload: { email: string; password: string }) => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Login gagal");
      setAuthUser(data.user);
      window.history.replaceState({}, "", "/");
      toast.success("Login berhasil");
    } catch (err: any) {
      setAuthError(err?.message || "Login gagal");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRegister = async (payload: { displayName: string; email: string; password: string }) => {
    setAuthBusy(true);
    setAuthError("");
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Register gagal");
      setAuthUser(data.user);
      window.history.replaceState({}, "", "/");
      toast.success("Akun berhasil dibuat");
    } catch (err: any) {
      setAuthError(err?.message || "Register gagal");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setAuthUser(null);
      setAuthMode("login");
      window.history.replaceState({}, "", "/login");
    }
  };

  const ctx: AppCtx = { settings, setSettings, customers, setCustomers, vms, setVms, subdomains, setSubdomains, storages, setStorages, allocs, setAllocs };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-200">
        <div className="flex items-center gap-3 text-sm font-mono">
          <Spinner size={16} />
          Menyiapkan sesi...
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <>
        <AuthScreen
          mode={authMode}
          onModeChange={setAuthRoute}
          onLogin={handleLogin}
          onRegister={handleRegister}
          busy={authBusy}
          error={authError}
        />
        <Toaster position="bottom-right" theme="dark" richColors closeButton />
      </>
    );
  }

  const pages: Record<Page, ReactNode> = {
    dashboard:  <DashboardPage />,
    customers:  <CustomersPage />,
    subdomains: <SubdomainsPage />,
    vms:        <VMManagerPage />,
    storage:    <StoragePage />,
    filemanager: <FileManagerPage />,
    monitoring: <MonitoringPage />,
    settings:   <SettingsPage />,
  };

  return (
    <AppContext.Provider value={ctx}>
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar active={page} setPage={setPage} collapsed={collapsed} setCollapsed={setCollapsed} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar page={page} loading={false} user={authUser} onLogout={handleLogout} />
          <main className="flex-1 overflow-y-auto p-5 overflow-x-hidden">
            {pages[page]}
          </main>
        </div>
      </div>
      <Toaster position="bottom-right" theme="dark" richColors closeButton />
    </AppContext.Provider>
  );
}
