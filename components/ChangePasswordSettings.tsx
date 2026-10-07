"use client"

import { useRef, useState } from "react"
import { KeyRound, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createClient } from "@/utils/supabase/client"

export function ChangePasswordSettings() {
  const [expanded, setExpanded] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const closeForm = () => {
    setExpanded(false)
    setCurrentPassword("")
    setPassword("")
    setConfirmPassword("")
    setError(null)
    triggerRef.current?.focus()
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (loading) return
    setError(null)

    if (!currentPassword) {
      setError("Enter your current password.")
      return
    }
    if (password.length < 6) {
      setError("Your new password must be at least 6 characters.")
      return
    }
    if (password !== confirmPassword) {
      setError("Your new passwords don’t match.")
      return
    }
    if (password === currentPassword) {
      setError("Choose a password different from your current password.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: userError } = await supabase.auth.getUser()
      if (userError || !data.user?.email) {
        setError("Your session has expired. Sign in again to change your password.")
        return
      }

      // Verify the current password even when the project's password-change
      // policy does not require it, and refresh the session before updating.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.user.email,
        password: currentPassword,
      })
      if (signInError) {
        setError(
          signInError.code === "invalid_credentials"
            ? "Your current password is incorrect."
            : signInError.message,
        )
        return
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password,
        current_password: currentPassword,
      })
      if (updateError) {
        setError(updateError.message)
        return
      }

      closeForm()
      toast.success("Password changed successfully.")
    } catch {
      setError("Couldn’t change your password. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="border-t pt-5" aria-labelledby="account-settings-title">
      <h3 id="account-settings-title" className="mb-3 text-sm font-medium">
        Account
      </h3>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        className="w-full justify-start"
        aria-expanded={expanded}
        aria-controls="change-password-form"
        disabled={loading}
        onClick={() => (expanded ? closeForm() : setExpanded(true))}
      >
        <KeyRound />
        Change password
      </Button>
      {expanded && (
        <form
          id="change-password-form"
          onSubmit={handleSubmit}
          className="mt-4 space-y-4"
          aria-label="Change password"
          aria-busy={loading}
        >
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              disabled={loading}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              aria-describedby="new-password-hint"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
            <p id="new-password-hint" className="text-xs text-muted-foreground">
              Use at least 6 characters.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-new-password">Confirm new password</Label>
            <Input
              id="confirm-new-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              required
              minLength={6}
              disabled={loading}
            />
          </div>
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={closeForm} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Updating password…" : "Update password"}
            </Button>
          </div>
        </form>
      )}
    </section>
  )
}
