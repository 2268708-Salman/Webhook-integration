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
  fieldName: string;
  fieldValue: string;
};
 
type CompanyDetail = {
  companyId: number;
  companyName: string;
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
 
    const storeHash = process.env.BC_STORE_HASH;
    const bcToken = process.env.BC_API_TOKEN;
    const b2bAuthToken = process.env.BC_B2B_AUTH_TOKEN;
 
    // 1. Fetch Order Details
const orderRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}`, {
      headers: {
        'X-Auth-Token': bcToken!,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!orderRes.ok) throw new Error(`Order API failed: ${orderRes.status}`);
    const order: Order = await orderRes.json();
    console.log('Order Details:', order);
 
    // 2. Fetch Products
const productsRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}/products`, {
      headers: {
        'X-Auth-Token': bcToken!,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!productsRes.ok) throw new Error(`Products API failed: ${productsRes.status}`);
    const products: Product[] = await productsRes.json();
    console.log('Products:', products);
 
    // 3. Fetch Customer
const customerRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/customers/${order.customer_id}`, {
      headers: {
        'X-Auth-Token': bcToken!,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!customerRes.ok) throw new Error(`Customer API failed: ${customerRes.status}`);
    const customer: Customer = await customerRes.json();
    console.log('Customer:', customer);
 
    // 4. Fetch Company Info from B2B API (if company name exists)
    let companyId: number | null = null;
    let e8CompanyId: string | null = null;
 
if (customer.company) {
      const companyRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies?name=${encodeURIComponent(customer.company)}`,
        {
          headers: {
            Authorization: `Bearer ${b2bAuthToken!}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      if (!companyRes.ok) throw new Error(`Company list API failed: ${companyRes.status}`);
 
      const companyListJson = await companyRes.json();
 
      if (!companyListJson?.data || companyListJson.data.length === 0) {
        throw new Error('No company data found for this company name');
      }
 
      const company = companyListJson.data[0];
      companyId = company.companyId;
 
      // Get full company details to fetch extraFields
      const companyDetailRes = await fetch(
`https://api-b2b.bigcommerce.com/api/v3/io/companies/${companyId}`,
        {
          headers: {
            Authorization: `Bearer ${b2bAuthToken!}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        }
      );
      if (!companyDetailRes.ok) throw new Error(`Company detail API failed: ${companyDetailRes.status}`);
 
      const companyDetailJson = await companyDetailRes.json();
      const companyDetail: CompanyDetail = companyDetailJson.data;
 
      const e8Field = companyDetail.extraFields?.find(
        (field) => field.fieldName === 'E8 COMPANY ID'
      );
      e8CompanyId = e8Field?.fieldValue || null;
 
      console.log('Company ID:', companyId);
      console.log('E8 Company ID:', e8CompanyId);
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