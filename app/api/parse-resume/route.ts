import { NextRequest, NextResponse } from 'next/server'
import { PDFParse } from 'pdf-parse'
import { parseResume } from '@/lib/resume-llm'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are supported' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText({
      parseHyperlinks: true,
      lineEnforce: true,
      lineThreshold: 3.2,
      cellSeparator: ' | ',
      cellThreshold: 6,
      pageJoiner: '',
    })
    await parser.destroy()

    const text = result.text.trim()
    const { profile, parsedBy } = await parseResume(text)

    return NextResponse.json({ text, profile, filename: file.name, parsedBy })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to parse PDF'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
