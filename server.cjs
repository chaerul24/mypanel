const http = require("http")
const https = require("https")
const fs = require("fs")
const path = require("path")
const os = require("os")
const crypto = require("crypto")
const { URL } = require("url")
const { execFile } = require("child_process")
const { promisify } = require("util")
const mysql = require("mysql2/promise")

const execFileAsync = promisify(execFile)

const ROOT = __dirname
const DIST = path.join(ROOT, "dist")
const PORT = Number(process.env.PORT || 5591)
const DB_NAME = process.env.MYSQL_DATABASE || "mypanel_db"
const DB_SOCKET = process.env.MYSQL_SOCKET_PATH || "/run/mysqld/mysqld.sock"
const DB_USER = process.env.MYSQL_USER || "root"
const DB_PASSWORD = process.env.MYSQL_PASSWORD || ""
const AUTH_COOKIE = "mypanel_session"
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const DEFAULT_ADMIN_EMAIL = "chaerulbisnis17@gmail.com"
const DEFAULT_ADMIN_PASSWORD = "Wanatawang#30"
const ALLOWED_CORS_ORIGINS = new Set([
  "https://editor.jualin.site",
  "http://editor.jualin.site",
  "http://localhost:4173",
  "http://localhost:4174",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:4174",
])
const PM2_OUT_LOG = path.join(os.homedir(), ".pm2", "logs", "mypanel-out.log")
const PM2_ERR_LOG = path.join(os.homedir(), ".pm2", "logs", "mypanel-error.log")
const PROJECT_SCAN_ROOTS = [
  path.resolve(ROOT, ".."),
  path.resolve(ROOT, "../..", "users"),
]
const PROJECT_MARKER_FILES = new Set([
  "package.json",
  "pnpm-workspace.yaml",
  "vite.config.ts",
  "vite.config.js",
  "vite.config.mjs",
  "index.html",
  "README.md",
  "pubspec.yaml",
  "composer.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "requirements.txt",
])

const DEFAULT_STATE = {
  settings: {
    cfToken: "",
    cfZoneId: "",
    pveHost: "https://127.0.0.1:8006",
    pveTokenId: "",
    pveSecret: "",
    pveNode: "mail",
    businessName: "MyServerID",
    logoUrl: "",
    currency: "IDR",
  },
  customers: [
    { id: "c1", name: "Budi Santoso", email: "budi@mymail.id", package: "VPS Basic", price: 75000, startDate: "2025-01-15", endDate: "2026-07-15", vmIP: "192.168.1.100", subdomain: "budi.myserver.id", status: "active" },
    { id: "c2", name: "Siti Rahayu", email: "siti@startup.co.id", package: "VPS Pro", price: 150000, startDate: "2025-02-01", endDate: "2026-08-01", vmIP: "192.168.1.101", subdomain: "siti.myserver.id", status: "active" },
    { id: "c3", name: "Ahmad Fauzi", email: "ahmad@example.com", package: "Storage Only", price: 50000, startDate: "2025-03-10", endDate: "2026-06-10", vmIP: "—", subdomain: "ahmad.myserver.id", status: "expired" },
    { id: "c4", name: "Dewi Kusuma", email: "dewi@devstudio.id", package: "VPS Pro", price: 150000, startDate: "2025-04-20", endDate: "2026-10-20", vmIP: "192.168.1.102", subdomain: "dewi.myserver.id", status: "suspended" },
    { id: "c5", name: "Rizki Pratama", email: "rizki@gmail.com", package: "VPS Basic", price: 75000, startDate: "2025-05-05", endDate: "2026-08-05", vmIP: "192.168.1.103", subdomain: "rizki.myserver.id", status: "active" },
    { id: "c6", name: "Rina Wulandari", email: "rina@agency.id", package: "VPS Pro", price: 150000, startDate: "2025-06-01", endDate: "2026-09-01", vmIP: "192.168.1.104", subdomain: "rina.myserver.id", status: "active" },
  ],
  subdomains: [
    { id: "s1", name: "budi.myserver.id", type: "A", target: "192.168.1.100", proxied: true, customerId: "c1" },
    { id: "s2", name: "siti.myserver.id", type: "A", target: "192.168.1.101", proxied: true, customerId: "c2" },
    { id: "s3", name: "api.myserver.id", type: "Tunnel", target: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", proxied: false, customerId: "c2", tunnelId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
    { id: "s4", name: "rizki.myserver.id", type: "A", target: "192.168.1.103", proxied: true, customerId: "c5" },
    { id: "s5", name: "files.myserver.id", type: "CNAME", target: "storage.myserver.id", proxied: false, customerId: "c3" },
    { id: "s6", name: "rina.myserver.id", type: "A", target: "192.168.1.104", proxied: true, customerId: "c6" },
  ],
  allocs: [
    { id: "a1", customerId: "c1", storageId: "st1", quota: 100, used: 45 },
    { id: "a2", customerId: "c2", storageId: "st1", quota: 200, used: 189 },
    { id: "a3", customerId: "c3", storageId: "st2", quota: 500, used: 312 },
    { id: "a4", customerId: "c6", storageId: "st3", quota: 150, used: 88 },
  ],
}

let dbPool = null
let runtimeState = DEFAULT_STATE
let runtimeSettings = runtimeState.settings
let stateLoaded = false

function rowToCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    package: row.package,
    price: Number(row.price),
    startDate: row.startDate,
    endDate: row.endDate,
    vmIP: row.vmIP,
    subdomain: row.subdomain,
    status: row.status,
    hasPassword: Boolean(row.hasPassword),
  }
}

function rowToSubdomain(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    target: row.target,
    proxied: Boolean(row.proxied),
    customerId: row.customerId || "",
    tunnelId: row.tunnelId || undefined,
    cfRecordId: row.cfRecordId || undefined,
  }
}

function rowToAlloc(row) {
  return {
    id: row.id,
    customerId: row.customerId,
    storageId: row.storageId,
    quota: Number(row.quota),
    used: Number(row.used),
  }
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex")
  return `scrypt$1$${salt}$${derived}`
}

function verifyPassword(password, stored) {
  const parts = String(stored || "").split("$")
  if (parts.length !== 4 || parts[0] !== "scrypt") return false
  const [, , salt, hash] = parts
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex")
  const a = Buffer.from(hash, "hex")
  const b = Buffer.from(derived, "hex")
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex")
}

function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const idx = part.indexOf("=")
    if (idx === -1) return acc
    const key = part.slice(0, idx).trim()
    const value = part.slice(idx + 1).trim()
    if (key) acc[key] = decodeURIComponent(value)
    return acc
  }, {})
}

function getCookieOptions(req, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase()
  const isSecure = forwardedProto === "https" || req.socket?.encrypted
  const parts = [
    `${AUTH_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ]
  if (isSecure) parts.push("Secure")
  return parts
}

function authCookieHeader(req, token, maxAgeSeconds = Math.floor(SESSION_TTL_MS / 1000)) {
  const parts = [
    `${AUTH_COOKIE}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ]
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase()
  if (forwardedProto === "https" || req.socket?.encrypted) parts.push("Secure")
  return parts.join("; ")
}

function clearAuthCookieHeader(req) {
  const parts = [
    `${AUTH_COOKIE}=`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    "Max-Age=0",
  ]
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase()
  if (forwardedProto === "https" || req.socket?.encrypted) parts.push("Secure")
  return parts.join("; ")
}

function corsHeaders(req) {
  const origin = String(req.headers.origin || "")
  if (!ALLOWED_CORS_ORIGINS.has(origin)) return {}
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  }
}

async function ensureAdminAccount() {
  const passwordHash = hashPassword(DEFAULT_ADMIN_PASSWORD)
  await dbPool.query(
    `INSERT INTO panel_users (id, email, display_name, password_hash, role, customer_id)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name),
       password_hash = VALUES(password_hash),
       role = VALUES(role)`,
    ["u-admin", DEFAULT_ADMIN_EMAIL, "Chaerul Bisnis", passwordHash, "admin"],
  )
}

