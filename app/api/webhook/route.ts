import { NextRequest, NextResponse } from 'next/server';
 
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));
 
    const orderId = body.data?.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID missing from webhook' }, { status: 400 });
    }
 
    const storeHash = process.env.BC_STORE_HASH;
    const apiToken = process.env.BC_API_TOKEN;
    const b2bApiToken = process.env.BC_B2B_API_TOKEN;
 
    if (!storeHash || !apiToken || !b2bApiToken) {
      return NextResponse.json({ error: 'Missing BC_STORE_HASH, BC_API_TOKEN, or BC_B2B_API_TOKEN' }, { status: 500 });
    }
 
    // 1️⃣ Fetch order details (includes products, fees, coupons)
const orderRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}?include=products,fees,coupons`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': apiToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
 
    if (!orderRes.ok) {
      throw new Error(`Failed to fetch order details: ${orderRes.status} ${await orderRes.text()}`);
    }
 
    const order = await orderRes.json();
    console.log('Order details:', JSON.stringify(order, null, 2));
 
    // 2️⃣ Fetch customer details
    if (!order.customer_id) {
      return NextResponse.json({ error: 'Customer ID missing from order' }, { status: 404 });
    }
 
const customerRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/customers/${order.customer_id}`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': apiToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
 
    if (!customerRes.ok) {
      throw new Error(`Failed to fetch customer details: ${customerRes.status} ${await customerRes.text()}`);
    }
 
    const customer = await customerRes.json();
    console.log('Customer details:', JSON.stringify(customer, null, 2));
 
    // 3️⃣ Call B2B API using company name from customer
const companyName = customer.company;
    if (!companyName) {
      return NextResponse.json({ error: 'Company name not found for customer' }, { status: 404 });
    }
 
const companyRes = await fetch(`https://api-b2b.bigcommerce.com/api/v3/io/companies?name=${encodeURIComponent(companyName)}`, {
      method: 'GET',
      headers: {
        'X-Auth-Token': b2bApiToken,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });
 
    if (!companyRes.ok) {
      throw new Error(`Failed to fetch company details: ${companyRes.status} ${await companyRes.text()}`);
    }
 
    const companyData = await companyRes.json();
    const company = companyData?.data?.[0];
 
    if (!company) {
      return NextResponse.json({ error: `Company not found: ${companyName}` }, { status: 404 });
    }
 
const companyId = company.id;
const e8CompanyId = company.extraFields?.find((field: any) => field.name === 'E8CompanyID')?.value || null;
 
    console.log('Company details:', {
      companyId,
      e8CompanyId,
companyName: company.name,
    });
 
    return NextResponse.json({
      success: true,
      order,
      customer,
      company: {
        companyId,
        e8CompanyId,
companyName: company.name,
      },
    });
  } catch (err: any) {
    console.error('Error in webhook handler:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}