"use client"

import React, { Component, type ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RotateCcw } from "lucide-react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ProgressErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ProgressAnalytics caught error:", error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-destructive/30 bg-destructive/5 my-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-base text-destructive font-semibold">
                Progress Analytics Calibration Required
              </CardTitle>
            </div>
            <CardDescription className="text-xs">
              An unexpected condition occurred while calculating Hunter telemetry.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs font-mono text-muted-foreground bg-background/80 p-2.5 rounded-lg border">
              {this.state.error?.message || "Unknown client error"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="gap-2 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Recalibrate Telemetry
            </Button>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}
