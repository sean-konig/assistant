'use client';

import { api } from './axios';

export type IngestManualReq = {
  projectId: string;
  kind: 'NOTE' | 'TASK' | 'DOC';
  title?: string;
  body?: string;
  raw?: Record<string, any>;
  occurredAt?: string; // ISO string
};

export type IngestManualRes = { id: string };

export const IngestApi = {
  manual: async (payload: IngestManualReq) => (await api.post<IngestManualRes>('/ingest/manual', payload)).data,
};

