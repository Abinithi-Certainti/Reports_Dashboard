import { Fragment, useEffect, useState } from 'react';
import { Alert, Box, Chip, CircularProgress, Container, Paper, Tooltip, Typography } from '@mui/material';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HelpRoundedIcon from '@mui/icons-material/HelpRounded';
import { api, Mapping, ReportSummary } from '../api';
import { Tokens, useTokens } from '../theme';

const STEPS = [
  { n: 1, title: 'Extract', text: 'Read the old report with 5 read-only queries' },
  { n: 2, title: 'Auto-match', text: 'Old names converted by rule: PaymentTypeName → payment_type_name' },
  { n: 3, title: 'Check exists', text: 'Every new field is looked up in the new database structure' },
  { n: 4, title: 'Review leftovers', text: 'Anything the rule cannot prove goes to a person - never guessed' },
  { n: 5, title: 'Go live', text: 'The report spec uses only confirmed new names' },
];

/** A flowing line between the old and new field, with the match method in the middle. */
function Connector({ t, method, delay }: { t: Tokens; method: string; delay: number }) {
  const review = method === 'manual';
  const colour = review ? '#f59e0b' : t.accent;
  return (
    <Box sx={{ position: 'relative', height: 34, display: 'flex', alignItems: 'center' }}>
      <Box
        component="svg"
        viewBox="0 0 200 20"
        preserveAspectRatio="none"
        aria-hidden
        sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
      >
        <path d="M0 10 C 60 10, 60 10, 100 10 S 140 10, 200 10" stroke={colour} strokeOpacity="0.25" strokeWidth="2" fill="none" />
        <Box
          component="path"
          d="M0 10 C 60 10, 60 10, 100 10 S 140 10, 200 10"
          stroke={colour}
          strokeWidth="2"
          fill="none"
          strokeDasharray="6 10"
          sx={{
            animation: `flow 1.4s linear infinite, drawIn .8s ease ${delay}ms both`,
            '@keyframes flow': { to: { strokeDashoffset: -32 } },
            '@keyframes drawIn': { from: { opacity: 0 }, to: { opacity: 1 } },
            filter: t.glow ? `drop-shadow(0 0 4px ${colour})` : 'none',
          }}
        />
      </Box>
      <Tooltip title={review ? 'The naming rule does not produce this name on its own - a person must confirm it' : 'Old name converted to snake_case and found in the new database'}>
        <Chip
          size="small"
          icon={review ? <HelpRoundedIcon /> : <CheckCircleRoundedIcon />}
          label={review ? 'Review' : 'Auto'}
          sx={{
            mx: 'auto', position: 'relative', height: 22, fontSize: '0.7rem', fontWeight: 650,
            bgcolor: t.panelSolid, border: `1px solid ${colour}`, color: colour, '& .MuiChip-icon': { color: colour, fontSize: 14 },
          }}
        />
      </Tooltip>
    </Box>
  );
}

