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
 
    // Fetch Order Details
    const orderRes = await fetch(`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}`, {
      headers: {
        'X-Auth-Token': process.env.BC_API_TOKEN as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!orderRes.ok) throw new Error('Failed to fetch order details');
    const order: Order = await orderRes.json();
    console.log('Order Details:', order);
 
    // Fetch Products
    const productsRes = await fetch(`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/orders/${orderId}/products`, {
      headers: {
        'X-Auth-Token': process.env.BC_API_TOKEN as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!productsRes.ok) throw new Error('Failed to fetch order products');
    const products: Product[] = await productsRes.json();
    console.log('Products:', products);
 
    // Fetch Customer
    const customerRes = await fetch(`https://api.bigcommerce.com/stores/${process.env.BC_STORE_HASH}/v2/customers/${order.customer_id}`, {
      headers: {
        'X-Auth-Token': process.env.BC_API_TOKEN as string,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
    if (!customerRes.ok) throw new Error('Failed to fetch customer details');
    const customer: Customer = await customerRes.json();
    console.log('Customer:', customer);
 
    // Fetch Company from B2B API using customer.company name
    let companyId: number | null = null;
    // let e8CompanyId: string | null = null;
 
    if (customer.company) {
      const companyRes = await fetch(`https://api-b2b.bigcommerce.com/api/v3/io/companies?name=${encodeURIComponent(customer.company)}`, {
        headers: {
          Authorization: `Bearer ${process.env.BC_B2B_AUTH_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
      });
      if (!companyRes.ok) throw new Error('Failed to fetch company list');
      const companiesList = await companyRes.json();
 
      const companyData = companiesList.data?.[0];
      if (companyData?.companyId) {
        companyId = companyData.companyId;
 
        // Fetch company detail by ID to get E8 Company ID
        const companyDetailRes = await fetch(`https://api-b2b.bigcommerce.com/api/v3/io/companies/${companyId}`, {
          headers: {
            Authorization: `Bearer ${process.env.BC_B2B_AUTH_TOKEN}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
        });
        if (!companyDetailRes.ok) throw new Error('Failed to fetch company details');
 
        const companyDetailJson = await companyDetailRes.json();
        const companyDetail: CompanyDetail = companyDetailJson.data;
 
        // const e8Field = companyDetail.extraFields?.find(field => field.fieldName === 'E8 COMPANY ID');
        // e8CompanyId = e8Field?.fieldValue || null;
        // console.log('E8 Company ID:', e8CompanyId);
      }
    }
 
    return NextResponse.json({
      success: true,
      order,
      products,
      customer,
      companyId,
    //   e8CompanyId,
    });
 
  } catch (error) {
    console.error('Error in webhook:', error);
    return NextResponse.json({ success: false, error: (error as Error).message });
  }
}
 