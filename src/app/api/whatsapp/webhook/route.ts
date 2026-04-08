import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { processChat } from '@/lib/chat/engine';
import { getConfig } from '@/lib/settings/service';

// GET — Meta webhook verification
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get('hub.mode');
  const token = req.nextUrl.searchParams.get('hub.verify_token');
  const challenge = req.nextUrl.searchParams.get('hub.challenge');

  const verifyToken = getConfig('whatsapp_verify_token') || process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

// POST — Incoming WhatsApp messages
export async function POST(req: NextRequest) {
  // BUG-12 FIX: Verify webhook signature from Meta
  const rawBody = await req.text();
  const appSecret = process.env.WHATSAPP_APP_SECRET || getConfig('whatsapp_app_secret');
  if (appSecret) {
    const signature = req.headers.get('x-hub-signature-256');
    if (!signature) {
      console.warn('[whatsapp] Missing X-Hub-Signature-256 header');
      return new Response('Unauthorized', { status: 401 });
    }
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
    if (signature !== expected) {
      console.warn('[whatsapp] Invalid webhook signature');
      return new Response('Unauthorized', { status: 401 });
    }
  } else {
    console.warn('[whatsapp] WHATSAPP_APP_SECRET not configured — skipping signature verification (INSECURE)');
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Always return 200 immediately
  const messages = body?.entry?.[0]?.changes?.[0]?.value?.messages;
  if (!messages?.length) {
    return NextResponse.json({ status: 'no_messages' });
  }

  const phoneNumberId = body?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
  const accessToken = getConfig('whatsapp_access_token') || process.env.WHATSAPP_ACCESS_TOKEN;

  // Process each message (don't await — respond to Meta quickly)
  for (const msg of messages) {
    if (msg.type !== 'text') continue;

    const from = msg.from; // sender phone number
    const text = msg.text.body;

    // Process through chat engine (now includes Nexus tools)
    processChat({
      message: text,
      mode: 'support',
      locale: 'es',
      context: { phone: from },
    }).then(async (response) => {
      // Send response back via WhatsApp
      if (accessToken && phoneNumberId) {
        await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: from,
            type: 'text',
            text: { body: response.content },
          }),
        });
      }
    }).catch(err => {
      console.error('[whatsapp] Processing error:', err);
    });
  }

  return NextResponse.json({ status: 'ok' });
}
