import { Box, Chip, Container, Paper, Typography } from '@mui/material';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import AccountTreeRoundedIcon from '@mui/icons-material/AccountTreeRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { ReportSummary } from '../api';
import { useTokens } from '../theme';
import { useSound } from '../sound';

/** Overview: what the engine holds, and a card per report. */
export default function HomePage({ reports, search }: { reports: ReportSummary[]; search: string }) {
  const t = useTokens();
  const sound = useSound();
  const shown = reports.filter((r) => `${r.title} ${r.subtitle ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  const imported = reports.filter((r) => r.imported).length;

  const stats = [
    { label: 'Reports live', value: String(reports.length), hint: `${imported} added by upload` },
    { label: 'Power BI reports to migrate', value: '< 50', hint: '1 extracted so far' },
    { label: 'Fields mapped (Tender)', value: '19', hint: '18 automatic · 1 to confirm' },
    { label: 'Code changes per new report', value: '0', hint: 'one settings file + one SQL file' },
  ];

  return (
    <Container maxWidth={false} sx={{ py: 3, maxWidth: 1500 }}>
      <Typography variant="h1" sx={{ color: t.textPrimary }}>Overview</Typography>
      <Typography sx={{ color: t.textSecondary, mb: 3 }}>Every report runs on the same engine, from its own settings file.</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
        {stats.map((s, i) => (
          <Paper key={s.label} sx={{ p: 2.25, animation: 'rise .55s ease both', animationDelay: `${i * 70}ms`, '@keyframes rise': { from: { opacity: 0, transform: 'translateY(10px)' }, to: { opacity: 1, transform: 'none' } } }}>
            <Typography variant="h2" sx={{ fontSize: '0.68rem' }}>{s.label}</Typography>
            <Typography sx={{ fontFamily: t.mono, fontSize: '2rem', fontWeight: 650, color: t.textPrimary, textShadow: t.glow ? `0 0 22px ${t.glow}` : 'none' }}>
              {s.value}
            </Typography>
            <Typography sx={{ fontSize: '0.8rem', color: t.textMuted }}>{s.hint}</Typography>
          </Paper>
        ))}
      </Box>

      <Typography variant="h2" sx={{ mb: 1.5 }}>Reports</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fill, minmax(320px, 1fr))' }, gap: 2, mb: 3 }}>
        {shown.map((r, i) => (
          <Paper
            key={r.id}
            component="a"
            href={`#/r/${r.id}`}
            onClick={() => sound.play('click')}
            sx={{
              p: 2.5, display: 'block', textAlign: 'left', width: '100%', textDecoration: 'none', cursor: 'pointer',
              animation: 'rise .55s ease both', animationDelay: `${200 + i * 80}ms`,
              '&:hover': { transform: 'translateY(-3px)', borderColor: t.panelBorderHover, boxShadow: t.glow ? `0 12px 30px -12px ${t.glow}` : undefined },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}>
              <Box sx={{ width: 40, height: 40, borderRadius: '12px', display: 'grid', placeItems: 'center', bgcolor: `${t.accent}1f`, color: t.accent }}>
                <InsightsRoundedIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, color: t.textPrimary }}>{r.title}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: t.textSecondary }}>{r.subtitle}</Typography>
              </Box>
              <ArrowForwardRoundedIcon sx={{ color: t.textMuted }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Chip size="small" label={`${r.visuals} visuals`} sx={{ bgcolor: t.mode === 'light' ? '#f1f5f9' : 'rgba(148,163,184,0.10)', color: t.textSecondary }} />
              <Chip
                size="small"
                label={r.imported ? 'Added by upload' : 'Built in'}
                sx={{ bgcolor: r.imported ? `${t.good}22` : `${t.accent}1a`, color: r.imported ? t.good : t.accent }}
              />
            </Box>
          </Paper>
        ))}
        {shown.length === 0 && <Typography sx={{ color: t.textMuted }}>No report matches “{search}”.</Typography>}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        {[
          { href: '#/mapping', icon: <AccountTreeRoundedIcon />, title: 'Mapping Studio', text: 'See how every old SQL Server field maps to the new PostgreSQL field.' },
          { href: '#/import', icon: <CloudUploadRoundedIcon />, title: 'Import a report', text: 'Upload a settings file and its SQL. It is checked safely, then goes live - no code change.' },
        ].map((c) => (
          <Paper key={c.href} component="a" href={c.href} onClick={() => sound.play('click')} sx={{ p: 2.5, display: 'flex', gap: 2, justifyContent: 'flex-start', textAlign: 'left', textDecoration: 'none', cursor: 'pointer' }}>
            <Box sx={{ width: 44, height: 44, borderRadius: '12px', display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${t.series1}, ${t.series1Light})`, color: '#fff', flexShrink: 0 }}>
              {c.icon}
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, color: t.textPrimary }}>{c.title}</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: t.textSecondary }}>{c.text}</Typography>
            </Box>
          </Paper>
        ))}
      </Box>
    </Container>
  );
}
