const fs = require('fs');
let c = fs.readFileSync('frontend/src/App.tsx', 'utf8');

const startPos = c.indexOf('{/* ── KPI CARDS ── */}');
const pattern = '              </>\n            )}\n          </>';
const patternPos = c.indexOf(pattern, startPos);
const endPos = patternPos + 17; // include '              </>'

console.log('startPos:', startPos, 'endPos:', endPos);
console.log('old section starts with:', JSON.stringify(c.slice(startPos, startPos+30)));
console.log('old section ends with:', JSON.stringify(c.slice(endPos-20, endPos+5)));

const newContent = `            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingBottom: '24px' }}>

              {/* KPI CARDS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px' }}>
                <div onClick={() => setVista('mora')} style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #dc2626', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fee2e2', borderRadius: '50%', opacity: 0.4 }} />
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>💸 Total vencido</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmt(totalVencido)}</div>
                  <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{vencidasArr.length} facturas · {clientDashList.length} clientes</div>
                </div>
                <div onClick={() => setVista('mora')} style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #d97706', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#fef3c7', borderRadius: '50%', opacity: 0.4 }} />
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>⏳ Vence en 7 días</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmt(totalProxAVencer)}</div>
                  <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{proxAVencer.length} facturas próximas a vencer</div>
                </div>
                <div onClick={() => setVista('todos')} style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', padding: '22px 24px', boxShadow: '0 2px 8px rgba(10,22,40,0.08)', borderLeft: '5px solid #059669', position: 'relative', overflow: 'hidden', cursor: 'pointer' }}>
                  <div style={{ position: 'absolute', right: '-10px', top: '-10px', width: '70px', height: '70px', background: '#d1fae5', borderRadius: '50%', opacity: 0.4 }} />
                  <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '10px' }}>✅ Sin vencer</div>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669', fontFamily: 'monospace', lineHeight: 1, marginBottom: '6px' }}>{fmt(totalSinVencer)}</div>
                  <div style={{ fontSize: '12px', color: '#7a8fbb' }}>{dataSel.filter(r => r.dias_mora <= 0).length} facturas al día</div>
                </div>
              </div>

              {/* SLIM METRICS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(10,22,40,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>💹</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>Cartera en mora</div>
                    <div style={{ height: '4px', background: '#eef2fa', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: \`\${porcentajeMora}%\`, height: '100%', background: '#7c3aed', borderRadius: '3px', transition: 'width 0.5s' }} />
                    </div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#7c3aed', flexShrink: 0 }}>{porcentajeMora}%</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(10,22,40,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>⏱</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Mora promedio</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>{vencidasArr.length} facturas vencidas</div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#d97706', flexShrink: 0 }}>{moraPromedio}d</div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '10px', padding: '14px 18px', boxShadow: '0 1px 4px rgba(10,22,40,0.06)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0 }}>📊</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: '#7a8fbb', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '2px' }}>Promedio de cobro</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8' }}>sin cobros aún</div>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#94a3b8', flexShrink: 0 }}>—</div>
                </div>
              </div>

              {/* CLIENTS + PIE */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '14px' }}>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Deuda por cliente</span>
                    <span style={{ fontSize: '11px', color: '#7a8fbb' }}>clic para ver facturas</span>
                  </div>
                  <div style={{ padding: '12px 20px' }}>
                    {clientDashList.slice(0, 10).map((c, i) => {
                      const bc = DASH_BAR_COLORS[i % DASH_BAR_COLORS.length]
                      return (
                        <div key={c.name} style={{ marginBottom: '10px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', gap: '8px' }}>
                            <span onClick={() => { setBusqueda(c.name); setVista('mora') }} style={{ fontSize: '13px', fontWeight: 600, color: '#1d4170', textDecoration: 'underline', textDecorationColor: '#a8c4f5', cursor: 'pointer', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '45%' }}>{c.name}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                              <span style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: '#0d1b38', minWidth: '110px', textAlign: 'right' }}>{fmt(c.monto)}</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: bc + '18', border: '1px solid ' + bc + '35', color: bc }}>{c.pct}%</span>
                              <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '20px', background: '#fef3c7', color: '#92400e' }}>{c.moraProm}d</span>
                            </span>
                          </div>
                          <div style={{ height: '4px', background: '#eef2fa', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: c.pct + '%', height: '100%', background: bc, borderRadius: '3px', transition: 'width 0.5s' }} />
                          </div>
                        </div>
                      )
                    })}
                    {clientDashList.length === 0 && <div style={{ color: '#7a8fbb', fontSize: '13px', padding: '20px 0', textAlign: 'center' }}>Sin clientes con mora</div>}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Deuda por ejecutivo</span>
                  </div>
                  <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                    {execPieList.length > 0
                      ? svgPie(execPieList.map(e => ({ value: e.monto, color: e.color })), 150)
                      : <div style={{ color: '#7a8fbb', fontSize: '13px', padding: '30px' }}>Sin datos</div>
                    }
                    <div style={{ width: '100%' }}>
                      {execPieList.map(e => (
                        <div key={e.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 0', borderBottom: '1px solid #f8faff' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: e.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '12px', color: '#3d5278', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.name}</span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#0d1b38' }}>{fmt(e.monto)}</span>
                          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '20px', background: '#e0e7ff', color: '#4338ca' }}>{e.pct}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* MORA DIST + CLIENTES AL DIA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Distribución por mora</span>
                  </div>
                  <div style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    {moraDist.map(b => (
                      <div key={b.label} style={{ background: b.bg, border: '1px solid ' + b.color + '30', borderRadius: '10px', padding: '14px', borderLeft: '4px solid ' + b.color }}>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: b.color, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '6px' }}>{b.label}</div>
                        <div style={{ fontSize: '24px', fontWeight: 800, color: b.color, fontFamily: 'monospace', lineHeight: 1, marginBottom: '4px' }}>{b.items.length}</div>
                        <div style={{ fontSize: '11px', color: '#6b7280' }}>facturas</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: '#374151', marginTop: '4px' }}>{fmt(b.items.reduce((s, r) => s + r.monto, 0))}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #dde3f0', borderRadius: '12px', boxShadow: '0 2px 8px rgba(10,22,40,0.07)', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef2fa', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#0d1b38' }}>Clientes al día</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 8px', borderRadius: '20px', background: '#d1fae5', color: '#065f46' }}>{clientesAlDia.length}</span>
                  </div>
                  <div style={{ padding: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {clientesAlDia.length === 0
                      ? <div style={{ color: '#7a8fbb', fontSize: '13px' }}>Sin clientes al día</div>
                      : clientesAlDia.map(n => (
                          <span key={n} onClick={() => { setBusqueda(n); setVista('todos') }} style={{ fontSize: '12px', fontWeight: 500, padding: '4px 10px', borderRadius: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#065f46', cursor: 'pointer', whiteSpace: 'nowrap' }}>{n}</span>
                        ))
                    }
                  </div>
                </div>
              </div>

            </div>
              </>`;

const newFile = c.slice(0, startPos) + newContent + c.slice(endPos);
fs.writeFileSync('frontend/src/App.tsx', newFile, 'utf8');
console.log('Done! New length:', newFile.length, 'Old:', c.length);
console.log('Verify start:', JSON.stringify(newFile.slice(startPos-10, startPos+60)));
console.log('Verify end:', JSON.stringify(newFile.slice(startPos + newContent.length - 30, startPos + newContent.length + 50)));
