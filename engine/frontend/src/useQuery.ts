import { useEffect, useState } from 'react';
import { api, QueryRequest, Row } from './api';

/** Runs a report query whenever the request changes; ignores answers to requests that are no longer current. */
export function useQuery(reportId: string, request: QueryRequest | null) {
  const [rows, setRows] = useState<Row[]>();
  const [error, setError] = useState<string>();
  const key = request ? JSON.stringify(request) : '';

  useEffect(() => {
    if (!request) return;
    let current = true;
    setError(undefined);
    api
      .query(reportId, request)
      .then((r) => current && setRows(r))
      .catch((e) => current && setError(String(e)));
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, key]);

  return { rows, error, loading: !rows && !error };
}
