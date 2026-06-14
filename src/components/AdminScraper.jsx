import { useEffect, useRef, useState } from 'react';
import { FiDownloadCloud, FiLoader, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

/**
 * AdminScraper
 *
 * Admin-only page (reached at #admin) that triggers the backend recipe scraper
 * for a given search term (e.g. "bacalhau", "frango") and shows live progress.
 *
 * Talks to the Node service in /server via /api/scrape. In dev, Vite proxies
 * /api → http://localhost:3001 (see vite.config.js); in production, run the
 * service and point it at the same origin.
 */
export default function AdminScraper() {
  const [term, setTerm] = useState('bacalhau');
  const [maxPages, setMaxPages] = useState(20);
  const [mode, setMode] = useState('auto');
  const [job, setJob] = useState(null);
  const [error, setError] = useState(null);
  const [files, setFiles] = useState([]);
  const pollRef = useRef(null);
  const logEndRef = useRef(null);

  const running = job && job.status === 'running';

  async function loadFiles() {
    try {
      const res = await fetch('/api/recipes');
      const data = await res.json();
      setFiles(data.files || []);
    } catch {
      /* service may not be running yet */
    }
  }

  useEffect(() => {
    loadFiles();
    return () => clearInterval(pollRef.current);
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [job?.log?.length]);

  function poll(jobId) {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/scrape/${jobId}`);
        const data = await res.json();
        setJob(data);
        if (data.status !== 'running') {
          clearInterval(pollRef.current);
          loadFiles();
        }
      } catch (err) {
        clearInterval(pollRef.current);
        setError('Perdi a ligação ao serviço de scrape.');
      }
    }, 1000);
  }

  async function startScrape() {
    setError(null);
    setJob(null);
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: term.trim(), maxPages: Number(maxPages), mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Não foi possível iniciar o scrape.');
        return;
      }
      poll(data.jobId);
    } catch {
      setError(
        'Não consegui contactar o serviço (node server/index.js). Confirma que está a correr.'
      );
    }
  }

  const StatusIcon = () => {
    if (!job) return null;
    if (job.status === 'running') return <FiLoader className="spin" />;
    if (job.status === 'done') return <FiCheckCircle style={{ color: 'var(--accent-success)' }} />;
    return <FiAlertCircle style={{ color: 'var(--accent-danger)' }} />;
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          <FiDownloadCloud /> Scraper de Receitas — Pingo Doce
        </h1>
        <p style={styles.subtitle}>
          Procura receitas por termo, percorre a paginação e guarda em{' '}
          <code>data/recipes-&lt;termo&gt;.json</code>.
        </p>

        <div style={styles.form}>
          <label style={styles.field}>
            <span style={styles.label}>Termo de pesquisa</span>
            <input
              className="search-input"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="ex.: bacalhau, frango, atum…"
              disabled={running}
            />
          </label>
          <label style={{ ...styles.field, maxWidth: 140 }}>
            <span style={styles.label}>Máx. páginas</span>
            <input
              className="search-input"
              type="number"
              min="1"
              max="100"
              value={maxPages}
              onChange={(e) => setMaxPages(e.target.value)}
              disabled={running}
            />
          </label>
          <label style={{ ...styles.field, maxWidth: 220 }}>
            <span style={styles.label}>Método</span>
            <select
              className="search-input"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={running}
            >
              <option value="auto">Auto (fetch → browser se falhar)</option>
              <option value="browser">Browser headless (Playwright)</option>
              <option value="fetch">Só fetch (sem browser)</option>
            </select>
          </label>
          <button
            className="btn-primary"
            onClick={startScrape}
            disabled={running || !term.trim()}
            style={{ alignSelf: 'flex-end', height: 44 }}
          >
            {running ? 'A processar…' : 'Iniciar scrape'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {job && (
          <div style={styles.status}>
            <StatusIcon />
            <span>
              {job.status === 'running' && `A extrair… (${job.found} receitas até agora)`}
              {job.status === 'done' &&
                job.result &&
                `Concluído: ${job.result.added} novas, ${job.result.skipped} duplicadas, ${job.result.total} no ficheiro.`}
              {job.status === 'error' && `Erro: ${job.error}`}
            </span>
          </div>
        )}

        {job?.log?.length > 0 && (
          <pre style={styles.log}>
            {job.log.map((l, i) => (
              <div key={i}>{l.message}</div>
            ))}
            <div ref={logEndRef} />
          </pre>
        )}
      </div>

      <div style={styles.card}>
        <h2 style={styles.subheading}>Ficheiros de receitas guardados</h2>
        <ul style={styles.fileList}>
          {files.length === 0 && <li style={{ color: 'var(--text-secondary)' }}>—</li>}
          {files.map((f) => (
            <li key={f.file} style={styles.fileItem}>
              <code>data/{f.file}</code>
              <span style={styles.count}>{f.count} receitas</span>
            </li>
          ))}
        </ul>
        <button className="btn-secondary" onClick={loadFiles} style={{ marginTop: 12 }}>
          Atualizar
        </button>
      </div>

      <style>{`.spin { animation: adminspin 1s linear infinite; }
        @keyframes adminspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 820,
    margin: '0 auto',
    padding: '32px 20px 80px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  card: {
    background: 'var(--bg-secondary)',
    borderRadius: 16,
    padding: 24,
    boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  title: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 22, margin: '0 0 4px' },
  subtitle: { color: 'var(--text-secondary)', margin: '0 0 20px', fontSize: 14 },
  subheading: { fontSize: 18, margin: '0 0 12px' },
  form: { display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' },
  field: { display: 'flex', flexDirection: 'column', gap: 6, flex: 1, minWidth: 200 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' },
  error: {
    marginTop: 16,
    padding: '10px 14px',
    borderRadius: 10,
    background: '#FFF0F0',
    color: 'var(--accent-danger)',
    fontSize: 14,
  },
  status: {
    marginTop: 18,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    fontWeight: 500,
  },
  log: {
    marginTop: 14,
    maxHeight: 320,
    overflowY: 'auto',
    background: 'var(--bg-tertiary)',
    borderRadius: 10,
    padding: 14,
    fontSize: 12.5,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  fileList: { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 },
  fileItem: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 },
  count: { color: 'var(--text-secondary)', fontSize: 13 },
};
