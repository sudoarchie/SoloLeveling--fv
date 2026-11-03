import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import dotenv from "dotenv"
import path from "node:path"
import fs from "node:fs"

// Search for .env.local and .env up to 3 levels up
function loadEnv() {
  const searchDirs = [
    process.cwd(),
    path.resolve(process.cwd(), ".."),
    path.resolve(process.cwd(), "../.."),
  ]

  for (const dir of searchDirs) {
    const localEnv = path.join(dir, ".env.local")
    if (fs.existsSync(localEnv)) {
      dotenv.config({ path: localEnv })
      break
    }
    const defaultEnv = path.join(dir, ".env")
    if (fs.existsSync(defaultEnv)) {
      dotenv.config({ path: defaultEnv })
      break
    }
  }
}

loadEnv()

export class SupabaseManager {
  private client: SupabaseClient | null = null
  private currentUser: User | null = null
  private supabaseUrl: string
  private supabaseKey: string
  private serviceRoleKey: string | null = null
  private directUserId: string | null = null

  constructor() {
    this.supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      ""
    this.supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      ""
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || null
    this.directUserId = process.env.GATE_TRACKER_USER_ID || null

    if (this.supabaseUrl && (this.serviceRoleKey || this.supabaseKey)) {
      this.initClient()
    }
  }

  private initClient(token?: string) {
    const keyToUse = this.serviceRoleKey || this.supabaseKey
    this.client = createClient(this.supabaseUrl, keyToUse, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    })
  }

  public getClient(): SupabaseClient {
    if (!this.client) {
      if (!this.supabaseUrl || !this.supabaseKey) {
        throw new Error(
          "Supabase URL or Publishable Key missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in environment or .env.local",
        )
      }
      this.initClient()
    }
    return this.client!
  }

  public async login(email: string, password: string): Promise<User> {
    const client = this.getClient()
    const { data, error } = await client.auth.signInWithPassword({ email, password })
    if (error) {
      throw new Error(`Authentication failed for ${email}: ${error.message}`)
    }
    if (!data.user) {
      throw new Error(`Sign in succeeded but no user object returned for ${email}`)
    }
    this.currentUser = data.user
    return this.currentUser
  }

  public async ensureAuthenticated(): Promise<User> {
    if (this.currentUser) {
      return this.currentUser
    }

    // 1. Check for token in env
    const token =
      process.env.GATE_TRACKER_AUTH_TOKEN ||
      process.env.SUPABASE_ACCESS_TOKEN
    if (token) {
      this.initClient(token)
      const { data, error } = await this.client!.auth.getUser(token)
      if (!error && data.user) {
        this.currentUser = data.user
        return this.currentUser
      }
    }

    // 2. Check for service role + user id
    if (this.serviceRoleKey && this.directUserId) {
      this.currentUser = {
        id: this.directUserId,
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      } as User
      return this.currentUser
    }

    // 3. Check for credentials in env
    const email =
      process.env.GATE_TRACKER_EMAIL ||
      process.env.MOCK_ADMIN_UPLOAD_EMAIL ||
      process.env.MOCK_IMPORT_EMAIL
    const password =
      process.env.GATE_TRACKER_PASSWORD ||
      process.env.MOCK_ADMIN_UPLOAD_PASSWORD ||
      process.env.MOCK_IMPORT_PASSWORD

    if (email && password) {
      return await this.login(email, password)
    }

    // 4. Try checking if current session already exists
    const { data } = await this.getClient().auth.getUser()
    if (data.user) {
      this.currentUser = data.user
      return this.currentUser
    }

    throw new Error(
      "Unauthenticated: Please configure GATE_TRACKER_EMAIL and GATE_TRACKER_PASSWORD in your environment / settings, or call the 'authenticate_user' tool with your credentials.",
    )
  }

  public getCurrentUser(): User | null {
    return this.currentUser
  }

  public async safeQuery<T>(
    operation: (client: SupabaseClient, user: User) => Promise<{ data: T | null; error: any }>,
    fallback: T,
  ): Promise<T> {
    try {
      const user = await this.ensureAuthenticated()
      const client = this.getClient()
      const { data, error } = await operation(client, user)
      if (error) {
        // Table doesn't exist or column missing
        if (error.code === "PGRST205" || error.code === "42P01") {
          return fallback
        }
        console.error(`[MCP Database Warning]: ${error.message} (Code: ${error.code})`)
        return fallback
      }
      return data ?? fallback
    } catch (err: any) {
      console.error(`[MCP Query Error]: ${err.message}`)
      return fallback
    }
  }
}

export const supabaseManager = new SupabaseManager()
