import { throwGraphApiError } from "../whatsapp/client.js";
import type { CatalogProduct, MetaCatalogSummary } from "../../types/index.js";

const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

interface MetaProductResponse {
  id?: string;
}

export async function listMetaCatalogs(
  wabaId: string,
  accessToken: string
): Promise<MetaCatalogSummary[]> {
  const response = await fetch(
    `${GRAPH_API_URL}/${wabaId}/product_catalogs?fields=id,name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    const body = await response.text();
    throwGraphApiError(response.status, body);
  }
  const json = (await response.json()) as { data?: MetaCatalogSummary[] };
  return json.data ?? [];
}

export async function createMetaProduct(params: {
  catalogId: string;
  accessToken: string;
  product: CatalogProduct;
  imageUrl?: string;
}): Promise<string | undefined> {
  const body: Record<string, unknown> = {
    retailer_id: params.product.retailerId,
    name: params.product.name,
    description: params.product.description,
    price: params.product.priceInCents,
    currency: params.product.currency,
    availability: params.product.availability === "in_stock" ? "in stock" : "out of stock",
  };
  if (params.imageUrl) {
    body.image_url = params.imageUrl;
  }

  const response = await fetch(
    `${GRAPH_API_URL}/${params.catalogId}/products`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throwGraphApiError(response.status, text);
  }

  const json = (await response.json()) as MetaProductResponse;
  return json.id;
}

export async function updateMetaProduct(params: {
  catalogId: string;
  retailerId: string;
  accessToken: string;
  product: CatalogProduct;
  imageUrl?: string;
}): Promise<void> {
  const body: Record<string, unknown> = {
    name: params.product.name,
    description: params.product.description,
    price: params.product.priceInCents,
    currency: params.product.currency,
    availability: params.product.availability === "in_stock" ? "in stock" : "out of stock",
  };
  if (params.imageUrl) {
    body.image_url = params.imageUrl;
  }

  const response = await fetch(
    `${GRAPH_API_URL}/${params.catalogId}/products`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...body,
        retailer_id: params.retailerId,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throwGraphApiError(response.status, text);
  }
}

export async function deleteMetaProduct(params: {
  catalogId: string;
  retailerId: string;
  accessToken: string;
}): Promise<void> {
  const response = await fetch(
    `${GRAPH_API_URL}/${params.catalogId}/products`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        retailer_id: params.retailerId,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throwGraphApiError(response.status, text);
  }
}
