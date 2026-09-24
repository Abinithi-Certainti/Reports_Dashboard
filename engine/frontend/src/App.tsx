import { useEffect, useState } from 'react';
import { AppBar, Box, Card, CardActionArea, CardContent, Container, Toolbar, Typography } from '@mui/material';
import { api, ReportSummary } from './api';
import ReportPage from './ReportPage';

// Tiny hash router: "#/tender-report" opens that report, anything else shows the list.
function useHashRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash.replace(/^#\/?/, '');
}

export default function App() {
  const route = useHashRoute();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api.reports().then(setReports).catch((e) => setError(String(e)));
  }, []);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="primary" elevation={0}>
        <Toolbar variant="dense" sx={{ gap: 2 }}>
          <Typography component="a" href="#/" sx={{ color: 'inherit', textDecoration: 'none', fontWeight: 650 }}>
            Reports
          </Typography>
          {route && (
            <Typography sx={{ opacity: 0.8 }}>/ {reports.find((r) => r.id === route)?.title ?? route}</Typography>
          )}
        </Toolbar>
      </AppBar>
      {route ? (
        <ReportPage reportId={route} />
      ) : (
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Typography variant="h1" gutterBottom>
            Reports
          </Typography>
          {error && <Typography color="error">{error}</Typography>}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 2 }}>
            {reports.map((r) => (
              <Card key={r.id}>
                <CardActionArea href={`#/${r.id}`}>
                  <CardContent>
                    <Typography variant="h2">{r.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {r.subtitle}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            ))}
          </Box>
        </Container>
      )}
    </Box>
  );
}
