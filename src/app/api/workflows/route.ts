import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { runWorkflow } from '@/lib/workflows/mastra';

const WorkflowSchema = z.object({
  workflow: z.enum(['no-answer', 'payment', 'enrollment', 'repeated-failure']),
  data: z.record(z.any()),
});

export async function POST(req: NextRequest) {
  let body: z.infer<typeof WorkflowSchema>;
  try {
    body = WorkflowSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'Workflow y data requeridos.' }, { status: 400 });
  }

  const result = await runWorkflow(body.workflow, body.data as any);
  return NextResponse.json(result);
}
