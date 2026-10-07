"use client"

import { useEffect, useState } from "react"
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Download, FileJson, Loader2, RefreshCw } from "lucide-react"
import { createClient } from "@/utils/supabase/client"
import { MOCK_IMAGE_BUCKET, questionBankError, type MockPaper, type MockQuestion, type QuestionImage } from "@/lib/mock-tests"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

const PAGE_SIZE = 20

function QuestionImages({ images, urls }: { images: QuestionImage[]; urls: Record<string, string> }) {
  return images.length > 0 ? (
    <div className="mt-3 flex flex-wrap gap-3">
      {images.map((image, index) => urls[image.path] ? (
        <a key={`${image.path}-${index}`} href={urls[image.path]} target="_blank" rel="noreferrer" className="max-w-full rounded-lg border bg-white p-2">
          {/* Private Storage URLs are temporary and already authenticated. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={urls[image.path]} alt={image.alt || "Question diagram"} loading="lazy" className="max-h-80 max-w-full object-contain" />
        </a>
      ) : (
        <p key={`${image.path}-${index}`} className="text-sm text-muted-foreground">Image unavailable. Refresh to try again.</p>
      ))}
    </div>
  ) : null
}

function QuestionCard({ question, urls }: { question: MockQuestion; urls: Record<string, string> }) {
  const [revealed, setRevealed] = useState(false)
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Question {question.question_number}</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{question.question_type.toUpperCase()}</Badge>
            <span>{question.marks} {Number(question.marks) === 1 ? "mark" : "marks"}</span>
            {Number(question.negative_marks) > 0 && <span>−{question.negative_marks} if incorrect</span>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{question.question_text}</p>
          <QuestionImages images={question.images} urls={urls} />
        </div>
        {question.options.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {question.options.map(option => {
              const correct = revealed && question.correct_option_ids.includes(option.id)
              return (
                <div key={option.id} className={`min-w-0 rounded-lg border p-3 ${correct ? "border-primary bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2 text-sm">
                    <span className="font-semibold">{option.id}.</span>
                    <p className="min-w-0 whitespace-pre-wrap break-words">{option.text}</p>
                  </div>
                  <QuestionImages images={option.images} urls={urls} />
                  {correct && <p className="mt-2 text-xs font-medium text-primary">Correct option</p>}
                </div>
              )
            })}
          </div>
        )}
        <Button variant="outline" size="sm" aria-expanded={revealed} onClick={() => setRevealed(!revealed)}>
          {revealed ? "Hide answer" : "Show answer"}
        </Button>
        {revealed && (
          <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
            <p className="font-medium">
              {question.question_type === "nat"
                ? `Accepted answer: ${question.answer_min === question.answer_max ? question.answer_min : `${question.answer_min} to ${question.answer_max}`}`
                : `Correct ${question.correct_option_ids.length === 1 ? "option" : "options"}: ${question.correct_option_ids.join(", ")}`}
            </p>
            {question.explanation && <p className="whitespace-pre-wrap break-words leading-relaxed text-muted-foreground">{question.explanation}</p>}
          </div>
        )}
        {Object.keys(question.metadata).length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Question metadata</summary>
            <pre className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-3">{JSON.stringify(question.metadata, null, 2)}</pre>
          </details>
        )}
      </CardContent>
    </Card>
  )
}

export function MockQuestionBank() {
  const [exam, setExam] = useState("GATE")
  const [exams, setExams] = useState<string[]>(["GATE"])
  const [papers, setPapers] = useState<MockPaper[]>([])
  const [selected, setSelected] = useState<MockPaper | null>(null)
  const [questions, setQuestions] = useState<MockQuestion[]>([])
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageWarning, setImageWarning] = useState(false)
  const [revision, setRevision] = useState(0)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => { setFilter(search); setPage(0) }, 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      setImageWarning(false)
      setUrls({})
      try {
        const supabase = createClient()
        if (!selected) {
          let query = supabase.from("mock_papers")
            .select("id, source_key, title, exam, year, subject, duration_minutes, source_url, metadata, mock_questions(count)", { count: "exact" })
            .eq("exam", exam)
            .order("year", { ascending: false }).order("id")
          if (filter.trim()) query = query.ilike("title", `%${filter.trim().replace(/[%_\\]/g, "\\$&")}%`)
          const [paperResult, examResult] = await Promise.all([
            query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1),
            supabase.rpc("list_mock_exams"),
          ])
          if (paperResult.error) throw paperResult.error
          if (examResult.error) throw examResult.error
          if (!cancelled) {
            setPapers(paperResult.data as MockPaper[])
            setTotal(paperResult.count ?? 0)
            const available = (examResult.data as { exam: string }[]).map(row => row.exam)
            setExams(Array.from(new Set(["GATE", exam, ...available])).sort())
          }
        } else {
          let query = supabase.from("mock_questions").select("*", { count: "exact" })
            .eq("paper_id", selected.id).order("question_number")
          if (filter.trim()) query = query.ilike("question_text", `%${filter.trim().replace(/[%_\\]/g, "\\$&")}%`)
          const { data, error, count } = await query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
          if (error) throw error
          const rows = data as MockQuestion[]
          const paths = Array.from(new Set(rows.flatMap(q => [...q.images, ...q.options.flatMap(o => o.images)]).map(image => image.path)))
          const signedUrls: Record<string, string> = {}
          let missingImages = false
          // Keep signing requests bounded even for image-heavy papers.
          for (let index = 0; index < paths.length; index += 100) {
            const result = await supabase.storage.from(MOCK_IMAGE_BUCKET).createSignedUrls(paths.slice(index, index + 100), 3600)
            if (result.error) missingImages = true
            for (const image of result.data ?? []) {
              if (image.path && image.signedUrl && !image.error) signedUrls[image.path] = image.signedUrl
              else missingImages = true
            }
          }
          if (!cancelled) { setQuestions(rows); setTotal(count ?? 0); setUrls(signedUrls); setImageWarning(missingImages) }
        }
      } catch (error) {
        if (!cancelled) setError(questionBankError(error && typeof error === "object" && "message" in error ? error as { code?: string; message: string } : { message: "Couldn’t load the question bank. Please try again." }))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [exam, selected, page, filter, revision])

  const selectPaper = (paper: MockPaper | null) => {
    setSelected(paper); setSearch(""); setFilter(""); setPage(0); setLoading(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {selected && <Button variant="ghost" size="sm" className="mb-3 -ml-3" onClick={() => selectPaper(null)}><ArrowLeft />All papers</Button>}
          <h2 className="text-xl font-semibold tracking-tight">{selected ? selected.title : `${exam} question bank`}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {selected ? `${selected.exam} · ${selected.year} · ${selected.duration_minutes} minutes${selected.subject ? ` · ${selected.subject}` : ""}` : "Browse papers, diagrams, and answer keys shared with everyone."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setRevision(value => value + 1)} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} />Refresh</Button>
          <Button size="sm" onClick={() => setGuideOpen(true)}><FileJson />AI import guide</Button>
        </div>
      </div>
      {selected && (selected.source_url || Object.keys(selected.metadata).length > 0) && (
        <div className="space-y-3 text-sm">
          {selected.source_url && /^https?:\/\//i.test(selected.source_url) && <a href={selected.source_url} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-4">Original paper</a>}
          {Object.keys(selected.metadata).length > 0 && <details className="text-muted-foreground"><summary className="cursor-pointer">Paper metadata</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-lg border p-3 text-xs">{JSON.stringify(selected.metadata, null, 2)}</pre></details>}
        </div>
      )}
      <div className="grid max-w-2xl gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor="mock-exam">Exam</Label>
          <Select value={exam} onValueChange={value => { setExam(value); selectPaper(null) }}>
            <SelectTrigger id="mock-exam"><SelectValue placeholder="Select an exam" /></SelectTrigger>
            <SelectContent>{exams.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="mock-search">{selected ? "Search question text" : "Search paper titles"}</Label>
          <Input id="mock-search" placeholder={selected ? "Find a question…" : `e.g. ${exam} 2025`} value={search} onChange={event => setSearch(event.target.value)} />
        </div>
      </div>
      {error ? (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-sm">
          <p className="font-medium">Couldn’t load the question bank</p><p className="mt-2 text-muted-foreground">{error}</p>
        </div>
      ) : loading ? (
        <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading {selected ? "questions" : "papers"}…</div>
      ) : total === 0 ? (
        <Card><CardContent className="py-14 text-center"><BookOpen className="mx-auto mb-4 h-8 w-8 text-muted-foreground" /><h3 className="font-medium">{filter ? "No matches found" : selected ? "No questions yet" : `No ${exam} papers yet`}</h3><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{filter ? "Try a different search." : "Papers added to this exam will appear here for every user."}</p>{!filter && <Button variant="outline" className="mt-5" onClick={() => setGuideOpen(true)}>Open import guide</Button>}</CardContent></Card>
      ) : selected ? (
        <div className="space-y-4">
          {imageWarning && <p role="status" className="text-sm text-muted-foreground">Some images could not be loaded. Refresh to try again.</p>}
          {questions.map(question => <QuestionCard key={`${question.id}-${revision}`} question={question} urls={urls} />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {papers.map(paper => <Card key={paper.id}><CardHeader><div className="mb-2 flex gap-2"><Badge variant="secondary">{paper.year}</Badge><Badge variant="outline">{paper.exam}</Badge></div><CardTitle className="break-words text-base leading-snug">{paper.title}</CardTitle><CardDescription>{paper.subject || "All subjects"}</CardDescription></CardHeader><CardContent><p className="mb-4 text-sm text-muted-foreground">{paper.mock_questions[0]?.count ?? 0} questions · {paper.duration_minutes} min</p><Button variant="outline" className="w-full" onClick={() => selectPaper(paper)}>Browse questions</Button></CardContent></Card>)}
        </div>
      )}
      {!loading && !error && total > 0 && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"><span>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} {selected ? "questions" : "papers"}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft />Previous</Button><Button variant="outline" size="sm" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(page + 1)}>Next<ChevronRight /></Button></div></div>}
      <Dialog open={guideOpen} onOpenChange={setGuideOpen}>
        <DialogContent><DialogHeader><DialogTitle>Import a paper with AI</DialogTitle><DialogDescription>Prepare once, then keep adding papers to your question bank.</DialogDescription></DialogHeader>
          <ol className="list-decimal space-y-3 pl-5 text-sm leading-relaxed"><li>Give your AI the question paper and answer key. Ask it to follow <code className="break-all text-xs">docs/mock-question-bank.md</code> in this project.</li><li>Set the exam to GATE (or another exam) and save diagrams as PNG, JPEG, WebP, or GIF files in the paper folder.</li><li>Run the importer once. Every signed-in user can select that exam to view the questions and images.</li></ol>
          <p className="text-sm text-muted-foreground">The importing account manages its papers. Re-importing updates matching question numbers for everyone and keeps other questions.</p>
          <Button asChild variant="outline"><a href="/mock-paper.example.json" download><Download />Download example JSON</a></Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