async function getSessionUser(req) {
  await initDatabase()
  const cookies = parseCookies(req.headers.cookie || "")
  const token = cookies[AUTH_COOKIE]
  if (!token) return null
  const tokenHash = hashToken(token)
  const [rows] = await dbPool.query(
    `SELECT u.id, u.email, u.display_name, u.role, u.customer_id
     FROM auth_sessions s
     INNER JOIN panel_users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [tokenHash],
  )
  if (!rows.length) {
    await dbPool.query("DELETE FROM auth_sessions WHERE token_hash = ?", [tokenHash]).catch(() => {})
    return null
  }
  return rows[0]
}

async function createSession(userId) {
  await initDatabase()
  const token = crypto.randomBytes(32).toString("hex")
  const tokenHash = hashToken(token)
  await dbPool.query(
    `INSERT INTO auth_sessions (token_hash, user_id, expires_at, last_seen_at)
     VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? SECOND), NOW())
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), expires_at = VALUES(expires_at), last_seen_at = NOW()`,
    [tokenHash, userId, Math.floor(SESSION_TTL_MS / 1000)],
  )
  return token
}

async function deleteSession(token) {
  if (!token) return
  await initDatabase()
  await dbPool.query("DELETE FROM auth_sessions WHERE token_hash = ?", [hashToken(token)])
}

async function ensureStateLoaded() {
  if (!stateLoaded) {
    runtimeState = await loadStateFromDb()
    runtimeSettings = runtimeState.settings
    stateLoaded = true
  }
}

async function cloudflareRequest(settings, method, endpoint, body = null) {
  if (!settings?.cfToken || !settings?.cfZoneId) {
    throw new Error("Cloudflare API Token atau Zone ID belum dikonfigurasi")
  }
  const response = await fetch(`https://api.cloudflare.com/client/v4${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${settings.cfToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok || payload?.success === false) {
    const message = payload?.errors?.[0]?.message || payload?.messages?.[0]?.message || response.statusText || "Cloudflare request failed"
    throw new Error(message)
  }
  return payload
}

async function cloudflareCreateDnsRecord(settings, record) {
  const payload = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: 1,
    proxied: Boolean(record.proxied),
  }
  const response = await cloudflareRequest(settings, "POST", `/zones/${settings.cfZoneId}/dns_records`, payload)
  return response.result
}

async function cloudflareUpdateDnsRecord(settings, recordId, record) {
  if (!recordId) throw new Error("Cloudflare record ID tidak ditemukan")
  const payload = {
    type: record.type,
    name: record.name,
    content: record.content,
    ttl: 1,
    proxied: Boolean(record.proxied),
  }
  const response = await cloudflareRequest(settings, "PUT", `/zones/${settings.cfZoneId}/dns_records/${recordId}`, payload)
  return response.result
}

async function cloudflareDeleteDnsRecord(settings, recordId) {
  if (!recordId) return
  await cloudflareRequest(settings, "DELETE", `/zones/${settings.cfZoneId}/dns_records/${recordId}`)
}

async function cloudflareFindDnsRecord(settings, name, type = null) {
  const query = new URLSearchParams({ name, per_page: "100" })
  if (type) query.set("type", type)
  const response = await cloudflareRequest(settings, "GET", `/zones/${settings.cfZoneId}/dns_records?${query.toString()}`)
  return Array.isArray(response?.result) ? response.result[0] || null : null
}

async function cloudflareListDnsRecords(settings) {
  if (!settings?.cfToken || !settings?.cfZoneId) {
    return []
  }
  let page = 1
  const records = []
  while (page <= 10) {
    const query = new URLSearchParams({ per_page: "100", page: String(page) })
    const response = await cloudflareRequest(settings, "GET", `/zones/${settings.cfZoneId}/dns_records?${query.toString()}`)
    const batch = Array.isArray(response?.result) ? response.result : []
    records.push(...batch)
    if (!response?.result_info || page >= Number(response.result_info.total_pages || 1) || batch.length === 0) break
    page += 1
  }
  return records
}

function mapCloudflareSubdomain(record, customers = [], localMeta = []) {
  const name = String(record?.name || "").toLowerCase()
  const local = localMeta.find(item => String(item.name || "").toLowerCase() === name || String(item.cfRecordId || "") === String(record.id))
  const customer = customers.find(item => String(item.subdomain || "").toLowerCase() === name)
  const isTunnel = record.type === "CNAME" && /cfargotunnel\.com$/i.test(String(record.content || ""))
  return {
    id: String(record.id),
    name,
    type: isTunnel ? "Tunnel" : record.type,
    target: isTunnel ? String(record.content || "").replace(/\.cfargotunnel\.com$/i, "") : String(record.content || ""),
    proxied: Boolean(record.proxied),
    customerId: local?.customerId || customer?.id || "",
    tunnelId: isTunnel ? String(record.content || "").replace(/\.cfargotunnel\.com$/i, "") : (local?.tunnelId || undefined),
    cfRecordId: String(record.id),
  }
}

