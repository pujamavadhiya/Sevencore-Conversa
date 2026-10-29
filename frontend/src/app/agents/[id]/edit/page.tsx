"use client";

import React from "react";
import { useParams } from "next/navigation";
import AgentEditor from "@/components/AgentEditor";

export default function EditAgentPage() {
  const params = useParams();
  const rawId = params?.id;
  const agentId = rawId ? Number(rawId) : undefined;

  return <AgentEditor mode="edit" agentId={agentId} />;
}

