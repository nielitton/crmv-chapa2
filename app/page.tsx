'use client';

import Image from 'next/image';
import { useRef, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowRight, Check, CheckCheck, ChevronDown, Clock3, HeartHandshake, MapPin, Plus, ShieldCheck, Sprout, Users, X } from 'lucide-react';

const areas = ['Clínica de pequenos animais', 'Clínica de grandes animais', 'Animais silvestres e exóticos', 'Saúde pública', 'Inspeção e segurança de alimentos', 'Produção animal e zootecnia', 'Ensino e pesquisa', 'Gestão e consultoria', 'Outra'];

export default function Home() {
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [area, setArea] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const inFlight = useRef(false);
  const cityRef = useRef<HTMLInputElement>(null);

  function addCity() {
    const value = city.trim();
    if (!value) return;
    if (!cities.some(c => c.toLocaleLowerCase() === value.toLocaleLowerCase())) setCities([...cities, value]);
    setCity('');
    setError('');
    cityRef.current?.focus();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || saved) return;
    const allCities = [...cities];
    if (city.trim() && !allCities.some(c => c.toLocaleLowerCase() === city.trim().toLocaleLowerCase())) allCities.push(city.trim());
    if (!allCities.length) { setError('Adicione pelo menos uma cidade de atuação.'); cityRef.current?.focus(); return; }
    if (phone.replace(/\D/g, '').length !== 11) { setError('Informe um celular com DDD e 11 dígitos.'); return; }
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    if (String(data.name).trim().split(/\s+/).length < 2) { setError('Informe seu nome completo, incluindo o sobrenome.'); return; }
    inFlight.current = true;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/participacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, cities: allCities }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        setError(result.message || 'Não foi possível confirmar o envio. Confirme com a equipe antes de reenviar.');
        return;
      }
      setSaved(true);
      document.getElementById('pesquisa')?.scrollIntoView({ block: 'start' });
    } catch {
      setError('Não foi possível confirmar o envio. Sua resposta pode ter sido recebida; confirme com a equipe antes de reenviar.');
    } finally {
      inFlight.current = false;
      setSending(false);
    }
  }

  return (
    <div className="site">
      <header className="header">
        <a className="brand" href="#" aria-label="Ação e Valorização — início"><span><small className="brand-kicker">CHAPA</small>Ação <em>e</em><br /><strong>Valorização</strong></span></a>
        <div className="header-right"><a href="#pesquisa" className="header-link">Participe da pesquisa <ArrowDown size={15} /></a></div>
      </header>

      <main>
        <section className="intro">
          <div className="eyebrow"><span /> JUNTOS PELA NOSSA PROFISSÃO</div>
          <h1>O futuro da profissão<br />começa com <span>a sua voz.</span></h1>
          <p>Queremos conhecer quem faz a diferença todos os dias.<br className="desktop-break" /> Conte um pouco sobre você e ajude a transformar escuta em ação.</p>
          <div className="intro-meta"><span><Clock3 size={15} /> Leva menos de 2 minutos</span><i /><span><ShieldCheck size={16} /> Seus dados com responsabilidade</span></div>
        </section>

        <div className="content-grid">
          <aside className="sidebar">
            <Image className="campaign-art" src="/ação-e-valorização.jpeg" alt="Chapa Ação e Valorização — Medicina Veterinária e Zootecnia. O Conselho ao seu lado." width={1254} height={1254} sizes="(max-width: 680px) 90vw, (max-width: 900px) 225px, 340px" priority />
            <h2>Conhecer para<br />valorizar.</h2>
            <p>Cada trajetória tem algo a dizer. Sua participação nos ajuda a entender nossa realidade e construir caminhos para uma profissão mais reconhecida.</p>
            <div className="side-divider" />
            <div className="benefit"><span><Users size={19} /></span><div><h3>Uma categoria mais conectada</h3><p>Aproximar profissionais e fortalecer nossa rede.</p></div></div>
            <div className="benefit"><span><MapPin size={19} /></span><div><h3>Um olhar para cada região</h3><p>Conhecer a presença e a atuação dos profissionais.</p></div></div>
            <div className="benefit"><span><Sprout size={19} /></span><div><h3>Mais espaço para crescer</h3><p>Dar visibilidade às diferentes áreas da profissão.</p></div></div>
            <div className="quote"><span>“</span><p>Uma profissão forte se constrói com a participação de todos.</p><div>AÇÃO E VALORIZAÇÃO</div></div>
          </aside>

          <section id="pesquisa" className="form-card">
            {saved && <div className="success" role="status"><span className="success-icon"><CheckCheck size={36} /></span><div className="eyebrow">PARTICIPAÇÃO REGISTRADA</div><h2>Obrigado por compartilhar<br />a sua trajetória!</h2><p>Sua resposta foi recebida com sucesso. Obrigado por fazer parte dessa iniciativa!</p></div>}<div hidden={saved}>
              <div className="card-heading"><div><h2>Vamos conhecer você?</h2><p>Preencha seus dados para fazer parte dessa iniciativa.</p></div><span className="heading-icon"><HeartHandshake size={22} strokeWidth={1.5} /></span></div>
              <form onSubmit={submit} aria-busy={sending}><fieldset disabled={sending} className="form-fields">
                <div className="form-section-title"><span>01</span><h3>Seus dados</h3><div /><small>* Campos obrigatórios</small></div>
                <div className="field"><label htmlFor="name">Nome completo <b>*</b></label><input id="name" name="name" placeholder="Como você se chama?" autoComplete="name" required maxLength={150} /></div>
                <div className="field-row"><div className="field"><label htmlFor="crmv">Nº do CRMV <b>*</b></label><input id="crmv" name="crmv" placeholder="Ex.: CRMV-CE 12345" required maxLength={40} /><small>Inclua a UF do seu registro.</small></div><div className="field"><label htmlFor="phone">Celular / WhatsApp <b>*</b></label><input id="phone" name="phone" type="tel" autoComplete="tel-national" placeholder="(00) 00000-0000" required value={phone} onChange={e => { const n = e.target.value.replace(/\D/g, '').slice(0, 11); setPhone(n.length > 7 ? `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}` : n.length > 2 ? `(${n.slice(0, 2)}) ${n.slice(2)}` : n); }} /></div></div>
                <div className="field"><label htmlFor="email">E-mail <b>*</b></label><input id="email" name="email" type="email" placeholder="voce@exemplo.com.br" autoComplete="email" required maxLength={200} /></div>
                <div className="form-section-title second"><span>02</span><h3>Sua atuação</h3><div /></div>
                <div className="field"><label htmlFor="area">Área de atuação <b>*</b></label><div className="select-wrap"><select id="area" name="area" required value={area} onChange={e => setArea(e.target.value)}><option value="" disabled>Selecione sua principal área de atuação</option>{areas.map(a => <option key={a}>{a}</option>)}</select><ChevronDown size={16} /></div></div>
                {area === 'Outra' && <div className="field"><label htmlFor="otherArea">Qual é a sua área? <b>*</b></label><input id="otherArea" name="otherArea" required placeholder="Informe sua área de atuação" maxLength={150} /></div>}
                <div className="field"><label htmlFor="cities">Cidades de atuação <b>*</b></label><div className="city-input"><MapPin size={17} /><input ref={cityRef} id="cities" value={city} onChange={e => setCity(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCity(); } }} placeholder="Digite a cidade e a UF" maxLength={100} /><button type="button" aria-label="Adicionar cidade" onClick={addCity} disabled={!city.trim()}><Plus size={18} /></button></div><small>Atua em mais de uma cidade? Adicione quantas precisar.</small>{cities.length > 0 && <div className="city-tags">{cities.map(c => <span key={c}>{c}<button type="button" aria-label={`Remover ${c}`} onClick={() => setCities(cities.filter(v => v !== c))}><X size={13} /></button></span>)}</div>}</div>
                <div className="field"><label htmlFor="improvements">Nos diga no que o CRMV pode melhorar!? <b>*</b></label><textarea id="improvements" name="improvements" required placeholder="Compartilhe suas sugestões para o CRMV" rows={4} maxLength={2000} aria-describedby="improvements-help" /><small id="improvements-help">Até 2.000 caracteres.</small></div>
                <div className="privacy-note"><ShieldCheck size={19} /><p>Ao enviar, você compartilha seus dados com a equipe <strong>Ação e Valorização</strong> para esta pesquisa profissional.</p></div>
                {error && <p className="error" role="alert">{error}</p>}
                <button type="submit" className="submit-button" disabled={sending}>{sending ? 'Enviando…' : 'Enviar minha participação'} <ArrowRight size={18} /></button>
                <div className="form-footnote"><Check size={13} /> Cada participação faz a diferença.</div>
              </fieldset></form>
            </div>
          </section>
        </div>
        <div className="closing"><span /> Sua experiência importa. Sua voz transforma. <span /></div>
      </main>
      <footer><span>Ação e Valorização<span className="brand-dot">.</span></span><p>Uma iniciativa de escuta e conexão profissional.</p><small>© {new Date().getFullYear()} Ação e Valorização</small></footer>
    </div>
  );
}