async function initDatabase() {
  if (dbPool) return dbPool
  const admin = await mysql.createConnection({
    user: DB_USER,
    password: DB_PASSWORD,
    socketPath: DB_SOCKET,
  })
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
  await admin.end()

  dbPool = mysql.createPool({
    user: DB_USER,
    password: DB_PASSWORD,
    socketPath: DB_SOCKET,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 5,
  })

  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      id TINYINT PRIMARY KEY,
      payload LONGTEXT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS customers (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      package VARCHAR(32) NOT NULL,
      price INT NOT NULL,
      startDate VARCHAR(32) NOT NULL,
      endDate VARCHAR(32) NOT NULL,
      vmIP VARCHAR(64) NOT NULL,
      subdomain VARCHAR(255) NOT NULL,
      status VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS subdomains (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(16) NOT NULL,
      target VARCHAR(255) NOT NULL,
      proxied TINYINT(1) NOT NULL DEFAULT 1,
      customerId VARCHAR(64) NOT NULL DEFAULT '',
      tunnelId VARCHAR(255) NULL,
      cfRecordId VARCHAR(255) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await dbPool.query("ALTER TABLE subdomains ADD COLUMN cfRecordId VARCHAR(255) NULL").catch(() => {})
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS allocs (
      id VARCHAR(64) PRIMARY KEY,
      customerId VARCHAR(64) NOT NULL,
      storageId VARCHAR(64) NOT NULL,
      quota INT NOT NULL,
      used INT NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS panel_users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL UNIQUE,
      display_name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(32) NOT NULL DEFAULT 'admin',
      customer_id VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await dbPool.query("ALTER TABLE panel_users ADD COLUMN customer_id VARCHAR(64) NULL").catch(() => {})
  await dbPool.query("ALTER TABLE panel_users ADD UNIQUE KEY uniq_panel_users_customer_id (customer_id)").catch(() => {})
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  await dbPool.query(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      kind VARCHAR(64) NOT NULL,
      message TEXT NOT NULL,
      meta LONGTEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  const [[settingsCount]] = await dbPool.query("SELECT COUNT(*) AS count FROM app_settings")
  const [[customersCount]] = await dbPool.query("SELECT COUNT(*) AS count FROM customers")
  const [[subdomainsCount]] = await dbPool.query("SELECT COUNT(*) AS count FROM subdomains")
  const [[allocsCount]] = await dbPool.query("SELECT COUNT(*) AS count FROM allocs")
  await ensureAdminAccount()
  const [[activityCount]] = await dbPool.query("SELECT COUNT(*) AS count FROM activity_logs")
  if (!Number(customersCount.count) && !Number(subdomainsCount.count)) {
    await saveStateToDb({
      settings: { ...DEFAULT_STATE.settings, ...(await loadStateFromDb()).settings },
      customers: DEFAULT_STATE.customers,
      subdomains: DEFAULT_STATE.subdomains,
      allocs: Number(allocsCount.count) ? (await loadStateFromDb()).allocs : DEFAULT_STATE.allocs,
    })
    await logActivity("seed", "Data demo users dan subdomain dipulihkan")
  } else if (!Number(settingsCount.count) && !Number(customersCount.count) && !Number(subdomainsCount.count) && !Number(allocsCount.count)) {
    await saveStateToDb(DEFAULT_STATE)
    await logActivity("seed", "Database panel diinisialisasi dengan data awal")
  }
  if (!Number(activityCount.count)) {
    await logActivity("boot", "Panel dijalankan dan koneksi database aktif")
  }

  return dbPool
}

async function logActivity(kind, message, meta = null) {
  await initDatabase()
  await dbPool.query(
    "INSERT INTO activity_logs (kind, message, meta) VALUES (?, ?, ?)",
    [kind, message, meta ? JSON.stringify(meta) : null],
  )
}

async function loadStateFromDb() {
  await initDatabase()
  const [settingsRows] = await dbPool.query("SELECT payload FROM app_settings WHERE id = 1 LIMIT 1")
  let settings = { ...DEFAULT_STATE.settings }
  if (settingsRows.length) {
    try {
      settings = { ...settings, ...JSON.parse(settingsRows[0].payload) }
    } catch {
      settings = { ...settings }
    }
  }

  const [customerRows] = await dbPool.query(`
    SELECT c.*, CASE WHEN u.password_hash IS NULL THEN 0 ELSE 1 END AS hasPassword
    FROM customers c
    LEFT JOIN panel_users u ON u.customer_id = c.id
    ORDER BY c.name
  `)
  const [subdomainRows] = await dbPool.query("SELECT * FROM subdomains ORDER BY name")
  const [allocRows] = await dbPool.query("SELECT * FROM allocs ORDER BY id")

  return {
    settings,
    customers: customerRows.length ? customerRows.map(rowToCustomer) : DEFAULT_STATE.customers,
    subdomains: subdomainRows.length ? subdomainRows.map(rowToSubdomain) : DEFAULT_STATE.subdomains,
    allocs: allocRows.length ? allocRows.map(rowToAlloc) : DEFAULT_STATE.allocs,
  }
}

async function saveStateToDb(state) {
  await initDatabase()
  const conn = await dbPool.getConnection()
  try {
    await conn.beginTransaction()
    await conn.query("REPLACE INTO app_settings (id, payload) VALUES (1, ?)", [JSON.stringify(state.settings ?? DEFAULT_STATE.settings)])
    await conn.query("DELETE FROM customers")
    for (const item of state.customers ?? []) {
      await conn.query(
        "INSERT INTO customers (id, name, email, package, price, startDate, endDate, vmIP, subdomain, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.name, item.email, item.package, item.price, item.startDate, item.endDate, item.vmIP, item.subdomain, item.status],
      )
    }
    const customerIds = Array.isArray(state.customers) ? state.customers.map(item => String(item.id)) : []
    if (customerIds.length) {
      const placeholders = customerIds.map(() => "?").join(",")
      await conn.query(
        `DELETE FROM panel_users
         WHERE role = 'user'
           AND customer_id IS NOT NULL
           AND customer_id NOT IN (${placeholders})`,
        customerIds,
      )
    } else {
      await conn.query("DELETE FROM panel_users WHERE role = 'user' AND customer_id IS NOT NULL")
    }
    await conn.query(`
      UPDATE panel_users u
      INNER JOIN customers c ON c.id = u.customer_id
      SET u.email = c.email,
          u.display_name = c.name
      WHERE u.role = 'user' AND u.customer_id IS NOT NULL
    `)
    await conn.query("DELETE FROM subdomains")
    for (const item of state.subdomains ?? []) {
      await conn.query(
        "INSERT INTO subdomains (id, name, type, target, proxied, customerId, tunnelId, cfRecordId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [item.id, item.name, item.type, item.target, item.proxied ? 1 : 0, item.customerId || "", item.tunnelId || null, item.cfRecordId || null],
      )
    }
    await conn.query("DELETE FROM allocs")
    for (const item of state.allocs ?? []) {
      await conn.query(
        "INSERT INTO allocs (id, customerId, storageId, quota, used) VALUES (?, ?, ?, ?, ?)",
        [item.id, item.customerId, item.storageId, item.quota, item.used],
      )
    }
    await conn.commit()
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
  runtimeState = {
    settings: { ...DEFAULT_STATE.settings, ...(state.settings ?? {}) },
    customers: Array.isArray(state.customers) ? state.customers : DEFAULT_STATE.customers,
    subdomains: Array.isArray(state.subdomains) ? state.subdomains : DEFAULT_STATE.subdomains,
    allocs: Array.isArray(state.allocs) ? state.allocs : DEFAULT_STATE.allocs,
  }
  runtimeSettings = runtimeState.settings
}

async function syncCustomerPassword(customer, password) {
  await initDatabase()
  const hashed = hashPassword(password)
  await dbPool.query(
    `INSERT INTO panel_users (id, email, display_name, password_hash, role, customer_id)
     VALUES (?, ?, ?, ?, 'user', ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       display_name = VALUES(display_name),
       password_hash = VALUES(password_hash),
       role = 'user',
       customer_id = VALUES(customer_id)`,
    [`u-${customer.id}`, customer.email, customer.name, hashed, customer.id],
  )
}

async function deleteCustomerAccount(customerId) {
  await initDatabase()
  await dbPool.query("DELETE FROM panel_users WHERE customer_id = ?", [customerId])
}

async function getUserDashboard(req) {
  const sessionUser = await getSessionUser(req)
  if (!sessionUser) return null
  await ensureStateLoaded()
  const customer = sessionUser.customer_id
    ? runtimeState.customers.find(item => item.id === sessionUser.customer_id)
    : runtimeState.customers.find(item => String(item.email || "").toLowerCase() === String(sessionUser.email || "").toLowerCase())
  if (!customer) return { user: sessionUser, customer: null, vms: [], subdomains: [], allocs: [], storages: [], activities: [] }
  const [proxmox, activities] = await Promise.all([
    getMergedState(runtimeSettings),
    listActivity(10).catch(() => []),
  ])
  return {
    user: sessionUser,
    customer,
    vms: proxmox.vms.filter(vm => String(vm.customerId || "") === String(customer.id)),
    storages: proxmox.storages,
    subdomains: runtimeState.subdomains.filter(item => String(item.customerId || "") === String(customer.id)),
    allocs: runtimeState.allocs.filter(item => String(item.customerId || "") === String(customer.id)),
    activities,
  }
}

async function listActivity(limit = 20) {
  await initDatabase()
  const [rows] = await dbPool.query(
    "SELECT id, kind, message, meta, created_at FROM activity_logs ORDER BY created_at DESC, id DESC LIMIT ?",
    [Math.max(1, Math.min(100, Number(limit) || 20))],
  )
  return rows.map(row => ({
    id: Number(row.id),
    kind: row.kind,
    message: row.message,
    meta: row.meta ? safeJsonParse(row.meta) : null,
    createdAt: row.created_at,
  }))
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

function json(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  })
  res.end(JSON.stringify(payload))
}

function text(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  })
  res.end(body)
}

function sendJson(res, status, payload, extraHeaders = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  })
  res.end(JSON.stringify(payload))
}

function isWithinRoot(candidate, root) {
  const rel = path.relative(root, candidate)
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel)
}

function isProjectDirectory(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    if (!entries.length) return false
    if (entries.some(entry => entry.isFile() && PROJECT_MARKER_FILES.has(entry.name))) return true
    return entries.some(entry => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
  } catch {
    return false
  }
}