function FieldPill({ t, name, sub, side }: { t: Tokens; name: string; sub?: string; side: 'old' | 'new' }) {
  return (
    <Box
      sx={{
        px: 1.5, py: 0.75, borderRadius: '10px', border: `1px solid ${t.panelBorder}`,
        background: side === 'new' ? `${t.accent}12` : t.mode === 'light' ? '#f8fafc' : 'rgba(148,163,184,0.06)',
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, minWidth: 0,
      }}
    >
      <Typography sx={{ fontFamily: t.mono, fontSize: '0.82rem', color: t.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </Typography>
      {sub && <Typography sx={{ fontSize: '0.68rem', color: t.textMuted, whiteSpace: 'nowrap' }}>{sub}</Typography>}
    </Box>
  );
}

export default function MappingStudio({ reportId, reports }: { reportId: string; reports: ReportSummary[] }) {
  const t = useTokens();
  const [m, setM] = useState<Mapping>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    setM(undefined);
    setError(undefined);
    api.mapping(reportId).then(setM).catch(() => setError(`No field mapping recorded yet for "${reportId}".`));
  }, [reportId]);

  const all = m?.tables.flatMap((tb) => tb.columns) ?? [];
  const auto = all.filter((c) => c.method !== 'manual').length;
  const review = all.length - auto;

  return (
    <Container maxWidth={false} sx={{ py: 3, maxWidth: 1500 }}>
      <Typography variant="h1" sx={{ color: t.textPrimary }}>Mapping Studio</Typography>
      <Typography sx={{ color: t.textSecondary, mb: 2.5 }}>
        How each field in the old SQL Server report maps to the new PostgreSQL database.
        {reports.length > 1 && ' Mapping is recorded per migrated report.'}
      </Typography>

      {/* how it works */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(5, 1fr)' }, gap: 1.5, mb: 3 }}>
        {STEPS.map((s, i) => (
          <Paper key={s.n} sx={{ p: 1.75, position: 'relative', animation: 'rise .5s ease both', animationDelay: `${i * 90}ms`, '@keyframes rise': { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Box sx={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${t.series1}, ${t.series1Light})` }}>
                {s.n}
              </Box>
              <Typography sx={{ fontWeight: 700, color: t.textPrimary, fontSize: '0.9rem' }}>{s.title}</Typography>
            </Box>
            <Typography sx={{ fontSize: '0.78rem', color: t.textSecondary }}>{s.text}</Typography>
          </Paper>
        ))}
      </Box>

      {error && <Alert severity="info">{error}</Alert>}
      {!m && !error && <Box sx={{ display: 'grid', placeItems: 'center', py: 8 }}><CircularProgress /></Box>}

      {m && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
            {[
              { label: 'Report', value: m.report, mono: false },
              { label: 'Tables mapped', value: String(m.tables.length), mono: true },
              { label: 'Fields matched automatically', value: `${auto} / ${all.length}`, mono: true },
              { label: 'Waiting for a person', value: String(review), mono: true },
            ].map((s) => (
              <Paper key={s.label} sx={{ p: 2 }}>
                <Typography variant="h2" sx={{ fontSize: '0.68rem' }}>{s.label}</Typography>
                <Typography sx={{ fontFamily: s.mono ? t.mono : undefined, fontSize: s.mono ? '1.8rem' : '1.25rem', fontWeight: 650, color: t.textPrimary, mt: 0.5 }}>
                  {s.value}
                </Typography>
              </Paper>
            ))}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' }, gap: 2, mb: 3 }}>
            {m.tables.map((tb, ti) => (
              <Paper key={tb.old_table} sx={{ p: 2.25 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <StorageRoundedIcon sx={{ color: t.textMuted, fontSize: 18 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: t.textMuted, letterSpacing: '0.1em' }}>SQL SERVER · {m.source.schema}</Typography>
                      <Typography sx={{ fontFamily: t.mono, fontWeight: 650, color: t.textPrimary, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tb.old_table}</Typography>
                    </Box>
                  </Box>
                  <Typography sx={{ textAlign: 'center', color: t.accent, fontSize: '1.2rem' }} aria-hidden>→</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                    <StorageRoundedIcon sx={{ color: t.accent, fontSize: 18 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.66rem', color: t.textMuted, letterSpacing: '0.1em' }}>POSTGRESQL · {m.target.schema}</Typography>
                      <Typography sx={{ fontFamily: t.mono, fontWeight: 650, color: t.textPrimary, fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tb.new_table}</Typography>
                    </Box>
                  </Box>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr', rowGap: 0.75, columnGap: 1, alignItems: 'center' }}>
                  {tb.columns.map((c, ci) => (
                    <Fragment key={c.old_column}>
                      <FieldPill t={t} name={c.old_column} side="old" />
                      <Connector t={t} method={c.method} delay={ti * 120 + ci * 60} />
                      <FieldPill t={t} name={c.new_column} sub={c.new_type.replace('character varying', 'text').replace(' without time zone', '')} side="new" />
                    </Fragment>
                  ))}
                </Box>
              </Paper>
            ))}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2 }}>
            <Paper sx={{ p: 2.25 }}>
              <Typography variant="h2" sx={{ mb: 1.5 }}>Hidden business rules carried over</Typography>
              {m.rules.map((r) => (
                <Box key={r.rule} sx={{ display: 'flex', gap: 1.25, py: 1, borderTop: `1px solid ${t.panelBorder}` }}>
                  <Chip size="small" label={r.decision} sx={{ height: 20, fontSize: '0.68rem', bgcolor: r.decision === 'keep' ? `${t.good}22` : '#f59e0b22', color: r.decision === 'keep' ? t.good : '#f59e0b', flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontSize: '0.86rem', color: t.textPrimary }}>{r.rule}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: t.textMuted }}>Found in: {r.found_in}</Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
            <Paper sx={{ p: 2.25 }}>
              <Typography variant="h2" sx={{ mb: 1.5 }}>Findings in the old report</Typography>
              {m.findings.map((f) => (
                <Box key={f.finding} sx={{ display: 'flex', gap: 1.25, py: 1, borderTop: `1px solid ${t.panelBorder}` }}>
                  <Chip
                    size="small"
                    label={f.severity}
                    sx={{
                      height: 20, fontSize: '0.68rem', flexShrink: 0, textTransform: 'capitalize',
                      bgcolor: f.severity === 'high' ? `${t.bad}22` : f.severity === 'medium' ? '#f59e0b22' : 'rgba(148,163,184,0.15)',
                      color: f.severity === 'high' ? t.bad : f.severity === 'medium' ? '#f59e0b' : t.textSecondary,
                    }}
                  />
                  <Box>
                    <Typography sx={{ fontSize: '0.86rem', color: t.textPrimary }}>{f.finding}</Typography>
                    <Typography sx={{ fontSize: '0.72rem', color: t.textMuted }}>
                      {f.verified ? 'Verified' : 'Not yet verified'} · {f.status}{f.decision_owner ? ` · decision: ${f.decision_owner}` : ''}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Paper>
          </Box>
        </>
      )}
    </Container>
  );
}
