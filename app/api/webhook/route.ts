/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
 
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));
 
    const orderId = body?.data?.id;
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID missing in webhook payload' }, { status: 400 });
    }
 
    // Fetch order details
    const orderRes = await fetch(
`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}`,
      {
        headers: {
          'X-Auth-Token': process.env.BC_ACCESS_TOKEN as string,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    const orderData: any = await orderRes.json();
 
    // Fetch products for the order
    const productsRes = await fetch(
`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}/products`,
      {
        headers: {
          'X-Auth-Token': process.env.BC_ACCESS_TOKEN as string,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    const productsData: any = await productsRes.json();
 
    // Fetch customer details
    const customerRes = await fetch(
`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/customers/${orderData.customer_id}`,
      {
        headers: {
          'X-Auth-Token': process.env.BC_ACCESS_TOKEN as string,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      }
    );
    const customerData: any = await customerRes.json();
 
    // Fetch B2B company details
    const companiesRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies`,
      {
        headers: {
          'X-Auth-Client': process.env.BC_B2B_CLIENT_ID as string,
          'X-Auth-Token': process.env.BC_B2B_ACCESS_TOKEN as string,
          'Content-Type': 'application/json',
        },
      }
    );
    const companiesData: any = await companiesRes.json();
 
    const matchedCompany = companiesData?.data?.find(
      (company: any) =>
        company?.name?.toLowerCase() === customerData?.company?.toLowerCase()
    );
 
    const companyId = matchedCompany?.id || null;
    const e8CompanyId =
matchedCompany?.extraFields?.find((f: any) => f.name === 'E8 Company ID')
        ?.value || null;
 
    console.log('Order:', orderData);
    console.log('Products:', productsData);
    console.log('Customer:', customerData);
    console.log('Company ID:', companyId);
    console.log('E8 Company ID:', e8CompanyId);
 
    return NextResponse.json({
      order: orderData,
      products: productsData,
      customer: customerData,
      companyId,
      e8CompanyId,
    });
  } catch (err) {
    console.error('Error in webhook handler:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}