function listProjectFolders() {
  const folders = []
  const seen = new Set()

  for (const root of PROJECT_SCAN_ROOTS) {
    if (!fs.existsSync(root)) continue
    let entries = []
    try {
      entries = fs.readdirSync(root, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "uploads") continue
      const dirPath = path.join(root, entry.name)
      if (!isWithinRoot(dirPath, root)) continue
      if (!isProjectDirectory(dirPath)) continue
      if (seen.has(dirPath)) continue
      seen.add(dirPath)
      folders.push({
        path: dirPath,
        name: entry.name,
      })
    }
  }

  folders.sort((a, b) => a.path.localeCompare(b.path))
  return folders
}

function isTextProjectFile(name) {
  const ext = path.extname(name).toLowerCase()
  return [
    ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".css", ".scss", ".sass",
    ".html", ".md", ".txt", ".yml", ".yaml", ".xml", ".env", ".toml", ".py", ".php",
    ".sh", ".bat", ".ps1", ".java", ".kt", ".go", ".rs", ".dart", ".vue", ".svelte",
  ].includes(ext) || PROJECT_MARKER_FILES.has(name)
}

function readProjectTree(rootPath, currentPath = rootPath, depth = 0, maxDepth = 8) {
  const stats = fs.statSync(currentPath)
  const name = currentPath === rootPath ? path.basename(rootPath) : path.basename(currentPath)
  if (stats.isFile()) {
    let content = ""
    try {
      if (stats.size <= 128 * 1024 && isTextProjectFile(name)) {
        content = fs.readFileSync(currentPath, "utf8")
      }
    } catch {
      content = ""
    }
    return { kind: "file", name, content }
  }

  const children = []
  if (depth >= maxDepth) {
    return { kind: "dir", name, children }
  }

  let entries = []
  try {
    entries = fs.readdirSync(currentPath, { withFileTypes: true })
  } catch {
    return { kind: "dir", name, children }
  }

  entries
    .filter(entry => !entry.name.startsWith("."))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    .forEach(entry => {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "dist" || entry.name === "uploads") return
      const childPath = path.join(currentPath, entry.name)
      try {
        children.push(readProjectTree(rootPath, childPath, depth + 1, maxDepth))
      } catch {
        // Skip unreadable entries.
      }
    })

  return { kind: "dir", name, children }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on("data", chunk => {
      chunks.push(chunk)
      if (Buffer.concat(chunks).length > 2 * 1024 * 1024) {
        reject(new Error("Request body too large"))
        req.destroy()
      }
    })
    req.on("end", () => {
      if (!chunks.length) return resolve("")
      resolve(Buffer.concat(chunks).toString("utf8"))
    })
    req.on("error", reject)
  })
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase()
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".ico": "image/x-icon",
    ".map": "application/json; charset=utf-8",
    ".woff2": "font/woff2",
  })[ext] || "application/octet-stream"
}

function serveStatic(req, res, urlPath) {
  const safePath = urlPath === "/" ? "/index.html" : urlPath
  const filePath = path.join(DIST, safePath)
  const normalized = path.normalize(filePath)
  if (!normalized.startsWith(DIST)) {
    return text(res, 403, "Forbidden")
  }

  fs.stat(normalized, (err, stat) => {
    if (!err && stat.isFile()) {
      fs.readFile(normalized, (readErr, data) => {
        if (readErr) return text(res, 500, "Failed to read file")
        res.writeHead(200, {
          "Content-Type": contentType(normalized),
          "Cache-Control": normalized.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
        })
        res.end(data)
      })
      return
    }

    const indexFile = path.join(DIST, "index.html")
    fs.readFile(indexFile, (readErr, data) => {
      if (readErr) return text(res, 503, "Build output not found. Run npm run build first.")
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      })
      res.end(data)
    })
  })
}

function callProxmox(settings, method, apiPath, body) {
  return new Promise((resolve, reject) => {
    if (!settings.pveHost) {
      return reject(new Error("PVE host is not configured"))
    }
    if (!settings.pveTokenId || !settings.pveSecret) {
      return reject(new Error("PVE API token is not configured"))
    }

    const base = new URL(settings.pveHost)
    const isPlainObject = body && typeof body === "object" && !Buffer.isBuffer(body)
    const payload = body
      ? (isPlainObject
        ? new URLSearchParams(Object.entries(body).reduce((acc, [key, value]) => {
            if (value === undefined || value === null) return acc
            acc[key] = String(value)
            return acc
          }, {})).toString()
        : String(body))
      : null
    const headers = {
      Authorization: `PVEAPIToken=${settings.pveTokenId}=${settings.pveSecret}`,
      Accept: "application/json",
    }
    if (payload) {
      headers["Content-Type"] = isPlainObject ? "application/x-www-form-urlencoded" : "application/json"
      headers["Content-Length"] = Buffer.byteLength(payload)
    }

    const request = https.request({
      protocol: base.protocol,
      hostname: base.hostname,
      port: base.port || 8006,
      method,
      path: `/api2/json${apiPath}`,
      headers,
      agent: new https.Agent({ rejectUnauthorized: false }),
    }, response => {
      let raw = ""
      response.setEncoding("utf8")
      response.on("data", chunk => { raw += chunk })
      response.on("end", () => {
        const ok = response.statusCode >= 200 && response.statusCode < 300
        let parsed = raw
        try {
          parsed = raw ? JSON.parse(raw) : {}
        } catch {
          // keep raw string
        }
        if (!ok) {
          const message = typeof parsed === "object" && parsed && parsed.errors ? JSON.stringify(parsed.errors) : raw || response.statusMessage || "Proxmox request failed"
          return reject(new Error(message))
        }
        resolve(parsed)
      })
    })

    request.on("error", reject)
    if (payload) request.write(payload)
    request.end()
  })
}

function parseStorageIdentity(storageId) {
  if (!storageId) return { node: "", storage: "" }
  const parts = String(storageId).split("-")
  if (parts.length < 2) return { node: "", storage: String(storageId) }
  return {
    node: parts.shift() || "",
    storage: parts.join("-"),
  }
}

function bytesToGB(bytes) {
  return Math.max(0, Math.round(Number(bytes) / (1024 * 1024 * 1024)))
}

function detectStorageMedia(item) {
  const rota = item?.rota
  const tran = String(item?.tran || "").toLowerCase()
  const model = String(item?.model || "").toLowerCase()
  if (rota === false || tran === "nvme" || /nvme|ssd|flash/.test(model)) return "ssd"
  if (rota === true) return "hdd"
  return "hybrid"
}

function isProtectedMountpoint(mountpoint) {
  const safe = String(mountpoint || "")
  if (!safe) return false
  const protectedSet = new Set([
    "/",
    "/boot",
    "/boot/efi",
    "/etc/pve",
    "/var/lib/pve-cluster",
    "/var/lib/pve-manager",
    "/var/www",
    "/media/chaerul/panel-data",
  ])
  return protectedSet.has(safe)
}

async function getMountUsage(mountpoint) {
  if (!mountpoint || mountpoint === "[SWAP]") {
    return { total: 0, used: 0, available: 0 }
  }
  try {
    const { stdout } = await execFileAsync("df", ["-P", "-B1", mountpoint])
    const lines = String(stdout || "").trim().split("\n")
    if (lines.length < 2) return { total: 0, used: 0, available: 0 }
    const cols = lines[1].trim().split(/\s+/)
    const total = Number(cols[1] || 0)
    const used = Number(cols[2] || 0)
    const available = Number(cols[3] || 0)
    return { total: bytesToGB(total), used: bytesToGB(used), available: bytesToGB(available) }
  } catch {
    return { total: 0, used: 0, available: 0 }
  }
}

function flattenLsblk(node, parent = null, acc = []) {
  if (!node) return acc
  const current = {
    ...node,
    _parent: parent,
  }
  acc.push(current)
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      flattenLsblk(child, current, acc)
    }
  }
  return acc
}

