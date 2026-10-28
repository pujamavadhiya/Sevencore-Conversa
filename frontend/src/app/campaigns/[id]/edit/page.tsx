"use client";

import React from "react";
import { useParams } from "next/navigation";
import CampaignEditor from "@/components/CampaignEditor";

export default function EditCampaignPage() {
  const params = useParams();
  const rawId = params?.id;
  const campaignId = rawId ? Number(rawId) : undefined;

  return <CampaignEditor mode="edit" campaignId={campaignId} />;
}

