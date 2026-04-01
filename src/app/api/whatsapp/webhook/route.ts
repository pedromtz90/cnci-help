import { NextRequest, NextResponse } from 'next/server';
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
  const body = await req.json();

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
