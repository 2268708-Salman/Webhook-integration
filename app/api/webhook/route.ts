import { NextResponse } from "next/server";
 
export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const isTest = searchParams.get("test") === "true";
 
    let orderId: string | undefined;
 
    if (isTest) {
      // Read body from Postman in test mode
      const testBody = await request.json();
      orderId = testBody.orderId;
      console.log("TEST MODE: Using manual orderId:", orderId);
    } else {
      // Read webhook payload
      const body = await request.json();
      console.log("Webhook payload:", body);
      orderId = body?.data?.id;
    }
 
    if (!orderId) {
      return NextResponse.json({ error: "Order ID missing" }, { status: 400 });
    }
 
    const token = process.env.BC_API_TOKEN ?? "";
    const storeHash = process.env.BC_STORE_HASH ?? "";
 
    if (!token || !storeHash) {
      throw new Error("Missing BC_API_TOKEN or BC_STORE_HASH in environment variables.");
    }
 
    // Fetch order details from BigCommerce
    const orderRes = await fetch(
`https://api.bigcommerce.com/stores/${storeHash}/v2/orders/${orderId}`,
      {
        method: "GET",
        headers: {
          "X-Auth-Token": token,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      }
    );
 
    if (!orderRes.ok) {
      const errText = await orderRes.text();
      throw new Error(`Failed to fetch order details: ${orderRes.status} ${errText}`);
    }
 
    const orderData = await orderRes.json();
    console.log("Order Data:", orderData);
 
    return NextResponse.json({
      message: isTest ? "Test mode order fetched successfully" : "Webhook processed successfully",
      order: orderData,
    });
  } catch (err) {
    console.error("Error in webhook handler:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}