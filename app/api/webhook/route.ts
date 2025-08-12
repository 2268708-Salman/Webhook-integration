import { NextRequest, NextResponse } from 'next/server';
 
interface OrderProduct {
  name: string;
  quantity: number;
  price_inc_tax: number;
}
 
interface OrderDetails {
  id: number;
  customer_id: number;
  products: OrderProduct[];
  fees: unknown[];
  coupons: unknown[];
}
 
interface CustomerDetails {
  id: number;
  company?: string;
}
 
interface CompanyExtraField {
  name: string;
  value: string;
}
 
interface CompanyDetails {
  id: number;
  name: string;
  extraFields?: CompanyExtraField[];
}
 
const STORE_HASH = process.env.BC_STORE_HASH;
const API_TOKEN = process.env.BC_API_TOKEN;
const B2B_API_TOKEN = process.env.BC_B2B_API_TOKEN;
 
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const orderId = body.data?.id;
 
    if (!orderId) {
      return NextResponse.json({ error: 'Missing order ID from webhook payload' }, { status: 400 });
    }
 
    // 1. Fetch order details
    const orderRes = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders/${orderId}`,
      {
        headers: { 'X-Auth-Token': API_TOKEN!, 'Accept': 'application/json' },
      }
    );
    if (!orderRes.ok) throw new Error(`Order fetch failed: ${orderRes.status}`);
    const order: OrderDetails = await orderRes.json();
 
    // Fetch products, fees, coupons
    const productsRes = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders/${orderId}/products`,
      {
        headers: { 'X-Auth-Token': API_TOKEN!, 'Accept': 'application/json' },
      }
    );
    const products: OrderProduct[] = await productsRes.json();
 
    const feesRes = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders/${orderId}/shipping_addresses`,
      {
        headers: { 'X-Auth-Token': API_TOKEN!, 'Accept': 'application/json' },
      }
    );
    const fees = await feesRes.json();
 
    const couponsRes = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v2/orders/${orderId}/coupons`,
      {
        headers: { 'X-Auth-Token': API_TOKEN!, 'Accept': 'application/json' },
      }
    );
    const coupons = await couponsRes.json();
 
    // 2. Fetch customer details
    const customerRes = await fetch(
`https://api.bigcommerce.com/stores/${STORE_HASH}/v2/customers/${order.customer_id}`,
      {
        headers: { 'X-Auth-Token': API_TOKEN!, 'Accept': 'application/json' },
      }
    );
    if (!customerRes.ok) throw new Error(`Customer fetch failed: ${customerRes.status}`);
    const customer: CustomerDetails = await customerRes.json();
 
if (!customer.company) {
      return NextResponse.json({ error: 'Customer does not have a company name' }, { status: 404 });
    }
 
    // 3. Fetch all companies from B2B API
    const companyListRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies`,
      {
        headers: {
          'X-Auth-Token': B2B_API_TOKEN!,
          'Accept': 'application/json',
        },
      }
    );
    if (!companyListRes.ok) throw new Error(`Company list fetch failed: ${companyListRes.status}`);
    const companyListData = await companyListRes.json();
    const companies: CompanyDetails[] = companyListData.data || [];
 
    const matchedCompany = companies.find(
(comp) => comp.name.toLowerCase() === customer.company!.toLowerCase()
    );
 
    if (!matchedCompany) {
      return NextResponse.json({ error: 'No matching company found' }, { status: 404 });
    }
 
    // 4. Fetch single company details using company_id
    const companyDetailRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies/${matchedCompany.id}`,
      {
        headers: {
          'X-Auth-Token': B2B_API_TOKEN!,
          'Accept': 'application/json',
        },
      }
    );
    if (!companyDetailRes.ok) throw new Error(`Company details fetch failed: ${companyDetailRes.status}`);
    const companyDetailData = await companyDetailRes.json();
    const companyDetails: CompanyDetails = companyDetailData.data;
 
    const e8Field = companyDetails.extraFields?.find(
(field) => field.name.toLowerCase() === 'e8 company id'
    );
 
    return NextResponse.json({
orderId: order.id,
      customerId: order.customer_id,
      products,
      fees,
      coupons,
companyId: companyDetails.id,
      e8CompanyId: e8Field?.value || null,
    });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}