async function getLocalStorageInventory() {
  const { stdout } = await execFileAsync("lsblk", [
    "-J",
    "-b",
    "-o",
    "NAME,PATH,TYPE,SIZE,ROTA,MOUNTPOINT,FSTYPE,MODEL,TRAN,RM,STATE,UUID,PKNAME",
  ])
  const payload = JSON.parse(String(stdout || "{}"))
  const nodes = Array.isArray(payload?.blockdevices) ? payload.blockdevices.flatMap(node => flattenLsblk(node)) : []
  const hostname = os.hostname()

  const storages = []
  for (const item of nodes) {
    const type = String(item.type || "")
    if (!["disk", "part", "lvm", "crypt"].includes(type)) continue
    if (String(item.mountpoint || "") === "[SWAP]") continue

    const mountpoint = String(item.mountpoint || "")
    if (!mountpoint && type !== "part" && type !== "crypt") continue
    const device = String(item.path || (item.name ? `/dev/${item.name}` : ""))
    const mountInfo = mountpoint ? await getMountUsage(mountpoint) : { total: 0, used: 0, available: 0 }
    const total = mountInfo.total || bytesToGB(item.size || 0)
    const used = mountpoint ? mountInfo.used : 0
    const media = detectStorageMedia(item)
    const fstype = String(item.fstype || "").toLowerCase()
    const mountable = Boolean(device) && Boolean(fstype) && !["lvm2_member", "swap"].includes(fstype)
    const actionable = Boolean(device) && !isProtectedMountpoint(mountpoint)
    const name = mountpoint ? path.basename(mountpoint) || item.name || device : item.name || device
    storages.push({
      id: device || name,
      name,
      type: fstype || String(type).toLowerCase(),
      media,
      total,
      used,
      status: mountpoint ? "active" : "disabled",
      path: mountpoint || device,
      node: hostname,
      device,
      mountpoint,
      fstype,
      actionable,
      mountable,
      protectedMount: isProtectedMountpoint(mountpoint),
    })
  }

  return storages
}

async function findFstabTarget(device) {
  try {
    const { stdout } = await execFileAsync("findmnt", ["--fstab", "--source", device, "-n", "-o", "TARGET"])
    return String(stdout || "").trim()
  } catch {
    return ""
  }
}

