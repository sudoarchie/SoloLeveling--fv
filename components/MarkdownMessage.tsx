"use client"

import React, { useMemo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface MarkdownMessageProps {
  content: string
  className?: string
  isStreaming?: boolean
}

/**
 * Heuristically repairs common LLM streaming quirks:
 * 1. Missing table delimiter row (| --- | --- |) when an LLM writes header + data rows
 * 2. Unclosed trailing code fences or pipes during active streaming
 * 3. Stripping accidental trailing raw JSON metadata blocks
 */
function repairMarkdown(text: string, isStreaming = false): string {
  if (!text) return ""

  // 1. Strip trailing raw json metadata block if present (e.g. from daily briefing cron)
  let cleaned = text.replace(/\s*```json[\s\S]*?```\s*$/, "")

  // 2. Fix tables missing the separator line (|---|---|)
  const lines = cleaned.split("\n")
  const result: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    result.push(line)

    const trimmed = line.trim()
    const pipeCount = (trimmed.match(/\|/g) || []).length
    const isBullet = /^\s*[-*+]\s+/.test(line)
    const isTableRow = pipeCount >= 2 && !isBullet

    if (isTableRow) {
      const prevLine = lines[i - 1]?.trim() ?? ""
      const prevPipeCount = (prevLine.match(/\|/g) || []).length
      const prevIsTableRow = prevPipeCount >= 2 && !/^\s*[-*+]\s+/.test(lines[i - 1] ?? "")

      const nextLine = lines[i + 1]?.trim() ?? ""
      const isNextDelimiter =
        /^\|?\s*[-: ]+[-|: ]*\|?$/.test(nextLine) && nextLine.includes("-")

      // If this is the start of a table (first row) and next line is NOT a delimiter:
      if (!prevIsTableRow && !isNextDelimiter) {
        const nextPipeCount = (nextLine.match(/\|/g) || []).length
        const nextIsTableRow = nextPipeCount >= 2 && !/^\s*[-*+]\s+/.test(nextLine)

        if (nextIsTableRow || (isStreaming && i === lines.length - 1)) {
          const cells = trimmed.split("|").map((c) => c.trim()).filter(Boolean)
          const colCount = Math.max(cells.length, 1)
          const delimiter = "| " + Array(colCount).fill("---").join(" | ") + " |"
          result.push(delimiter)
        }
      }
    }
  }

  let repaired = result.join("\n")

  // 3. If streaming ends with an unclosed code block (odd number of ```), close it optimistically
  if (isStreaming) {
    const codeFenceCount = (repaired.match(/```/g) || []).length
    if (codeFenceCount % 2 === 1) {
      repaired += "\n```"
    }
  }

  return repaired
}

export function MarkdownMessage({
  content,
  className = "",
  isStreaming = false,
}: MarkdownMessageProps) {
  const processedContent = useMemo(
    () => repairMarkdown(content, isStreaming),
    [content, isStreaming],
  )

  if (!processedContent) return null

  return (
    <div
      className={`markdown-body text-sm leading-relaxed text-foreground select-text ${className}`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground mt-4 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm sm:text-base font-semibold tracking-tight text-foreground mt-3.5 mb-2 first:mt-0 pb-1 border-b border-border/40">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xs sm:text-sm font-semibold tracking-tight text-foreground mt-3 mb-1.5 first:mt-0 flex items-center gap-1.5">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="leading-relaxed mb-2.5 last:mb-0 text-foreground/90">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-outside pl-4 space-y-1 mb-2.5 text-foreground/90">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-outside pl-4 space-y-1 mb-2.5 text-foreground/90">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed pl-0.5">{children}</li>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-primary/40 pl-3 my-2.5 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          // High-craft responsive data table
          table: ({ children }) => (
            <div className="my-3 w-full overflow-x-auto rounded-lg border border-border/70 bg-card/60 shadow-sm">
              <table className="w-full min-w-[360px] border-collapse text-left text-xs sm:text-sm">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border/70 bg-muted/60 text-foreground font-semibold">
              {children}
            </thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-border/40 text-foreground/90">
              {children}
            </tbody>
          ),
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-muted/30">
              {children}
            </tr>
          ),
          th: ({ children }) => (
            <th className="px-3.5 py-2 font-semibold text-foreground border-r last:border-r-0 border-border/40">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3.5 py-2 text-foreground/90 border-r last:border-r-0 border-border/40 align-top">
              {children}
            </td>
          ),
          code: ({ children, className }) => {
            const isBlock = className?.includes("language-")
            if (isBlock) {
              return (
                <code className="block text-xs font-mono font-normal">
                  {children}
                </code>
              )
            }
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-[12px] font-mono font-medium text-foreground">
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="bg-muted/70 border border-border/60 rounded-lg p-3 my-2.5 overflow-x-auto text-xs font-mono">
              {children}
            </pre>
          ),
          hr: () => <hr className="border-border/50 my-3" />,
        }}
      >
        {processedContent}
      </ReactMarkdown>

      {/* Streaming pulse indicator */}
      {isStreaming && (
        <span className="inline-block h-3.5 w-1.5 translate-y-0.5 bg-primary/70 animate-pulse ml-0.5" />
      )}
    </div>
  )
}
