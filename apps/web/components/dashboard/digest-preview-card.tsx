"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, Copy, Download } from "lucide-react"
import { useLatestDigest } from "@/lib/api/hooks"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"

export function DigestPreviewCard() {
  const { data: digest, isLoading } = useLatestDigest()
  const { toast } = useToast()

  const handleCopy = async () => {
    if (digest?.markdown) {
      await navigator.clipboard.writeText(digest.markdown)
      toast({
        title: "Copied to clipboard",
        description: "Digest content has been copied to your clipboard.",
      })
    }
  }

  const handleDownload = () => {
    if (digest?.markdown) {
      const blob = new Blob([digest.markdown], { type: "text/markdown" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `digest-${format(new Date(digest.createdAt), "yyyy-MM-dd")}.md`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Latest Digest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!digest) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Latest Digest
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No digest available</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Latest Digest
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              <Copy className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </CardTitle>
        <div className="text-xs text-muted-foreground">{format(new Date(digest.createdAt), "MMMM d, yyyy h:mm a")}</div>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: digest.markdown
                .replace(/^# /gm, '<h3 class="font-semibold text-base mb-2">')
                .replace(/^## /gm, '<h4 class="font-medium text-sm mb-1">')
                .replace(/^\* /gm, "• ")
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\n/g, "<br>"),
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}