function fallbackMountTarget(device) {
  const safeName = String(device || "")
    .replace(/^\/dev\//, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return path.join("/mnt/hosting-panel", safeName || "storage")
}

async function tailFile(filePath, maxLines = 120) {
  try {
    const data = await fs.promises.readFile(filePath, "utf8")
    const lines = String(data || "").trimEnd().split("\n")
    return lines.slice(-maxLines).join("\n")
  } catch {
    return ""
  }
}

function parseTerminalCommand(command) {
  const raw = String(command || "").trim()
  if (!raw) return null
  const parts = raw.split(/\s+/)
  const base = parts[0]
  const rest = parts.slice(1)

  if (base === "help") {
    return { cmd: "help", args: [] }
  }
  if (base === "pm2" && rest[0] === "list") {
    return { cmd: "pm2", args: ["list"] }
  }
  if (base === "pm2" && rest[0] === "logs") {
    const target = rest[1] || "mypanel"
    const linesIdx = rest.indexOf("--lines")
    const lines = linesIdx >= 0 ? String(rest[linesIdx + 1] || "60") : "60"
    return { cmd: "pm2", args: ["logs", target, "--lines", lines, "--nostream"] }
  }
  if (base === "pm2" && rest[0] === "restart" && rest[1]) {
    return { cmd: "pm2", args: ["restart", rest[1]] }
  }
  if (base === "pm2" && rest[0] === "describe" && rest[1]) {
    return { cmd: "pm2", args: ["describe", rest[1]] }
  }
  if (base === "df" && rest[0] === "-h") {
    return { cmd: "df", args: ["-h"] }
  }
  if (base === "lsblk" && rest[0] === "-f") {
    return { cmd: "lsblk", args: ["-f"] }
  }
  if (base === "uptime") {
    return { cmd: "uptime", args: [] }
  }
  if (base === "free" && rest[0] === "-h") {
    return { cmd: "free", args: ["-h"] }
  }
  if (base === "whoami") {
    return { cmd: "whoami", args: [] }
  }
  if (base === "hostname") {
    return { cmd: "hostname", args: [] }
  }
  return null
}

async function runTerminalCommand(command) {
  const parsed = parseTerminalCommand(command)
  if (!parsed) {
    throw new Error("Perintah tidak diizinkan")
  }
  if (parsed.cmd === "help") {
    return [
      "Allowed commands:",
      "help",
      "pm2 list",
      "pm2 logs <name> --lines <n>",
      "pm2 restart <name>",
      "pm2 describe <name>",
      "df -h",
      "lsblk -f",
      "uptime",
      "free -h",
      "whoami",
      "hostname",
    ].join("\n")
  }
  const result = await execFileAsync(parsed.cmd, parsed.args, { timeout: 15000, maxBuffer: 1024 * 1024 })
  return String(result.stdout || result.stderr || "").trim() || "(no output)"
}

async function getTerminalFeed() {
  const [out, err, activities] = await Promise.all([
    tailFile(PM2_OUT_LOG, 80),
    tailFile(PM2_ERR_LOG, 80),
    listActivity("10").catch(() => []),
  ])
  return {
    ok: true,
    out,
    err,
    activities,
    updatedAt: new Date().toISOString(),
  }
}

function toVmRecord(item) {
  const type = item.type === "lxc" ? "lxc" : "vm"
  const cpu = Math.max(0, Math.min(100, Math.round((Number(item.cpu) || 0) * 100)))
  const mem = Math.max(0, Math.round((Number(item.mem) || 0) / (1024 * 1024)))
  const maxmem = Math.max(0, Math.round((Number(item.maxmem) || 0) / (1024 * 1024)))
  return {
    vmid: Number(item.vmid),
    name: item.name || `${type}-${item.vmid}`,
    type,
    customerId: "",
    status: item.status === "running" ? "running" : item.status === "paused" ? "paused" : "stopped",
    cpu,
    ram: mem,
    ramTotal: maxmem || Math.max(mem, 1),
    uptime: formatUptime(Number(item.uptime) || 0),
    os: item.template ? "Template" : (type === "lxc" ? "LXC Container" : "QEMU VM"),
  }
}

function toStorageRecord(item) {
  const name = String(item.storage || "storage")
  const pathHint = String(item.path || item.storage || "")
  const haystack = `${name} ${pathHint} ${item.type || ""}`.toLowerCase()
  const media = /(ssd|nvme|flash)/.test(haystack) ? "ssd" : /(nfs|cifs|backup|zfs)/.test(haystack) ? "hybrid" : "hdd"
  const total = Math.max(0, Math.round((Number(item.disk) || 0) / (1024 * 1024 * 1024)))
  const used = Math.max(0, Math.round(((Number(item.disk) || 0) - (Number(item.avail) || 0)) / (1024 * 1024 * 1024)))
  return {
    id: `${item.node || "pve"}-${item.storage}`,
    name: item.storage || "storage",
    type: item.shared ? "nfs" : "dir",
    media,
    total,
    used,
    status: item.status === "available" ? "active" : "disabled",
    path: item.storage || "",
    node: item.node || runtimeSettings.pveNode,
  }
}

function formatUptime(seconds) {
  if (!seconds) return "—"
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${d}d ${h}h ${String(m).padStart(2, "0")}m`
}

async function getVmInventory(settings) {
  const result = await callProxmox(settings, "GET", `/cluster/resources?type=vm`)
  const list = Array.isArray(result?.data) ? result.data.map(toVmRecord) : []
  return list
}

async function getStorageInventory(settings) {
  const result = await callProxmox(settings, "GET", `/cluster/resources?type=storage`)
  const list = Array.isArray(result?.data) ? result.data.map(toStorageRecord) : []
  return list
}

async function getMergedState(settings) {
  const [vms, storages] = await Promise.allSettled([getVmInventory(settings), getStorageInventory(settings)])
  return {
    vms: vms.status === "fulfilled" ? vms.value : [],
    storages: storages.status === "fulfilled" ? storages.value : [],
  }
}

async function handleApi(req, res, url) {
  if (req.method === "OPTIONS" && (url.pathname === "/api/health" || url.pathname.startsWith("/api/auth/"))) {
    res.writeHead(204, {
      "Cache-Control": "no-store",
      ...corsHeaders(req),
    })
    return res.end()
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    return json(res, 200, { ok: true }, corsHeaders(req))
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const email = String(incoming.email || "").trim().toLowerCase()
    const password = String(incoming.password || "")
    if (!email || !password) {
      return json(res, 400, { ok: false, error: "Email dan password wajib diisi" }, corsHeaders(req))
    }

    await initDatabase()
    const [rows] = await dbPool.query(
      "SELECT id, email, display_name, role, customer_id, password_hash FROM panel_users WHERE email = ? LIMIT 1",
      [email],
    )
    const user = rows[0]
    if (!user || !verifyPassword(password, user.password_hash)) {
      return json(res, 401, { ok: false, error: "Email atau password salah" }, corsHeaders(req))
    }

    const token = await createSession(user.id)
    res.setHeader("Set-Cookie", authCookieHeader(req, token))
    await logActivity("auth", `Login berhasil untuk ${user.email}`, { email: user.email, role: user.role })
    return json(res, 200, { ok: true, user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role, customerId: user.customer_id || null } }, corsHeaders(req))
  }

  if (req.method === "POST" && url.pathname === "/api/auth/register") {
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const email = String(incoming.email || "").trim().toLowerCase()
    const displayName = String(incoming.displayName || incoming.name || "").trim()
    const password = String(incoming.password || "")
    if (!displayName || !email || !password) {
      return json(res, 400, { ok: false, error: "Nama, email, dan password wajib diisi" }, corsHeaders(req))
    }
    if (password.length < 6) {
      return json(res, 400, { ok: false, error: "Password minimal 6 karakter" }, corsHeaders(req))
    }

    await initDatabase()
    const [existingRows] = await dbPool.query("SELECT id FROM panel_users WHERE email = ? LIMIT 1", [email])
    if (existingRows.length) {
      return json(res, 409, { ok: false, error: "Email sudah terdaftar" }, corsHeaders(req))
    }

    const userId = `u-${crypto.randomBytes(8).toString("hex")}`
    const passwordHash = hashPassword(password)
    await dbPool.query(
      `INSERT INTO panel_users (id, email, display_name, password_hash, role, customer_id)
       VALUES (?, ?, ?, ?, 'user', NULL)`,
      [userId, email, displayName, passwordHash],
    )

    const token = await createSession(userId)
    res.setHeader("Set-Cookie", authCookieHeader(req, token))
    await logActivity("auth", `Registrasi berhasil untuk ${email}`, { email })
    return json(res, 201, { ok: true, user: { id: userId, email, displayName, role: "user", customerId: null } }, corsHeaders(req))
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    const cookies = parseCookies(req.headers.cookie || "")
    await deleteSession(cookies[AUTH_COOKIE])
    res.setHeader("Set-Cookie", clearAuthCookieHeader(req))
    return json(res, 200, { ok: true }, corsHeaders(req))
  }

  if (req.method === "POST" && url.pathname === "/api/auth/password") {
    const sessionUser = await getSessionUser(req)
    if (!sessionUser) return json(res, 401, { ok: false, error: "Unauthorized" })
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const currentPassword = String(incoming.currentPassword || "")
    const newPassword = String(incoming.newPassword || "")
    if (!currentPassword || !newPassword) {
      return json(res, 400, { ok: false, error: "Password lama dan baru wajib diisi" }, corsHeaders(req))
    }
    if (newPassword.length < 6) {
      return json(res, 400, { ok: false, error: "Password baru minimal 6 karakter" }, corsHeaders(req))
    }
    await initDatabase()
    const [rows] = await dbPool.query("SELECT password_hash FROM panel_users WHERE id = ? LIMIT 1", [sessionUser.id])
    const row = rows[0]
    if (!row || !verifyPassword(currentPassword, row.password_hash)) {
      return json(res, 401, { ok: false, error: "Password lama salah" }, corsHeaders(req))
    }
    await dbPool.query("UPDATE panel_users SET password_hash = ? WHERE id = ?", [hashPassword(newPassword), sessionUser.id])
    await logActivity("auth", `Password diperbarui oleh ${sessionUser.email}`, { userId: sessionUser.id })
    return json(res, 200, { ok: true }, corsHeaders(req))
  }

  if (req.method === "GET" && url.pathname === "/api/auth/me") {
    const user = await getSessionUser(req)
    if (!user) return json(res, 401, { ok: false, error: "Unauthorized" }, corsHeaders(req))
    return json(res, 200, { ok: true, user: { id: user.id, email: user.email, displayName: user.display_name, role: user.role, customerId: user.customer_id || null } }, corsHeaders(req))
  }

  if (req.method === "GET" && url.pathname === "/api/folders") {
    const folders = listProjectFolders()
    return sendJson(res, 200, {
      ok: true,
      folders,
    }, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    })
  }

  if (req.method === "OPTIONS" && (url.pathname === "/api/folders" || url.pathname === "/api/project-tree")) {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
      "Cache-Control": "no-store",
    })
    return res.end()
  }

  if (req.method === "GET" && url.pathname === "/api/project-tree") {
    const requested = String(url.searchParams.get("path") || "").trim()
    if (!requested) {
      return sendJson(res, 400, { ok: false, error: "path wajib diisi" }, {
        "Access-Control-Allow-Origin": "*",
      })
    }
    const absolutePath = path.resolve(requested)
    const allowedRoot = PROJECT_SCAN_ROOTS.find(root => isWithinRoot(absolutePath, root) || absolutePath === root)
    if (!allowedRoot) {
      return sendJson(res, 403, { ok: false, error: "Path tidak diizinkan" }, {
        "Access-Control-Allow-Origin": "*",
      })
    }
    if (!fs.existsSync(absolutePath)) {
      return sendJson(res, 404, { ok: false, error: "Project tidak ditemukan" }, {
        "Access-Control-Allow-Origin": "*",
      })
    }
    const tree = readProjectTree(allowedRoot, absolutePath)
    return sendJson(res, 200, {
      ok: true,
      rootPath: absolutePath,
      rootName: path.basename(absolutePath),
      tree,
    }, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Accept",
    })
  }

  const openRoutes = new Set(["/api/health", "/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/me", "/api/folders", "/api/project-tree"])
  const adminOnlyRoutes = [
    /^\/api\/state$/,
    /^\/api\/settings$/,
    /^\/api\/activity$/,
    /^\/api\/subdomains/,
    /^\/api\/proxmox/,
    /^\/api\/storage\/local/,
    /^\/api\/terminal/,
    /^\/api\/customers\/[^/]+\/password$/,
  ]
  if (!openRoutes.has(url.pathname)) {
    const user = await getSessionUser(req)
    if (!user) {
      return json(res, 401, { ok: false, error: "Unauthorized" })
    }
    if (adminOnlyRoutes.some(pattern => pattern.test(url.pathname)) && user.role !== "admin") {
      return json(res, 403, { ok: false, error: "Forbidden" })
    }
  }

  if (req.method === "GET" && url.pathname === "/api/user/dashboard") {
    const dashboard = await getUserDashboard(req)
    if (!dashboard) return json(res, 401, { ok: false, error: "Unauthorized" })
    return json(res, 200, { ok: true, ...dashboard })
  }

  if (req.method === "POST" && /^\/api\/customers\/[^/]+\/password$/.test(url.pathname)) {
    await ensureStateLoaded()
    const sessionUser = await getSessionUser(req)
    if (!sessionUser || sessionUser.role !== "admin") {
      return json(res, 403, { ok: false, error: "Forbidden" })
    }
    const customerId = decodeURIComponent(url.pathname.split("/")[3] || "")
    const customer = runtimeState.customers.find(item => item.id === customerId)
    if (!customer) {
      return json(res, 404, { ok: false, error: "Customer tidak ditemukan" })
    }
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const password = String(incoming.password || "").trim()
    if (!password || password.length < 6) {
      return json(res, 400, { ok: false, error: "Password minimal 6 karakter" })
    }
    await syncCustomerPassword(customer, password)
    await logActivity("user-password", `Password customer ${customer.email} diperbarui`, { customerId, email: customer.email })
    return json(res, 200, { ok: true })
  }

  if (req.method === "POST" && url.pathname === "/api/subdomains") {
    await ensureStateLoaded()
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const name = String(incoming.name || "").trim().toLowerCase()
    const type = String(incoming.type || "A")
    const target = String(incoming.target || "").trim()
    const proxied = Boolean(incoming.proxied)
    const customerId = String(incoming.customerId || "")
    const tunnelId = String(incoming.tunnelId || "").trim()

    if (!name) return json(res, 400, { ok: false, error: "Nama subdomain wajib diisi" })
    if (type === "Tunnel" && !tunnelId) return json(res, 400, { ok: false, error: "Tunnel ID wajib diisi" })
    if (type !== "Tunnel" && !target) return json(res, 400, { ok: false, error: "Target wajib diisi" })

    const cfType = type === "Tunnel" ? "CNAME" : type
    const cfTarget = type === "Tunnel" ? `${tunnelId}.cfargotunnel.com` : target
    const cfProxied = type === "Tunnel" ? true : proxied
    const existingLocal = runtimeState.subdomains.find(item => item.name === name)
    const existing = await cloudflareFindDnsRecord(runtimeSettings, name, cfType).catch(() => null)
    let cfRecord = existing
    if (existing) {
      cfRecord = await cloudflareRequest(
        runtimeSettings,
        "PUT",
        `/zones/${runtimeSettings.cfZoneId}/dns_records/${existing.id}`,
        { type: cfType, name, content: cfTarget, ttl: 1, proxied: cfProxied },
      ).then(r => r.result)
    } else {
      cfRecord = await cloudflareCreateDnsRecord(runtimeSettings, {
        type: cfType,
        name,
        content: cfTarget,
        proxied: cfProxied,
      })
    }

    const subdomain = {
      id: existingLocal?.id || `s${Date.now()}`,
      name,
      type,
      target: cfTarget,
      proxied: cfProxied,
      customerId,
      tunnelId: type === "Tunnel" ? tunnelId : undefined,
      cfRecordId: cfRecord?.id || null,
    }

    runtimeState.subdomains = existingLocal
      ? runtimeState.subdomains.map(item => item.id === existingLocal.id ? subdomain : item)
      : [...runtimeState.subdomains, subdomain]
    await saveStateToDb(runtimeState)
    await logActivity("subdomain", `Subdomain ${name} dibuat di Cloudflare`, { name, type, recordId: cfRecord?.id || null, customerId })
    return json(res, 200, { ok: true, subdomains: runtimeState.subdomains, record: subdomain })
  }

  if (req.method === "PUT" && /^\/api\/subdomains\/[^/]+$/.test(url.pathname)) {
    await ensureStateLoaded()
    const id = decodeURIComponent(url.pathname.split("/").pop() || "")
    const existingLocal = runtimeState.subdomains.find(item => item.id === id)
    if (!existingLocal) return json(res, 404, { ok: false, error: "Subdomain tidak ditemukan" })

    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const name = String(incoming.name || existingLocal.name).trim().toLowerCase()
    const type = String(incoming.type || existingLocal.type || "A")
    const target = String(incoming.target || "").trim()
    const proxied = Boolean(incoming.proxied)
    const customerId = String(incoming.customerId || "")
    const tunnelId = String(incoming.tunnelId || "").trim()

    if (!name) return json(res, 400, { ok: false, error: "Nama subdomain wajib diisi" })
    if (type === "Tunnel" && !tunnelId) return json(res, 400, { ok: false, error: "Tunnel ID wajib diisi" })
    if (type !== "Tunnel" && !target) return json(res, 400, { ok: false, error: "Target wajib diisi" })

    const cfType = type === "Tunnel" ? "CNAME" : type
    const cfTarget = type === "Tunnel" ? `${tunnelId}.cfargotunnel.com` : target
    const cfProxied = type === "Tunnel" ? true : proxied
    const recordId = existingLocal.cfRecordId || (await cloudflareFindDnsRecord(runtimeSettings, existingLocal.name, existingLocal.type === "Tunnel" ? "CNAME" : existingLocal.type).catch(() => null))?.id
    if (!recordId) {
      return json(res, 404, { ok: false, error: "Cloudflare record tidak ditemukan" })
    }

    const updated = await cloudflareUpdateDnsRecord(runtimeSettings, recordId, {
      type: cfType,
      name,
      content: cfTarget,
      proxied: cfProxied,
    })

    const next = {
      id: existingLocal.id,
      name,
      type,
      target: cfTarget,
      proxied: cfProxied,
      customerId,
      tunnelId: type === "Tunnel" ? tunnelId : undefined,
      cfRecordId: updated?.id || recordId,
    }

    runtimeState.subdomains = runtimeState.subdomains.map(item => item.id === existingLocal.id ? next : item)
    await saveStateToDb(runtimeState)
    await logActivity("subdomain", `Subdomain ${name} diperbarui di Cloudflare`, { name, type, recordId: next.cfRecordId, customerId })
    return json(res, 200, { ok: true, subdomains: runtimeState.subdomains, record: next })
  }

  if (req.method === "GET" && url.pathname === "/api/subdomains") {
    await ensureStateLoaded()
    try {
      const records = await cloudflareListDnsRecords(runtimeSettings)
      const subdomains = records
        .filter(record => record?.type === "A" || record?.type === "CNAME")
        .map(record => mapCloudflareSubdomain(record, runtimeState.customers, runtimeState.subdomains))
      return json(res, 200, { ok: true, source: "cloudflare", subdomains })
    } catch (err) {
      return json(res, 200, {
        ok: true,
        source: "cloudflare",
        warning: err?.message || "Cloudflare list gagal dimuat",
        subdomains: [],
      })
    }
  }

  if (req.method === "DELETE" && /^\/api\/subdomains\/[^/]+$/.test(url.pathname)) {
    await ensureStateLoaded()
    const id = decodeURIComponent(url.pathname.split("/").pop() || "")
    const existing = runtimeState.subdomains.find(item => item.id === id)
    if (!existing) return json(res, 404, { ok: false, error: "Subdomain tidak ditemukan" })

    const cfType = existing.type === "Tunnel" ? "CNAME" : existing.type
    const recordId = existing.cfRecordId || (await cloudflareFindDnsRecord(runtimeSettings, existing.name, cfType).catch(() => null))?.id
    if (recordId) {
      await cloudflareDeleteDnsRecord(runtimeSettings, recordId)
    }
    runtimeState.subdomains = runtimeState.subdomains.filter(item => item.id !== id)
    await saveStateToDb(runtimeState)
    await logActivity("subdomain", `Subdomain ${existing.name} dihapus dari Cloudflare`, { name: existing.name, recordId: recordId || null })
    return json(res, 200, { ok: true, subdomains: runtimeState.subdomains })
  }

  if (req.method === "GET" && url.pathname === "/api/state") {
    await ensureStateLoaded()
    const proxmox = await getMergedState(runtimeSettings)
    return json(res, 200, {
      ok: true,
      settings: runtimeSettings,
      customers: runtimeState.customers,
      subdomains: runtimeState.subdomains,
      allocs: runtimeState.allocs,
      ...proxmox,
    })
  }

  if (req.method === "POST" && url.pathname === "/api/state") {
    await ensureStateLoaded()
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    runtimeState = {
      settings: { ...runtimeSettings, ...(incoming.settings ?? {}) },
      customers: Array.isArray(incoming.customers) ? incoming.customers : runtimeState.customers,
      subdomains: Array.isArray(incoming.subdomains) ? incoming.subdomains : runtimeState.subdomains,
      allocs: Array.isArray(incoming.allocs) ? incoming.allocs : runtimeState.allocs,
    }
    runtimeSettings = runtimeState.settings
    await saveStateToDb(runtimeState)
    await logActivity("state", "Data users, subdomain, dan alokasi diperbarui", {
      users: runtimeState.customers.length,
      subdomains: runtimeState.subdomains.length,
      allocs: runtimeState.allocs.length,
    })
    const proxmox = await getMergedState(runtimeSettings)
    return json(res, 200, {
      ok: true,
      settings: runtimeSettings,
      customers: runtimeState.customers,
      subdomains: runtimeState.subdomains,
      allocs: runtimeState.allocs,
      ...proxmox,
    })
  }

  if (req.method === "GET" && url.pathname === "/api/settings") {
    return json(res, 200, { settings: runtimeSettings })
  }

  if (req.method === "GET" && url.pathname === "/api/activity") {
    const limit = url.searchParams.get("limit") || "20"
    const activities = await listActivity(limit)
    return json(res, 200, { ok: true, activities })
  }

  if (req.method === "POST" && url.pathname === "/api/settings") {
    await ensureStateLoaded()
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    runtimeSettings = { ...runtimeSettings, ...incoming }
    runtimeState.settings = runtimeSettings
    await saveStateToDb(runtimeState)
    await logActivity("settings", "Pengaturan panel diperbarui", { businessName: runtimeSettings.businessName, pveNode: runtimeSettings.pveNode })
    return json(res, 200, { ok: true, settings: runtimeSettings })
  }

  if (req.method === "POST" && url.pathname === "/api/proxmox/test") {
    await ensureStateLoaded()
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const settings = { ...runtimeSettings, ...incoming }
    const version = await callProxmox(settings, "GET", "/version")
    await logActivity("proxmox-test", "Tes koneksi Proxmox berhasil", { host: settings.pveHost, node: settings.pveNode })
    return json(res, 200, { ok: true, data: version?.data ?? version, settings })
  }

  if (req.method === "GET" && url.pathname === "/api/proxmox/state") {
    const state = await getMergedState(runtimeSettings)
    return json(res, 200, { ok: true, ...state })
  }

  if (req.method === "GET" && url.pathname === "/api/storage/local/state") {
    try {
      const storages = await getLocalStorageInventory()
      return json(res, 200, { ok: true, source: "server", storages })
    } catch (err) {
      return json(res, 200, {
        ok: true,
        source: "server",
        warning: err?.message || "Local storage scan gagal",
        storages: [],
      })
    }
  }

  if (req.method === "GET" && url.pathname === "/api/terminal/logs") {
    const lines = Math.max(20, Math.min(200, Number(url.searchParams.get("lines") || "80")))
    const feed = await getTerminalFeed()
    return json(res, 200, { ...feed, lines })
  }

  if (req.method === "POST" && url.pathname === "/api/terminal/run") {
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const command = String(incoming.command || "")
    if (!command.trim()) {
      return json(res, 400, { ok: false, error: "Command kosong" })
    }
    try {
      const output = await runTerminalCommand(command)
      await logActivity("terminal", `Terminal command dijalankan: ${command}`, { command })
      return json(res, 200, { ok: true, command, output })
    } catch (err) {
      await logActivity("terminal", `Terminal command gagal: ${command}`, { command, error: err?.message || String(err) }).catch(() => {})
      return json(res, 400, { ok: false, error: err?.message || "Perintah gagal" })
    }
  }

  if (req.method === "POST" && /^\/api\/proxmox\/vm\/\d+\/action$/.test(url.pathname)) {
    await ensureStateLoaded()
    const vmid = Number(url.pathname.split("/")[4])
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const action = incoming.action
    if (!action) {
      return json(res, 400, { ok: false, error: "Missing action" })
    }

    const inventory = await callProxmox(runtimeSettings, "GET", "/cluster/resources?type=vm")
    const vm = Array.isArray(inventory?.data) ? inventory.data.find(item => Number(item.vmid) === vmid) : null
    if (!vm) {
      return json(res, 404, { ok: false, error: `VMID ${vmid} not found` })
    }

    const guestType = vm.type === "lxc" ? "lxc" : "qemu"
    const node = vm.node || runtimeSettings.pveNode
    let method = "POST"
    let endpoint = `/nodes/${node}/${guestType}/${vmid}/status/${action}`
    if (action === "delete") {
      method = "DELETE"
      endpoint = `/nodes/${node}/${guestType}/${vmid}`
    } else if (action === "restart") {
      endpoint = `/nodes/${node}/${guestType}/${vmid}/status/reboot`
    } else if (action === "stop") {
      endpoint = `/nodes/${node}/${guestType}/${vmid}/status/shutdown`
    } else if (action === "start") {
      endpoint = `/nodes/${node}/${guestType}/${vmid}/status/start`
    } else {
      return json(res, 400, { ok: false, error: `Unsupported action ${action}` })
    }

    await callProxmox(runtimeSettings, method, endpoint)
    await logActivity("proxmox-vm", `Aksi VM ${action} untuk VMID ${vmid}`, { vmid, action, node })
    const state = await getMergedState(runtimeSettings)
    return json(res, 200, { ok: true, ...state })
  }

  if (req.method === "POST" && /^\/api\/storage\/local\/[^/]+\/action$/.test(url.pathname)) {
    const storageId = decodeURIComponent(url.pathname.split("/")[4] || "")
    const body = await readBody(req)
    const incoming = body ? JSON.parse(body) : {}
    const action = String(incoming.action || "").toLowerCase()
    if (!["mount", "unmount"].includes(action)) {
      return json(res, 400, { ok: false, error: "Unsupported action" })
    }

    const inventory = await getLocalStorageInventory()
    const current = inventory.find(item => item.id === storageId)

    if (!current) {
      return json(res, 404, { ok: false, error: "Storage tidak ditemukan di server" })
    }

    if (!current.actionable) {
      return json(res, 409, { ok: false, error: "Storage ini dilindungi dan tidak boleh diubah" })
    }

    if (action === "unmount") {
      if (!current.mountpoint) {
        return json(res, 409, { ok: false, error: "Storage belum ter-mount" })
      }
      await execFileAsync("umount", [current.mountpoint])
      await logActivity("server-storage", `Storage ${current.mountpoint} di-unmount`, {
        device: current.device,
        mountpoint: current.mountpoint,
        action,
      })
    } else {
      if (!current.mountable) {
        return json(res, 409, { ok: false, error: `Storage ${current.device} tidak punya filesystem yang bisa di-mount` })
      }
      const target = current.mountpoint || (await findFstabTarget(current.device)) || fallbackMountTarget(current.device)
      await fs.promises.mkdir(target, { recursive: true })
      await execFileAsync("mount", [current.device, target])
      await logActivity("server-storage", `Storage ${current.device} di-mount`, {
        device: current.device,
        mountpoint: target,
        action,
      })
    }

    const storages = await getLocalStorageInventory()
    return json(res, 200, { ok: true, storages })
  }

  return null
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`)
    if (url.pathname.startsWith("/api/")) {
      const apiResult = await handleApi(req, res, url)
      if (apiResult !== null) return
      return text(res, 404, "Not found")
    }
    serveStatic(req, res, url.pathname)
  } catch (err) {
    console.error(err)
    text(res, 500, err?.message || "Internal server error")
  }
})

async function bootstrap() {
  runtimeState = await loadStateFromDb()
  runtimeSettings = runtimeState.settings
  stateLoaded = true
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`mypanel server listening on http://0.0.0.0:${PORT}`)
  })
}

bootstrap().catch(err => {
  console.error(err)
  process.exit(1)
})
