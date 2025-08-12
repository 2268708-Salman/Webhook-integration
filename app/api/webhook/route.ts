import { NextResponse } from 'next/server';
 
export async function POST(req: Request) {
  try {
    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));
 
    const orderId = body?.data?.id;
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing order ID' });
    }
 
    const storeHash = process.env.BC_STORE_HASH;
    const accessToken = process.env.BC_API_TOKEN;
    const b2bToken = process.env.BC_B2B_TOKEN;
 
    if (!storeHash || !accessToken || !b2bToken) {
      return NextResponse.json({ success: false, error: 'Missing BC API credentials' });
    }
 
    // 1️⃣ Fetch order details
    const orderRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}`, {
      headers: {
        'X-Auth-Token': accessToken,
        'Accept': 'application/json'
      }
    });
    const orderData = await orderRes.json();
    console.log('Order Data:', orderData);
 
    // 2️⃣ Fetch products/items for this order
    const productsRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}/products`, {
      headers: {
        'X-Auth-Token': accessToken,
        'Accept': 'application/json'
      }
    });
    const productsData = await productsRes.json();
    console.log('Products Data:', productsData);
 
    // 3️⃣ Fetch customer details
    const customerId = orderData?.customer_id;
    let customerData: any = null;
    if (customerId) {
      const customerRes = await fetch(`https://api.bigcommerce.com/stores/${storeHash}/v2/customers/${customerId}`, {
        headers: {
          'X-Auth-Token': accessToken,
          'Accept': 'application/json'
        }
      });
      customerData = await customerRes.json();
      console.log('Customer Data:', customerData);
    }
 
    const companyName = customerData?.company || '';
    if (!companyName) {
      console.warn('⚠️ No company name found for this customer.');
      return NextResponse.json({
        success: true,
        message: 'No company linked to customer',
        order: orderData,
        products: productsData
      });
    }
 
    // 4️⃣ Fetch list of companies from B2B API
    const companiesRes = await fetch(`https://api-b2b.bigcommerce.com/api/v3/io/companies`, {
      headers: {
        'X-Auth-Token': b2bToken,
        'Accept': 'application/json'
      }
    });
    const companyData = await companiesRes.json();
    console.log('Companies API Response:', companyData);
 
    const companies = companyData?.data || [];
    if (!Array.isArray(companies) || companies.length === 0) {
      console.error('❌ No companies returned from B2B API');
      return NextResponse.json({ success: false, error: 'No companies returned' });
    }
 
    const matchedCompany = companies.find(
      (c: any) => c?.name?.toLowerCase() === companyName?.toLowerCase()
    );
 
    if (!matchedCompany) {
      console.error(`❌ Company not found for name: ${companyName}`);
      return NextResponse.json({
        success: false,
        error: `Company not found: ${companyName}`
      });
    }
 
    // 5️⃣ Fetch specific company details
    const companyDetailsRes = await fetch(
      `https://api-b2b.bigcommerce.com/api/v3/io/companies/${matchedCompany.id}`,
      {
        headers: {
          'X-Auth-Token': b2bToken,
          'Accept': 'application/json'
        }
      }
    );
    const companyDetails = await companyDetailsRes.json();
    console.log('Matched Company Details:', companyDetails);
 
    const e8CompanyId = companyDetails?.data?.extraFields?.E8CompanyID || null;
 
    return NextResponse.json({
      success: true,
      order: orderData,
      products: productsData,
      customer: customerData,
      matchedCompany: {
        id: matchedCompany.id,
        name: matchedCompany.name,
        e8CompanyId
      }
    });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}
 