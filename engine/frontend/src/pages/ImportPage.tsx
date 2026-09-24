import { useRef, useState } from 'react';
import { Alert, Box, Button, Container, Paper, Typography } from '@mui/material';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import { api, ImportCheck, ImportResult } from '../api';
import { useTokens } from '../theme';
import { useSound } from '../sound';
import exampleYaml from '../../../../demo/import-example/paidout-report/report.yaml?raw';
import exampleSql from '../../../../demo/import-example/paidout-report/dataset.sql?raw';

/**
 * Add a report with no code change: drop its settings file (report.yaml) and its SQL (dataset.sql),
 * let the engine check them safely, then publish.
 */
export default function ImportPage({ onPublished }: { onPublished: () => void }) {
  const t = useTokens();
  const sound = useSound();
  const [yaml, setYaml] = useState('');
  const [sql, setSql] = useState('');
  const [checks, setChecks] = useState<ImportCheck[]>([]);
  const [result, setResult] = useState<ImportResult>();
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const reset = () => {
    setChecks([]);
    setResult(undefined);
  };

  async function readFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) {
      const text = await f.text();
      if (/\.ya?ml$/i.test(f.name)) setYaml(text);
      else if (/\.sql$/i.test(f.name)) setSql(text);
    }
    reset();
    sound.play('filter');
  }

  // Reveal the checks one by one, so people can follow what the engine verified.
  async function reveal(r: ImportResult) {
    setChecks([]);
    for (let i = 0; i < r.checks.length; i++) {
      await new Promise((res) => setTimeout(res, 380));
      setChecks(r.checks.slice(0, i + 1));
      sound.play(r.checks[i].ok ? 'click' : 'error');
    }
    setResult(r);
  }

  async function run(publish: boolean) {
    setBusy(true);
    reset();
    try {
      const r = await api.importReport(yaml, sql, publish);
      await reveal(r);
      if (publish && r.ok) {
        sound.play('success');
        onPublished();
      }
    } catch (e) {
      setResult({ ok: false, id: null, title: null, checks: [{ name: 'Engine reachable', ok: false, detail: String(e) }] });
      sound.play('error');
    } finally {
      setBusy(false);
    }
  }

  const published = result?.ok && checks.some((c) => c.name === 'Published');

  const filePanel = (name: string, text: string) => (
    <Paper sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', minHeight: 260 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25, borderBottom: `1px solid ${t.panelBorder}` }}>
        <DescriptionRoundedIcon sx={{ fontSize: 18, color: text ? t.accent : t.textMuted }} />
        <Typography sx={{ fontFamily: t.mono, fontSize: '0.85rem', color: t.textPrimary, flex: 1 }}>{name}</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: text ? t.good : t.textMuted }}>{text ? `${text.split('\n').length} lines` : 'missing'}</Typography>
      </Box>
      <Box
        component="pre"
        sx={{
          m: 0, p: 2, flex: 1, overflow: 'auto', maxHeight: 300, fontFamily: t.mono, fontSize: '0.74rem', lineHeight: 1.55,
          color: text ? t.textSecondary : t.textMuted,
        }}
      >
        {text || 'Drop the file above, or use the example.'}
      </Box>
    </Paper>
  );

  return (
    <Container maxWidth={false} sx={{ py: 3, maxWidth: 1400 }}>
      <Typography variant="h1" sx={{ color: t.textPrimary }}>Import a report</Typography>
      <Typography sx={{ color: t.textSecondary, mb: 2.5 }}>
        A report is two files: a settings file and its SQL. Upload them here - no code change, no redeploy.
      </Typography>

      <Paper
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void readFiles(e.dataTransfer.files);
        }}
        onClick={() => input.current?.click()}
        sx={{
          p: 4, mb: 2, textAlign: 'center', cursor: 'pointer', borderStyle: 'dashed', borderWidth: 2,
          borderColor: dragging ? t.accent : t.panelBorder, boxShadow: dragging && t.glow ? `0 0 30px -6px ${t.glow}` : undefined,
        }}
      >
        <input ref={input} hidden type="file" multiple accept=".yaml,.yml,.sql" onChange={(e) => void readFiles(e.target.files)} />
        <CloudUploadRoundedIcon sx={{ fontSize: 44, color: t.accent, mb: 1, animation: 'float 3s ease-in-out infinite', '@keyframes float': { '50%': { transform: 'translateY(-5px)' } } }} />
        <Typography sx={{ fontWeight: 650, color: t.textPrimary }}>Drop report.yaml and dataset.sql here</Typography>
        <Typography sx={{ fontSize: '0.85rem', color: t.textSecondary }}>or click to choose files</Typography>
        <Button
          sx={{ mt: 1.5 }}
          onClick={(e) => {
            e.stopPropagation();
            setYaml(exampleYaml);
            setSql(exampleSql);
            reset();
            sound.play('filter');
          }}
        >
          Use the example: Paid-outs Report
        </Button>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 2 }}>
        {filePanel('report.yaml', yaml)}
        {filePanel('dataset.sql', sql)}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
        <Button variant="outlined" disabled={!yaml || !sql || busy} onClick={() => void run(false)}>
          Check it
        </Button>
        <Button
          variant="contained"
          disabled={!yaml || !sql || busy || !result?.ok}
          startIcon={<RocketLaunchRoundedIcon />}
          onClick={() => void run(true)}
          sx={{ background: `linear-gradient(90deg, ${t.series1}, ${t.series1Light})`, color: '#fff' }}
        >
          Publish
        </Button>
      </Box>

      {checks.length > 0 && (
        <Paper sx={{ p: 2.25 }}>
          <Typography variant="h2" sx={{ mb: 1.5 }}>Safety checks</Typography>
          {checks.map((c) => (
            <Box
              key={c.name}
              sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25, py: 0.9, animation: 'slide .35s ease both', '@keyframes slide': { from: { opacity: 0, transform: 'translateX(-10px)' }, to: { opacity: 1, transform: 'none' } } }}
            >
              {c.ok ? <CheckCircleRoundedIcon sx={{ color: t.good }} /> : <CancelRoundedIcon sx={{ color: t.bad }} />}
              <Box>
                <Typography sx={{ fontWeight: 650, color: t.textPrimary, fontSize: '0.92rem' }}>{c.name}</Typography>
                <Typography sx={{ fontSize: '0.8rem', color: t.textSecondary, fontFamily: c.ok ? undefined : t.mono, whiteSpace: 'pre-wrap' }}>{c.detail}</Typography>
              </Box>
            </Box>
          ))}
          {result && !result.ok && <Alert severity="error" sx={{ mt: 1 }}>Nothing was published. Fix the item marked with a cross and check again.</Alert>}
          {result?.ok && !published && <Alert severity="success" sx={{ mt: 1 }}>All checks passed. Press Publish to make it live.</Alert>}
          {published && (
            <Alert severity="success" sx={{ mt: 1 }} action={<Button href={`#/r/${result!.id}`} onClick={() => sound.play('click')}>Open report</Button>}>
              <strong>{result!.title}</strong> is live.
            </Alert>
          )}
        </Paper>
      )}

      <Alert severity="info" variant="outlined" sx={{ mt: 2 }}>
        Every upload is checked the same way: the settings file must be valid, the SQL may only read data, and every field and
        measure is tried on the database (read-only, no rows read) before anything goes live. Before this is used by others,
        importing must be limited to admins.
      </Alert>
    </Container>
  );
}
