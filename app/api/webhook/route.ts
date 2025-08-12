/* eslint-disable no-console */
import { NextResponse } from 'next/server';
 
type Product = {
  name: string;
  sku: string;
  quantity: number;
};
 
type Coupon = {
  code: string;
  discount: number;
};
 
type Fee = {
  name: string;
  amount: number;
};
 
type Order = {
  id: number;
  products: Product[];
  coupons?: Coupon[];
  fees?: Fee[];
  customer_id: number;
};
 
type Customer = {
  id: number;
  company?: string | null;
};
 
type ExtraField = {
  name: string;
  value: string;
};
 
type Company = {
  id: number;
  name: string;
  extraFields?: ExtraField[];
};
 
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Webhook Payload:', body);
 
    const orderId = body.data?.id;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Order ID not found in payload' });
    }
 
    // 1. Fetch Order Details
const orderRes = await fetch(`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}`, {
      headers: {
        'X-Auth-Token': process.env.BC_API_TOKEN as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const order: Order = await orderRes.json();
    console.log('Order Details:', order);
 
    // 2. Fetch Products in the Order
const productsRes = await fetch(`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}/products`, {
      headers: {
        'X-Auth-Token': process.env.BC_API_TOKEN as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const products: Product[] = await productsRes.json();
    console.log('Products:', products);
 
    // 3. Fetch Customer Details
const customerRes = await fetch(`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/customers/${order.customer_id}`, {
      headers: {
        'X-Auth-Token': process.env.BC_API_TOKEN as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    const customer: Customer = await customerRes.json();
    console.log('Customer:', customer);
 
    // 4. If company name exists, get company details
    let company: Company | null = null;
    let companyId: number | null = null;
    let e8CompanyId: string | null = null;
 
if (customer.company) {
      // Find company by name
const companiesRes = await fetch(`https://api-b2b.bigcommerce.com/api/v3/io/companies?name=${encodeURIComponent(customer.company)}`, {
        headers: {
          'X-Auth-Token': process.env.BC_B2B_API_TOKEN as string,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      const companiesData: { data: Company[] } = await companiesRes.json();
      company = companiesData.data?.[0] || null;
 
      if (company?.id) {
companyId = company.id;
 
        // Fetch company by ID to get E8 Company ID
const companyDetailRes = await fetch(`https://api-b2b.bigcommerce.com/api/v3/io/companies/${companyId}`, {
          headers: {
            'X-Auth-Token': process.env.BC_B2B_API_TOKEN as string,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });
        const companyDetail: { data: Company } = await companyDetailRes.json();
 
const e8Field = companyDetail.data.extraFields?.find((field) => field.name === 'E8 Company ID');
        e8CompanyId = e8Field?.value || null;
      }
    }
 
    return NextResponse.json({
      success: true,
      order,
      products,
      customer,
      companyId,
      e8CompanyId,
    });
  } catch (error) {
    console.error('Error in webhook:', error);
    return NextResponse.json({ success: false, error: (error as Error).message });
  }
}