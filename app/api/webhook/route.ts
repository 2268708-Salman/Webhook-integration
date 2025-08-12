import { NextResponse } from 'next/server';
 
interface OrderResponse {
  id: number;
  customer_id: number;
  coupons?: Array<{ code: string; discount: number }>;
  products: Array<{ name: string; quantity: number; price_inc_tax: number }>;
  fees?: Array<{ name: string; amount: number }>;
}
 
interface CustomerResponse {
  id: number;
  company?: string;
}
 
interface Company {
  id: number;
  name: string;
  extraFields?: Array<{ name: string; value: string }>;
}
 
export async function POST(req: Request) {
  try {
    const body = await req.json();
const orderId: number = body.data.id;
 
    // 1. Fetch Order Details
    const orderRes = await fetch(
`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}?include=products,fees,coupons`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Token': process.env.BC_API_TOKEN ?? '',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
 
    if (!orderRes.ok) {
      throw new Error(`Failed to fetch order: ${orderRes.statusText}`);
    }
 
    const orderData: OrderResponse = await orderRes.json();
    console.log('Order Details:', orderData);
 
    // 2. Fetch Customer Details
    const customerRes = await fetch(
`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/customers/${orderData.customer_id}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Token': process.env.BC_API_TOKEN ?? '',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
 
    if (!customerRes.ok) {
      throw new Error(`Failed to fetch customer: ${customerRes.statusText}`);
    }
 
    const customerData: CustomerResponse = await customerRes.json();
    console.log('Customer Details:', customerData);
 
if (!customerData.company) {
      console.log('No company name found for this customer.');
      return NextResponse.json({ message: 'No company found for customer.' });
    }
 
    // 3. Fetch Company List
    const companyListRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Token': process.env.BC_API_TOKEN ?? '',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
 
    if (!companyListRes.ok) {
      throw new Error(`Failed to fetch companies: ${companyListRes.statusText}`);
    }
 
    const companyList: { data: Company[] } = await companyListRes.json();
 
    const matchedCompany = companyList.data.find(
(c) => c.name.toLowerCase() === customerData.company?.toLowerCase()
    );
 
    if (!matchedCompany) {
      console.log('No matching company found.');
      return NextResponse.json({ message: 'No matching company found.' });
    }
 
    console.log('Matched Company:', matchedCompany);
 
    // 4. Fetch Company Details by ID
    const companyDetailRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies/${matchedCompany.id}`,
      {
        method: 'GET',
        headers: {
          'X-Auth-Token': process.env.BC_API_TOKEN ?? '',
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      }
    );
 
    if (!companyDetailRes.ok) {
      throw new Error(`Failed to fetch company details: ${companyDetailRes.statusText}`);
    }
 
    const companyDetail: Company = await companyDetailRes.json();
 
    const e8Field = companyDetail.extraFields?.find(
(field) => field.name.toLowerCase() === 'e8 company id'
    );
 
console.log('Company ID:', companyDetail.id);
    console.log('E8 Company ID:', e8Field?.value ?? 'Not Found');
 
    return NextResponse.json({
      order: orderData,
      customer: customerData,
      company: {
id: companyDetail.id,
name: companyDetail.name,
        e8CompanyId: e8Field?.value ?? null,
      },
    });
  } catch (error) {
    console.error('Error in webhook handler:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}