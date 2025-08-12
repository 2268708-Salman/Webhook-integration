import { NextResponse } from 'next/server';
 
export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();
 
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }
 
const url = `https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}`;
 
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-Auth-Token': process.env.BC_API_TOKEN as string,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
 
    const rawText = await response.text();
    let orderData;
 
    try {
      orderData = JSON.parse(rawText);
    } catch {
      console.error('Received non-JSON response:', rawText);
      return NextResponse.json({ error: 'Non-JSON response from BigCommerce', rawText }, { status: 500 });
    }
 
    return NextResponse.json({ orderData });
 
  } catch (err) {
    console.error('Error in webhook handler:', err);
    return NextResponse.json({ error: 'Internal server error', details: String(err) }, { status: 500 });
  }
}