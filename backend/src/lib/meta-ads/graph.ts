const GRAPH_API_URL = "https://graph.facebook.com/v22.0";

export interface MetaLeadgenDetail {
  id: string;
  created_time?: string;
  field_data?: Array<{ name: string; values: string[] }>;
  ad_id?: string;
  adset_id?: string;
  form_id?: string;
  campaign_id?: string;
}

export async function fetchMetaLeadgenDetail(
  leadgenId: string,
  accessToken: string
): Promise<MetaLeadgenDetail> {
  const response = await fetch(`${GRAPH_API_URL}/${leadgenId}?access_token=${accessToken}`);
  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Meta leadgen fetch failed: ${response.status} ${err}`);
  }
  return (await response.json()) as MetaLeadgenDetail;
}
