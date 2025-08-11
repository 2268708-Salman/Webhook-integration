import { NextRequest, NextResponse } from 'next/server';
 
export async function POST(req: NextRequest) {
  console.log('🚀 Webhook received at:', new Date().toISOString());
 
  try {
    const body = await req.json();
    console.log('📦 Webhook payload:', JSON.stringify(body, null, 2));
 
    const orderId = body?.data?.id;
    console.log('🔍 Order ID:', orderId);
 
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID missing' }, { status: 400 });
    }
 
    const storeHash = process.env.BC_STORE_HASH;
    const token = process.env.BC_API_TOKEN;
    const b2bToken = process.env.BC_B2B_API_TOKEN;
 
    if (!storeHash || !token || !b2bToken) {
      console.error('❌ Missing required BigCommerce credentials');
      return NextResponse.json({ error: 'Missing BigCommerce credentials' }, { status: 500 });
    }
 
    const headers = {
      'X-Auth-Token': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
 
const baseUrl = `https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}`;
 
    // Step 1: Get main order
    console.log('📡 Fetching main order details...');
    const orderRes = await fetch(baseUrl, { headers });
    if (!orderRes.ok) {
      return NextResponse.json({ error: `Order fetch failed: ${orderRes.status}` }, { status: 500 });
    }
    const orderDetails = await orderRes.json();
 
    // Step 2: Get sub-data
    const subEndpoints = ['products', 'fees', 'shipping_addresses', 'consignments', 'coupons'];
    const subData: Record<string, unknown> = {};
 
    await Promise.all(
      subEndpoints.map(async (key) => {
        try {
          const res = await fetch(`${baseUrl}/${key}`, { headers });
          subData[key] = res.ok ? await res.json() : { error: `Failed to fetch ${key}` };
        } catch {
          subData[key] = { error: `Exception while fetching ${key}` };
        }
      })
    );
 
    // Step 3: Get customer details
    const customerId = orderDetails.customer_id;
    let customerDetails = null;
    if (customerId) {
      console.log(`📡 Fetching customer details for ID ${customerId}...`);
      const customerRes = await fetch(
`https://api.bigcommerce.com/stores/${storeHash}/v2/customers/${customerId}`,
        { headers }
      );
      if (customerRes.ok) {
        customerDetails = await customerRes.json();
      }
    }
 
    // Step 4: Get company details from B2B API
    let companyDetails = null;
    let e8CompanyId = null;
    if (customerDetails?.company) {
console.log(`📡 Fetching B2B company info for "${customerDetails.company}"...`);
      const b2bRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies?name=${encodeURIComponent(
customerDetails.company
        )}`,
        {
          headers: {
            'X-Auth-Token': b2bToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
 
      if (b2bRes.ok) {
        const b2bData = await b2bRes.json();
        if (b2bData?.data?.length) {
          companyDetails = b2bData.data[0];
          e8CompanyId = companyDetails?.extraFields?.find(
(field: any) => field.name === 'E8 Company ID'
          )?.value;
        }
      }
    }
 
    // Combine all data
    const fullOrder = {
      ...orderDetails,
      ...subData,
      customer: customerDetails,
      company: companyDetails
        ? {
id: companyDetails.id,
name: companyDetails.name,
            e8CompanyId,
          }
        : null,
    };
 
    console.log('✅ Final Webhook Data:', JSON.stringify(fullOrder, null, 2));
    return NextResponse.json({ message: 'Order processed', order: fullOrder });
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}