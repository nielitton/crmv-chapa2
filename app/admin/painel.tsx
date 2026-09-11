'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { Download, LockKeyhole, LogOut, RefreshCw, Search, Users } from 'lucide-react';
import type { Registro } from '../../lib/participacoes';
import styles from './painel.module.css';

const formatter = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Fortaleza', dateStyle: 'short', timeStyle: 'short' });
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const pageSize = 25;

export default function Admin() {
  const [password, setPassword] = useState('');
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const authorization = useRef('');
  const filtered = useMemo(() => {
    const term = normalize(search.trim());
    return (registros || []).filter(row => normalize([row.name, row.crmv, row.email, row.phone,
      row.area, row.otherArea, ...row.cities, row.improvements].join(' ')).includes(term));
  }, [registros, search]);
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);

  function logout() {
    authorization.current = '';
    setRegistros(null);
    setPassword('');
    setSearch('');
    setPage(1);
    setError('');
  }

  async function load(credentials: string) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/admin/cadastros', { headers: { Authorization: credentials }, cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 401) logout();
        throw new Error(await response.text());
      }
      const data = await response.json();
      authorization.current = credentials;
      setRegistros(data.registros);
      setPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar os cadastros.');
    } finally {
      setBusy(false);
    }
  }

  function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // A credencial fica apenas em memória; recarregar a página exige entrar novamente.
    const bytes = new TextEncoder().encode(`admin:${password}`);
    void load(`Basic ${btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))}`);
  }

  async function download() {
    if (downloading) return;
    setDownloading(true);
    setError('');
    try {
      const response = await fetch('/api/participacoes/planilha', { headers: { Authorization: authorization.current }, cache: 'no-store' });
      if (!response.ok) {
        if (response.status === 401) logout();
        throw new Error(await response.text());
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'cadastros.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível baixar a planilha.');
    } finally {
      setDownloading(false);
    }
  }

  return <div className={styles.shell}>
    <div className={styles.topbar}><a href="/">Ação e Valorização</a><span>Área administrativa</span></div>
    {registros === null ? <div className={styles.login}>
      <div className={styles.lock}><LockKeyhole size={28} /></div>
      <h1>Acompanhe os cadastros</h1>
      <p>Entre com a senha da equipe para consultar as participações.</p>
      <form onSubmit={login}>
        <label htmlFor="admin-password">Senha de acesso</label>
        <input id="admin-password" type="password" required autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} disabled={busy} />
        {error && <p className={styles.error} role="alert">{error}</p>}
        <button className={styles.primary} disabled={busy}>{busy ? 'Entrando…' : 'Entrar'}</button>
      </form>
    </div> : <div className={styles.content}>
      <div className={styles.heading}><div><span className={styles.kicker}>PARTICIPAÇÕES RECEBIDAS</span><h1>Cadastros</h1><p>Consulte os dados e as sugestões de quem participou.</p></div>
        <div className={styles.actions}>
          <button onClick={() => void load(authorization.current)} disabled={busy || downloading}><RefreshCw size={16} />{busy ? 'Atualizando…' : 'Atualizar'}</button>
          <button className={styles.primary} onClick={() => void download()} disabled={downloading || busy}><Download size={16} />{downloading ? 'Gerando…' : 'Baixar Excel'}</button>
          <button onClick={logout} disabled={busy || downloading}><LogOut size={16} />Sair</button>
        </div>
      </div>
      {error && <p className={styles.error} role="alert">{error}</p>}
      <div className={styles.summary}><Users size={23} /><strong>{registros.length}</strong><span>{registros.length === 1 ? 'cadastro recebido' : 'cadastros recebidos'}</span></div>
      <section className={styles.card} aria-label="Lista de cadastros" aria-busy={busy}>
        <div className={styles.search}><Search size={19} /><label className={styles.srOnly} htmlFor="admin-search">Buscar cadastros</label><input id="admin-search" placeholder="Buscar por nome, CRMV, cidade ou área…" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /><span>{filtered.length} resultados</span></div>
        {filtered.length === 0 ? <p className={styles.empty}>{registros.length === 0 ? 'Nenhum cadastro recebido ainda. As novas participações aparecerão aqui.' : 'Nenhum cadastro corresponde à sua busca.'}</p> : <div className={styles.tableWrap}>
          <table className={styles.table}><thead><tr><th>Participante</th><th>Contato</th><th>Atuação</th><th>Sugestão</th><th>Recebido em</th></tr></thead>
            <tbody>{filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize).map(row => <tr key={row.id}>
              <td><strong>{row.name}</strong><span>CRMV: {row.crmv}</span></td>
              <td><span>{row.email}</span><span>{row.phone}</span></td>
              <td><strong>{row.area === 'Outra' ? row.otherArea : row.area}</strong><span>{row.cities.join('; ')}</span></td>
              <td><details><summary>Ver sugestão</summary><p className={styles.suggestion}>{row.improvements}</p></details></td>
              <td><time dateTime={row.createdAt}>{formatter.format(new Date(row.createdAt))}</time></td>
            </tr>)}</tbody>
          </table>
        </div>}
        <div className={styles.pagination}><span>Página {currentPage} de {pages} · Horário de Fortaleza</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Anterior</button><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Próxima</button></div></div>
      </section>
    </div>}
  </div>;
}
