/* cockpit.js - het Ruminate-productinterface, live op de site.
   Zelfstandige widget met eigen (ck-) stijlen; rendert in #cockpit.
   Drie schermen: Koppel (alle koeien op één as), Koe (haar kengetallen en
   onderbouwing) en Voeradvies (koppeladvies met inkooplijst).
   Draait op deterministische voorbeelddata (geen echte bedrijfsdata). */
(function () {
    'use strict';

    /* ---------- deterministische voorbeelddata ---------- */
    function rng(seed) { return function () { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; }; }
    var NAMEN = ['Berta 12', 'Sietske 4', 'Nynke 27', 'Marijke 8', 'Aaltje 31', 'Femke 19', 'Rixt 3', 'Tsjerkje 22',
        'Boukje 15', 'Willemke 7', 'Jantsje 40', 'Hiske 11', 'Doutzen 25', 'Grytsje 9', 'Afke 33', 'Lysbeth 17',
        'Antsje 2', 'Baukje 28', 'Wypkje 14', 'Sjoukje 36', 'Teatske 6', 'Hylkje 21', 'Romkje 30', 'Idske 13'];
    /* het beeld per koe; wie niet genoemd is, zit op haar optimum.
       buffert = herkauwt méér dan normaal: ze buffert haar pens met extra speeksel (vóór de verzuring) */
    var PROFIEL = { 'Sietske 4': 'zuur', 'Doutzen 25': 'zuur', 'Afke 33': 'zuur',
        'Femke 19': 'buffert', 'Teatske 6': 'hoog', 'Baukje 28': 'hoog',
        'Marijke 8': 'laag', 'Grytsje 9': 'laag', 'Hylkje 21': 'ketose', 'Jantsje 40': 'kreupel' };

    /* zone op de lat: haar voerbalans t.o.v. haar optimum (kg krachtvoer boven + of onder -) */
    function zone(afst) { return afst < -0.3 ? 'laag' : (afst <= 0.3 ? 'ok' : (afst <= 0.8 ? 'hoog' : 'zuur')); }

    /* melkcontrole (MPR): elke 4 weken, de laatste 10 dagen geleden. Vóór het afkalven was ze droog. */
    var MPR_DAGEN = [66, 38, 10];
    var MND = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
    function datumTerug(dagen) { var d = new Date(); d.setDate(d.getDate() - dagen); return d.getDate() + ' ' + MND[d.getMonth()]; }

    function maakKoppel() {
        var koeien = [];
        for (var i = 0; i < NAMEN.length; i++) {
            var r = rng(20260926 + i * 7919), p = PROFIEL[NAMEN[i]] || 'ok';
            var lactatie = 1 + Math.floor(r() * 4);
            var dim = p === 'zuur' ? 45 + Math.floor(r() * 70)
                : p === 'ketose' ? 15 + Math.floor(r() * 8)
                : p === 'buffert' ? 50 + Math.floor(r() * 60)
                : p === 'kreupel' ? 60 + Math.floor(r() * 200) : 30 + Math.floor(r() * 290);
            /* dagelijks, uit melkrobot en halsband */
            var basis = 37 - dim * 0.035 - (lactatie === 1 ? 4 : 0) + (r() - 0.5) * 6;   // verwachte gift volgens haar lactatiecurve, kg/dag
            var normH = 480 + r() * 80;                                                   // herkauwen, min/dag
            var normE = 230 + r() * 60;                                                   // vreettijd, min/dag
            var afst = p === 'zuur' ? 0.85 + r() * 0.6
                : (p === 'hoog' || p === 'buffert' || p === 'kreupel') ? 0.4 + r() * 0.3
                : (p === 'laag' || p === 'ketose') ? -(0.4 + r() * 0.6) : (r() - 0.5) * 0.5;
            var melk = [], herkauw = [], eten = [], act = [];
            for (var d = 0; d < 14; d++) {
                var t = Math.max(0, d - 8), th = Math.max(0, d - 10);   // afwijking vanaf dag 9 (hoog: dag 11)
                melk.push(basis + Math.sin(d * 1.7 + i) * 0.6 + (r() - 0.5) * 1.0
                    - (p === 'zuur' ? 1.1 * t : p === 'ketose' || p === 'kreupel' ? 0.9 * t : p === 'hoog' ? 0.4 * th : 0));
                /* herkauwen volgt vooral de ruwvoeropname; de bufferende koe herkauwt juist meer */
                herkauw.push(normH + Math.sin(d * 1.1 + i * 2) * 14 + (r() - 0.5) * 24
                    - (p === 'zuur' ? 24 * t : p === 'ketose' ? 12 * t : p === 'kreupel' ? 13 * t : p === 'hoog' ? 8 * th : 0)
                    + (p === 'buffert' ? 16 * t : 0));
                /* vreettijd: kreupel en ketose vreten korter */
                eten.push(normE + Math.sin(d * 0.9 + i) * 8 + (r() - 0.5) * 14
                    - normE * (p === 'kreupel' ? 0.055 * t : p === 'ketose' ? 0.035 * t : p === 'zuur' ? 0.02 * t : 0));
                act.push(100 + (r() - 0.5) * 8 - (p === 'zuur' ? 4 * t : p === 'ketose' ? 3 * t : p === 'kreupel' ? 7 * t : 0));
            }
            /* melkcontrole: vet, eiwit, lactose per controle (oudste eerst); null = toen nog droog */
            var vetN = 4.1 + r() * 0.5, eiwN = 3.4 + r() * 0.25, lacN = 4.55 + r() * 0.2;
            var mpr = MPR_DAGEN.map(function (terug, j) {
                var dag = dim - terug;
                if (dag < 5) return null;
                var laatste = j === MPR_DAGEN.length - 1;
                var v = vetN + (r() - 0.5) * 0.12, e = eiwN + (r() - 0.5) * 0.06, l = lacN + (r() - 0.5) * 0.04, cel = 40 + Math.round(r() * 110);
                if (laatste && p === 'zuur') v = e - 0.1 - r() * 0.2;              // inversie
                if (laatste && p === 'buffert') v = vetN - 0.45;                   // vet zakt
                if (p === 'laag') { e = 3.15 + r() * 0.08; l = 4.38 + r() * 0.05; }
                if (laatste && p === 'ketose') { v = 5.45; e = 3.5; l = 4.26; }      // vet/eiwit boven 1,5, lactose laag
                return { dag: dag, datum: datumTerug(terug), vet: v, eiwit: e, lactose: l, cel: cel };
            }).filter(Boolean);
            koeien.push({
                naam: NAMEN[i], profiel: p, zone: zone(afst), afst: afst,
                lactatie: lactatie, dim: dim, leeftijd: Math.floor(2.1 + (lactatie - 1) * 1.15 + dim / 365),
                basis: basis, normH: normH, normE: normE,
                melk: melk, herkauw: herkauw, eten: eten, act: act, mpr: mpr,
                kv: 3 + r() * 5, rest: p === 'hoog' ? 0.6 + r() * 0.6 : r() * 0.05
            });
        }
        var orde = { zuur: 0, kreupel: 1, ketose: 1, buffert: 2, hoog: 2, laag: 3, ok: 4 };
        koeien.sort(function (a, b) { return orde[a.profiel] - orde[b.profiel] || a.naam.localeCompare(b.naam); });
        return koeien;
    }

    /* ---------- signalen ----------
       dagelijks, laatste 3 dagen t.o.v. haar eigen norm: melkgift uit de robot; herkauwen, vreettijd en activiteit uit de halsband.
       melkcontrole: vet, eiwit en lactose van de laatste controle, vergeleken met de vorige. */
    function gem3(a) { return (a[11] + a[12] + a[13]) / 3; }
    function nl(v, n) { return v.toFixed(n == null ? 1 : n).replace('.', ','); }
    function pct(v) { v = Math.round(v); return (v >= 0 ? '+' : '−') + Math.abs(v) + '%'; }

    function signalen(k) {
        var dM = gem3(k.melk) - k.basis, dH = (gem3(k.herkauw) / k.normH - 1) * 100,
            dE = (gem3(k.eten) / k.normE - 1) * 100, dA = gem3(k.act) - 100;
        var m = k.mpr[k.mpr.length - 1], vo = k.mpr.length > 1 ? k.mpr[k.mpr.length - 2] : null, ratio = m.vet / m.eiwit;
        var vetDaalt = !!vo && m.vet - vo.vet < -0.3;
        var mt = ratio > 1.5 ? 'vet/eiwit ' + nl(ratio, 2) : (m.vet < m.eiwit ? 'inversie' : (vetDaalt ? 'vet daalt' : ''));
        return {
            melk: { af: dM < -1.5, kg: dM, tekst: dM < -1.5 ? '−' + nl(-dM) + ' kg t.o.v. verwacht' : 'binnen haar norm' },
            /* herkauwen wijkt in beide richtingen af: minder (minder ruwvoer) of juist meer (ze buffert) */
            herkauw: { af: Math.abs(dH) > 8, pct: dH,
                tekst: Math.round(gem3(k.herkauw)) + ' min/dag · ' + pct(dH) + (dH > 8 ? ' · hoger dan normaal' : '') },
            eten: { af: dE < -10, pct: dE, tekst: Math.round(gem3(k.eten)) + ' min/dag · ' + pct(dE) },
            act: { af: dA < -12, pct: dA, tekst: dA < -12 ? pct(dA) + ' t.o.v. norm' : 'binnen haar norm' },
            mpr: { af: !!mt, m: m, vo: vo, ratio: ratio, tekst: mt, lacLaag: m.lactose < 4.45, eiwLaag: m.eiwit < 3.25 }
        };
    }

    /* ---------- conclusie en advies ----------
       Elke bewering verwijst naar een meetwaarde; de uitleg waaróm is vakkennis en staat er als "past bij". */
    var MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni',
        'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
    function maand(offset) {
        var d = new Date();
        var naam = MAANDEN[(d.getMonth() + (offset || 0)) % 12];
        return naam.charAt(0).toUpperCase() + naam.slice(1);
    }

    function advies(k, s) {
        var h = Math.round(Math.abs(s.herkauw.pct)), e = Math.round(-s.eten.pct), a = Math.round(-s.act.pct), m = s.mpr.m;
        switch (k.profiel) {
        case 'zuur': return {
            conclusie: '<b>Verdenking pensverzuring.</b> Herkauwen −' + h + '% en activiteit −' + a + '% (halsband), melk ' + nl(-s.melk.kg) +
                ' kg onder verwacht (robot), en bij de melkcontrole op dag ' + m.dag + ' vet onder eiwit (inversie). Ze zit op dag ' + k.dim +
                ', in de risicoperiode van dag 40 tot 120.',
            kv: { delta: -0.8, titel: 'Opbouw pauzeren',
                  actie: 'Vandaag −0,8 kg via de robot, daarna in kleine stappen terug. Heeft ze energie nodig, dan liever pensbestendig vet dan krachtvoer.' },
            kaart: { kl: 'rood', kop: '&#9888; Apart zetten', titel: 'Zet haar vandaag apart',
                  tekst: 'In het strohok met onbeperkt hooi en pensbuffer; terug bij de koppel zodra haar herkauwen herstelt.' } };
        case 'buffert': return {
            conclusie: '<b>Mogelijk buffert ze haar pens.</b> Herkauwen +' + h + '% boven haar norm (halsband), terwijl haar vet bij de melkcontrole ' +
                nl(s.mpr.vo.vet - m.vet, 2) + ' punt lager lag dan de keer ervoor. Extra herkauwen past bij een koe die beginnende verzuring opvangt met speeksel.',
            kv: { delta: -0.6, titel: 'Portie iets terug', actie: 'Vandaag −0,6 kg; volg haar herkauwen de komende dagen.' } };
        case 'kreupel': return {
            conclusie: '<b>Past bij kreupelheid, niet bij een voerfout.</b> Activiteit −' + a + '% en vreettijd −' + e + '% (halsband): ze loopt en vreet minder. ' +
                'Herkauwen zakt mee (−' + h + '%), wat past bij minder ruwvoer. Haar krachtvoer haalt ze in de robot wel volledig op, dus de verhouding schuift richting krachtvoer.',
            kv: { delta: -0.5, titel: 'Tijdelijk iets omlaag',
                  actie: '−0,5 kg zolang haar vreettijd laag is; terug naar haar portie als ze weer normaal loopt en vreet.' },
            kaart: { kl: 'oranje', kop: 'Klauwen', titel: 'Laat haar vandaag nakijken',
                  tekst: 'Bekapper of dierenarts. De halsband laat zien of haar activiteit en vreettijd daarna herstellen.' } };
        case 'ketose': return {
            conclusie: '<b>Let op ketose.</b> Bij de melkcontrole op dag ' + m.dag + ' vet/eiwit ' + nl(s.mpr.ratio, 2) + ' en lactose ' + nl(m.lactose, 2) +
                '% bij een normaal celgetal (' + m.cel + '). Sindsdien zakken vreettijd (−' + e + '%) en herkauwen (−' + h + '%): ze vreet te weinig, en dat past bij vooral te weinig ruwvoer.',
            kv: { delta: 0, titel: 'Krachtvoer niet verhogen',
                  actie: 'Meer krachtvoer brengt haar snel aan de structuurgrens. Stimuleer de ruwvoeropname: vers voer, vaak aanschuiven.' },
            kaart: { kl: 'oranje', kop: 'Propyleenglycol', titel: '300 ml per dag, 3 tot 5 dagen',
                  tekst: 'Als drench, of via de robot als die vloeibaar kan doseren. Herstellen vreettijd en melkgift niet binnen drie dagen, bel de dierenarts.' } };
        case 'hoog': return {
            conclusie: '<b>Portie loopt vóór op haar opname.</b> Ze laat drie dagen op rij krachtvoer liggen in de robot (rest ' + nl(k.rest) +
                ' kg/dag). Herkauwen, vreettijd en vet zijn nog normaal: geen verzuringssignalen.',
            kv: { delta: -1.0, titel: 'Portie verlagen', actie: 'Vandaag −1,0 kg, zodat er geen krachtvoer meer blijft liggen.' } };
        case 'laag': return {
            conclusie: '<b>Te weinig energie, en ze vreet goed.</b> Vreettijd en herkauwen normaal (halsband); bij de melkcontrole zijn eiwit (' +
                nl(m.eiwit, 2) + '%) en lactose (' + nl(m.lactose, 2) + '%) laag, bij een normaal celgetal (' + m.cel + '). Omdat haar opname op peil is, kan er krachtvoer bij.',
            kv: { delta: 0.6, titel: 'Bijvoeren, in twee stappen', actie: 'Vandaag +0,3 kg, over drie dagen nog eens +0,3 kg.' } };
        default: return {
            conclusie: 'Melkgift, herkauwen, vreettijd en activiteit binnen haar eigen norm; melkcontrole zonder bijzonderheden.',
            kv: { delta: 0, titel: 'Handhaven', actie: 'Vandaag de standaardportie.' } };
        }
    }

    /* ---------- opmaak ---------- */
    var css = [
        '.ck{position:relative;background:#101a11;color:#d4cfbf;border:1px solid rgba(212,207,191,.16);border-radius:14px;overflow:hidden;',
        '    font-family:"Jost",system-ui,sans-serif;font-weight:300;box-shadow:0 24px 70px rgba(0,0,0,.28);text-align:left}',
        '.ck *{box-sizing:border-box}',
        '.ck-kop{display:flex;align-items:center;gap:14px;padding:13px 18px;border-bottom:1px solid rgba(212,207,191,.14);flex-wrap:wrap}',
        '.ck-merk{font-family:"Baloo 2",sans-serif;font-weight:600;font-size:18px;line-height:1;color:#e8e4d6}',
        '.ck-merk i{font-style:normal;position:relative;display:inline-block}',
        '.ck-merk i::after{content:"";position:absolute;left:50%;transform:translateX(-50%);top:.09em;width:.17em;height:.17em;border-radius:50%;background:#c8524a}',
        '.ck-tag{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(212,207,191,.45)}',
        /* schermen */
        '.ck-tabs{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid rgba(212,207,191,.14)}',
        '.ck-tabs button{font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;background:none;border:0;',
        '    border-bottom:2px solid transparent;color:rgba(212,207,191,.5);padding:12px 12px 10px;cursor:pointer;transition:color .2s ease-out,border-color .2s ease-out}',
        '.ck-tabs button:hover{color:rgba(212,207,191,.85)}',
        '.ck-tabs button.aan{color:#e8e4d6;border-bottom-color:#c8524a}',
        '.ck-view[hidden]{display:none}',
        /* koe: lijst + detail */
        '.ck-romp{display:grid;grid-template-columns:minmax(250px,330px) minmax(0,1fr)}',
        '.ck-lijst{border-right:1px solid rgba(212,207,191,.14);display:flex;flex-direction:column}',
        '.ck-filters{display:flex;gap:6px;padding:10px 12px;border-bottom:1px solid rgba(212,207,191,.1)}',
        '.ck-filters button{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;',
        '    background:none;border:1px solid rgba(212,207,191,.25);border-radius:99px;color:rgba(212,207,191,.6);padding:5px 12px;cursor:pointer}',
        '.ck-filters button.aan{background:#d4cfbf;color:#101a11;border-color:#d4cfbf}',
        '.ck-rijen{overflow-y:auto;max-height:600px;flex:1}',
        '.ck-rij{display:grid;grid-template-columns:10px 1fr auto;gap:12px;align-items:center;width:100%;text-align:left;',
        '    background:none;border:0;border-bottom:1px solid rgba(212,207,191,.07);color:inherit;padding:9px 14px;cursor:pointer;font:inherit}',
        '.ck-rij:hover{background:rgba(212,207,191,.05)}',
        '.ck-rij.aan{background:rgba(200,82,74,.1)}',
        /* stip = kleur van haar zone op de lat */
        '.ck-dot{width:9px;height:9px;border-radius:50%}',
        '.ck-dot.laag{background:#e9bd4f}.ck-dot.ok{background:#7ba58a}.ck-dot.hoog{background:#ef7a2a}.ck-dot.zuur{background:#c8524a;box-shadow:0 0 8px rgba(200,82,74,.7)}',
        '.ck-rij .n{font-size:14.5px;color:#e8e4d6} .ck-rij .n small{display:block;margin-top:1px;font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.03em;color:rgba(212,207,191,.42)}',
        '.ck-rij .n small em{font-style:normal;color:#ef7a2a}',
        '.ck-rij .m{font-family:"JetBrains Mono",monospace;font-size:12px;color:rgba(212,207,191,.65);text-align:right}',
        '.ck-detail{padding:18px 22px;display:flex;flex-direction:column;gap:13px}',
        '.ck-dkop{display:flex;align-items:center;gap:10px;flex-wrap:wrap}',
        '.ck-dkop h4{font-family:"Baloo 2",sans-serif;font-weight:600;font-size:22px;line-height:1.1;color:#e8e4d6;margin:0 4px 0 0}',
        '.ck-badge{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;padding:4px 10px;border-radius:99px}',
        '.ck-badge.laag{background:rgba(233,189,79,.14);color:#e9bd4f}.ck-badge.ok{background:rgba(123,165,138,.18);color:#7ba58a}',
        '.ck-badge.hoog{background:rgba(239,122,42,.16);color:#ef7a2a}.ck-badge.zuur{background:rgba(200,82,74,.2);color:#e0847d}',
        '.ck-badge.vlag{background:none;border:1px solid rgba(239,122,42,.6);color:#ef7a2a}',
        /* kengetallen: leeftijd, lactatie, productie en melksamenstelling */
        '.ck-ken{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:1px;border:1px solid rgba(212,207,191,.12);border-radius:9px;overflow:hidden;background:rgba(212,207,191,.12)}',
        '.ck-ken > div{background:#131f14;padding:8px 10px}',
        '.ck-ken span{display:block;font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:rgba(212,207,191,.45)}',
        '.ck-ken b{display:block;margin-top:2px;font-weight:400;font-size:14px;color:#e8e4d6;white-space:nowrap}',
        '.ck-ken b.af{color:#e0847d}',
        '.ck-detail .ck-ken{grid-template-columns:repeat(3,minmax(0,1fr))}',
        /* voeradvies per koe */
        '.ck-voer{display:grid;grid-template-columns:1fr 1fr;gap:13px}',
        '.ck-vkaart{border-radius:9px;padding:13px 15px;border:1px solid rgba(212,207,191,.22);background:rgba(212,207,191,.04)}',
        '.ck-vkaart.rood{border-color:rgba(200,82,74,.7);background:rgba(200,82,74,.1)}',
        '.ck-vkaart.oranje{border-color:rgba(239,122,42,.6);background:rgba(239,122,42,.08)}',
        '.ck-vkaart h5{margin:0 0 7px;font-family:"JetBrains Mono",monospace;font-weight:400;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(212,207,191,.55)}',
        '.ck-vkaart.rood h5{color:#e0847d}.ck-vkaart.oranje h5{color:#ef7a2a}',
        '.ck-vkaart .cijfer{display:flex;align-items:baseline;gap:8px;margin-bottom:5px;flex-wrap:wrap}',
        '.ck-vkaart .cijfer b{font-family:"Baloo 2",sans-serif;font-weight:600;font-size:21px;color:#e8e4d6}',
        '.ck-vkaart .cijfer .pijl{color:rgba(212,207,191,.45);font-size:14px}',
        '.ck-vkaart .cijfer .delta{font-family:"JetBrains Mono",monospace;font-size:11px;padding:2px 8px;border-radius:99px}',
        '.ck-vkaart .cijfer .delta.min{background:rgba(200,82,74,.22);color:#e0847d}',
        '.ck-vkaart .cijfer .delta.plus{background:rgba(233,189,79,.18);color:#e9bd4f}',
        '.ck-vkaart .cijfer .delta.nul{background:rgba(123,165,138,.18);color:#7ba58a}',
        '.ck-vkaart .titel{font-size:14.5px;color:#e8e4d6;line-height:1.35}',
        '.ck-vkaart p{margin:5px 0 0;font-size:12.5px;line-height:1.5;color:rgba(212,207,191,.62)}',
        /* onderbouwing: conclusie + vier signalen t.o.v. haar norm */
        '.ck-grond,.ck-gauge,.ck-paneel{border:1px solid rgba(212,207,191,.12);border-radius:9px;padding:12px 13px;background:rgba(212,207,191,.03)}',
        '.ck-grond h5,.ck-gauge h5,.ck-paneel h5{margin:0 0 8px;font-family:"JetBrains Mono",monospace;font-weight:400;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:rgba(212,207,191,.5)}',
        '.ck-conclusie{margin:0 0 11px;font-size:13.5px;line-height:1.5;color:rgba(212,207,191,.78)}',
        '.ck-conclusie b{font-weight:400;color:#e8e4d6}',
        '.ck-sig{display:grid;grid-template-columns:1fr 1fr;gap:10px 16px}',
        '.ck-sig > div{min-width:0;border-top:1px dashed rgba(212,207,191,.16);padding-top:7px}',
        '.ck-sig h6{margin:0;font-family:"JetBrains Mono",monospace;font-weight:400;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:rgba(212,207,191,.5)}',
        '.ck-sig .w{display:block;margin-top:2px;font-size:13px;color:#7ba58a}',
        '.ck-sig .af .w{color:#e0847d}',
        '.ck-sig svg{display:block;width:100%;height:38px;margin-top:4px}',
        '.ck-bron{margin:-4px 0 0;font-family:"JetBrains Mono",monospace;font-size:9.5px;line-height:1.5;letter-spacing:.03em;color:rgba(212,207,191,.42)}',
        '.ck-vkaart .ck-bron{margin-top:8px}',
        '.ck-sig-voet{margin-top:9px;font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.04em;color:rgba(212,207,191,.4)}',
        /* optimum-staaf per koe: geel | groen | oranje | rood */
        '.ck-gauge svg{display:block;width:100%;height:auto}',
        '.ck-legende{display:grid;grid-template-columns:1.3fr .6fr .5fr .8fr;margin-top:6px;font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.06em;text-transform:uppercase;text-align:center}',
        '.ck-legende .laag{color:rgba(233,189,79,.9)}.ck-legende .ok{color:rgba(123,165,138,.95)}.ck-legende .hoog{color:rgba(239,122,42,.95)}.ck-legende .zuur{color:rgba(224,132,125,.95)}',
        /* koppel: alle koeien op één as */
        '.ck-kudde{padding:18px 22px 20px;display:flex;flex-direction:column;gap:13px}',
        '.ck-zwerm svg{display:block;width:100%;height:auto}',
        '.ck-zwerm circle.k{cursor:pointer;transition:r .15s ease-out}',
        '.ck-zwerm circle.k:hover{stroke:#e8e4d6;stroke-width:2.5}',
        '.ck-hint{margin:6px 0 0;font-size:12.5px;color:rgba(212,207,191,.5)}',
        '.ck-tellers{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}',
        '.ck-teller{border-radius:9px;padding:10px 12px;border:1px solid rgba(212,207,191,.12);background:rgba(212,207,191,.03)}',
        '.ck-teller b{display:block;font-family:"Baloo 2",sans-serif;font-weight:600;font-size:24px;line-height:1.1}',
        '.ck-teller span{font-size:12.5px;color:rgba(212,207,191,.65)}',
        '.ck-teller.laag b{color:#e9bd4f}.ck-teller.ok b{color:#7ba58a}.ck-teller.hoog b{color:#ef7a2a}.ck-teller.zuur b{color:#e0847d}',
        '.ck-ksig{margin:0;padding:0;list-style:none}',
        '.ck-ksig li{font-size:13.5px;line-height:1.5;color:rgba(212,207,191,.78);padding:8px 0;border-top:1px dashed rgba(212,207,191,.16)}',
        '.ck-ksig li:first-child{border-top:0;padding-top:0}',
        '.ck-ksig li b{font-weight:400;color:#e8e4d6}',
        '.ck-link{background:none;border:0;padding:0;font:inherit;color:#e0847d;cursor:pointer;text-decoration:underline;text-underline-offset:3px}',
        /* voeradvies: koppeladvies en inkooplijst */
        '.ck-koppel{padding:18px 22px 20px}',
        '.ck-koppel > p{margin:0 0 12px;font-size:13.5px;line-height:1.55;color:rgba(212,207,191,.75)}',
        '.ck-week{padding:10px 0;border-top:1px dashed rgba(212,207,191,.18);font-size:13.5px;line-height:1.55;color:rgba(212,207,191,.75)}',
        '.ck-week:first-of-type{border-top:0;padding-top:0}',
        '.ck-week-kop{display:flex;align-items:center;gap:9px}',
        '.ck-week-kop .wk{font-family:"JetBrains Mono",monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;color:#101a11;background:#b8a472;border-radius:99px;padding:3px 9px;white-space:nowrap}',
        '.ck-week-kop b{font-weight:400;font-size:13.5px;color:#e8e4d6}',
        '.ck-week p{margin:5px 0 7px}',
        '.ck-inkoop{margin-top:12px;border:1px solid rgba(212,207,191,.14);border-radius:9px;padding:12px 14px;background:rgba(212,207,191,.03)}',
        '.ck-inkoop h6{margin:0 0 8px;font-family:"JetBrains Mono",monospace;font-weight:400;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(212,207,191,.5)}',
        '.ck-inkoop-rij{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:baseline;padding:8px 0;border-top:1px dashed rgba(212,207,191,.15)}',
        '.ck-inkoop-rij:first-of-type{border-top:0;padding-top:2px}',
        '.ck-inkoop-rij .wat{font-size:13.5px;color:#e8e4d6}',
        '.ck-inkoop-rij .wat small{display:block;font-size:11px;color:rgba(212,207,191,.45)}',
        '.ck-inkoop-rij .kg{font-family:"JetBrains Mono",monospace;font-size:13px;color:#e9bd4f;white-space:nowrap}',
        '.ck-inkoop-rij .eenheid{font-size:12px;color:rgba(212,207,191,.6);white-space:nowrap}',
        '.ck-inkoop .noot{margin:8px 0 0;padding-top:8px;border-top:1px dashed rgba(212,207,191,.15);font-size:12px;line-height:1.5;color:rgba(212,207,191,.55)}',
        '.ck-inkoop .noot b{font-weight:400;color:#e9bd4f}',
        '.ck-inkoop.volgt{border-style:dashed;background:none}',
        '.ck-inkoop.volgt p{margin:0;font-size:12.5px;line-height:1.5;color:rgba(212,207,191,.55);font-style:italic}',
        '.ck-deel{display:flex;align-items:center;gap:8px;flex-wrap:wrap;border:1px dashed rgba(212,207,191,.25);border-radius:9px;padding:10px 13px;margin-top:12px}',
        '.ck-deelknop{font-family:"Jost",system-ui,sans-serif;font-weight:400;font-size:12.5px;color:#e8e4d6;background:rgba(212,207,191,.08);border:1px solid rgba(212,207,191,.3);border-radius:99px;padding:6px 14px;cursor:pointer;transition:background .2s ease-out,border-color .2s ease-out}',
        '.ck-deelknop:hover{background:rgba(212,207,191,.16);border-color:rgba(212,207,191,.5)}',
        '.ck-chip{display:inline-block;font-family:"JetBrains Mono",monospace;font-size:10.5px;letter-spacing:.04em;padding:4px 10px;border-radius:99px;border:1px solid rgba(184,164,114,.5);color:#b8a472;white-space:nowrap}',
        '.ck-toast{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);background:#e8e4d6;color:#101a11;font-size:12.5px;padding:8px 18px;border-radius:99px;box-shadow:0 10px 30px rgba(0,0,0,.4);opacity:0;pointer-events:none;transition:opacity .25s ease-out;z-index:5;white-space:nowrap}',
        '.ck-toast.aan{opacity:1}',
        /* hitte-alert bovenin */
        '.ck-alert{display:flex;gap:10px;align-items:center;padding:11px 18px;border-bottom:1px solid rgba(233,189,79,.4);border-left:3px solid #e9bd4f;background:rgba(233,189,79,.09);font-size:13px;line-height:1.5;color:rgba(212,207,191,.85)}',
        '.ck-alert .ico{flex:none;font-size:15px;line-height:1;color:#e9bd4f}',
        '.ck-alert b{font-weight:400;color:#e9bd4f}',
        '.ck-voetnoot{padding:9px 18px;border-top:1px solid rgba(212,207,191,.12);font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.08em;color:rgba(212,207,191,.38)}',
        '@media (max-width:760px){.ck-romp{grid-template-columns:minmax(0,1fr)}.ck-lijst{border-right:0;border-bottom:1px solid rgba(212,207,191,.14)}.ck-rijen{max-height:210px}',
        '    .ck-voer{grid-template-columns:1fr}.ck-ken{grid-template-columns:repeat(3,minmax(0,1fr))}.ck-tellers{grid-template-columns:repeat(2,minmax(0,1fr))}}',
        '@media (max-width:640px){.ck-inkoop-rij{grid-template-columns:1fr auto}.ck-inkoop-rij .eenheid{grid-column:1/-1;margin-top:-4px}}',
        '@media (max-width:520px){.ck-sig{grid-template-columns:1fr}.ck-detail,.ck-kudde,.ck-koppel{padding:16px}.ck-tabs button{padding:12px 8px 10px;letter-spacing:.06em}',
        '    .ck-legende{font-size:8.5px;letter-spacing:0}}'
    ].join('\n');

    var KLEUR = { laag: '#e9bd4f', ok: '#7ba58a', hoog: '#ef7a2a', zuur: '#c8524a' };
    var ZONE_LBL = { laag: 'te weinig energie', ok: 'op haar optimum', hoog: 'te veel krachtvoer', zuur: 'verzuringsrisico' };
    var VLAG = { kreupel: 'klauwen?', ketose: 'ketose?', buffert: 'buffert?' };

    /* de lat: x-positie voor een afwijking van haar optimum, op een breedte W */
    function schaal(W) { return function (afst) { var t = (afst + 1.6) / 3.2; return 10 + Math.max(0, Math.min(1, t)) * (W - 20); }; }
    var latX = schaal(560);
    function latVakken(X, W, y, h, dek) {
        var g1 = X(-0.3), g2 = X(0.3), g3 = X(0.8);
        function vak(x1, x2, rgb, a) { return '<rect x="' + x1.toFixed(1) + '" y="' + y + '" width="' + (x2 - x1).toFixed(1) + '" height="' + h + '" rx="4" fill="rgba(' + rgb + ',' + a + ')"/>'; }
        return vak(10, g1 - 1, '233,189,79', dek[0]) + vak(g1, g2 - 1, '123,165,138', dek[1]) +
            vak(g2, g3 - 1, '239,122,42', dek[2]) + vak(g3, W - 10, '200,82,74', dek[2]);
    }
    var LEGENDE = '<div class="ck-legende"><span class="laag">Te weinig energie</span><span class="ok">Optimum</span>' +
        '<span class="hoog">Te veel</span><span class="zuur">Verzuurt</span></div>';

    /* mini-grafiek: 14 dagen, stippellijn = haar norm */
    function spark(reeksen, norm, min, max) {
        var W = 260, H = 38, n = 14;
        function X(i) { return 3 + i * (W - 6) / (n - 1); }
        function Y(v) { return H - 4 - (Math.max(min, Math.min(max, v)) - min) / (max - min) * (H - 8); }
        var b = norm == null ? '' : '<line x1="3" x2="' + (W - 3) + '" y1="' + Y(norm).toFixed(1) + '" y2="' + Y(norm).toFixed(1) +
            '" stroke="rgba(212,207,191,.35)" stroke-dasharray="3 5" stroke-width="1" vector-effect="non-scaling-stroke"/>';
        return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' + b +
            reeksen.map(function (s) {
                var d = s.data.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(v).toFixed(1); }).join(' ');
                return '<path d="' + d + '" fill="none" stroke="' + s.kleur + '" stroke-width="1.8" stroke-linecap="round"' +
                    (s.streep ? ' stroke-dasharray="4 3"' : '') + ' vector-effect="non-scaling-stroke"/>';
            }).join('') + '</svg>';
    }

    /* haar positie op de lat */
    function gauge(k) {
        var g = (latX(-0.3) + latX(0.3)) / 2;
        return '<svg viewBox="0 0 560 46" aria-hidden="true">' + latVakken(latX, 560, 12, 22, [0.8, 0.62, 0.72]) +
            '<line x1="' + g + '" y1="6" x2="' + g + '" y2="40" stroke="rgba(212,207,191,.5)" stroke-dasharray="3 4" stroke-width="1"/>' +
            '<circle cx="' + latX(k.afst).toFixed(1) + '" cy="23" r="8" fill="' + KLEUR[k.zone] + '" stroke="#e8e4d6" stroke-width="2"/>' +
            '</svg>' + LEGENDE;
    }

    /* de koppel: elke koe een stip boven de lat, gestapeld per positie */
    /* smal scherm: kleinere tekenbreedte en bredere bakken, zodat de stippen groot genoeg blijven om aan te tikken */
    function zwerm(koeien, smal) {
        var W = smal ? 320 : 560, X = schaal(W), bak = smal ? 0.2 : 0.1;
        var R = 8, STAP = 18, bakken = {}, hoogste = 0;
        var stippen = koeien.map(function (k, i) {
            var b = Math.round((Math.max(-1.55, Math.min(1.55, k.afst)) + 1.6) / bak);
            var n = bakken[b] = (bakken[b] || 0) + 1;
            hoogste = Math.max(hoogste, n);
            return { k: k, i: i, x: X(b * bak - 1.6), n: n };
        });
        var H = hoogste * STAP + 14, basis = H - 4;
        return '<svg viewBox="0 0 ' + W + ' ' + (H + 26) + '" role="img" aria-label="Alle koeien op hun positie t.o.v. hun eigen optimum">' +
            latVakken(X, W, basis + 6, 14, [0.8, 0.62, 0.72]) +
            stippen.map(function (s) {
                return '<circle class="k" data-i="' + s.i + '" cx="' + s.x.toFixed(1) + '" cy="' + (basis - (s.n - 1) * STAP - R + 2) +
                    '" r="' + R + '" fill="' + KLEUR[s.k.zone] + '" stroke="#101a11" stroke-width="2"><title>' + s.k.naam + '</title></circle>';
            }).join('') + '</svg>' + LEGENDE;
    }

    function rangtel(n) { return n + 'e'; }

    function init() {
        var wortel = document.getElementById('cockpit');
        if (!wortel) return;
        var stijl = document.createElement('style'); stijl.textContent = css; document.head.appendChild(stijl);

        var koeien = maakKoppel(), filter = 'alle', huidig = koeien[0], scherm = 'koppel';
        var N = koeien.length;

        wortel.innerHTML =
            '<div class="ck" role="application" aria-label="Ruminate cockpit">' +
            '  <div class="ck-kop"><span class="ck-merk">rum<i>&#305;</i>nate</span><span class="ck-tag">cockpit &middot; demobedrijf &middot; ' + N + ' koeien</span></div>' +
            '  <div class="ck-alert" role="note"><span class="ico">&#9888;</span>' +
            '<span><b>Hitte-alert &middot; weersverwachting wo &gt;30&nbsp;&deg;C.</b> Alle koeien pensbestendig vet en buffer, tot 14 dagen na de hitte. Vers water, ventilatie en vers voer.</span></div>' +
            '  <nav class="ck-tabs" role="tablist">' +
            '    <button role="tab" data-s="koppel" class="aan">Koppel</button>' +
            '    <button role="tab" data-s="koe">Koe</button>' +
            '    <button role="tab" data-s="voer">Voeradvies</button>' +
            '  </nav>' +
            '  <div class="ck-view" data-v="koppel"><div class="ck-kudde" id="ckKudde"></div></div>' +
            '  <div class="ck-view" data-v="koe" hidden><div class="ck-romp">' +
            '    <div class="ck-lijst">' +
            '      <div class="ck-filters">' +
            '        <button data-f="alle" class="aan">Alle</button>' +
            '        <button data-f="aandacht">Aandacht</button>' +
            '        <button data-f="ok">Op optimum</button>' +
            '      </div>' +
            '      <div class="ck-rijen" id="ckRijen"></div>' +
            '    </div>' +
            '    <div class="ck-detail" id="ckDetail"></div>' +
            '  </div></div>' +
            '  <div class="ck-view" data-v="voer" hidden><div class="ck-koppel" id="ckVoer"></div></div>' +
            '  <div class="ck-voetnoot">demo-omgeving met voorbeelddata &middot; in productie gekoppeld aan melkrobot, halsband, melkcontrole (CRV) en weersverwachting</div>' +
            '</div>';

        var ck = wortel.querySelector('.ck');
        var rijen = wortel.querySelector('#ckRijen'), detail = wortel.querySelector('#ckDetail');

        function toonScherm(s) {
            scherm = s;
            wortel.querySelectorAll('.ck-tabs button').forEach(function (b) {
                var aan = b.getAttribute('data-s') === s; b.classList.toggle('aan', aan); b.setAttribute('aria-selected', aan);
            });
            wortel.querySelectorAll('.ck-view').forEach(function (v) { v.hidden = v.getAttribute('data-v') !== s; });
        }

        /* ---------- scherm 1: de koppel ---------- */
        (function () {
            var tel = { laag: 0, ok: 0, hoog: 0, zuur: 0 };
            koeien.forEach(function (k) { tel[k.zone]++; });
            function gem(f) { return koeien.reduce(function (s, k) { return s + f(k); }, 0) / N; }
            var dH = gem(function (k) { return (gem3(k.herkauw) / k.normH - 1) * 100; });
            var nZuur = tel.zuur;
            var vlaggen = koeien.filter(function (k) { return VLAG[k.profiel]; });
            wortel.querySelector('#ckKudde').innerHTML =
                '<div class="ck-paneel ck-zwerm"><h5>De koppel &middot; elke stip is één koe, t.o.v. haar eigen optimum &middot; modelschatting</h5><div id="ckZwerm"></div>' +
                '<p class="ck-hint">Klik op een stip voor haar kengetallen en advies.</p></div>' +
                '<div class="ck-tellers">' + ['laag', 'ok', 'hoog', 'zuur'].map(function (z) {
                    return '<div class="ck-teller ' + z + '"><b>' + tel[z] + '</b><span>' + ZONE_LBL[z] + '</span></div>';
                }).join('') + '</div>' +
                '<div class="ck-ken">' +
                '<div><span>Melk</span><b>' + nl(gem(function (k) { return gem3(k.melk); })) + ' kg</b></div>' +
                '<div><span>Vet</span><b>' + nl(gem(function (k) { return k.mpr[k.mpr.length - 1].vet; }), 2) + '%</b></div>' +
                '<div><span>Eiwit</span><b>' + nl(gem(function (k) { return k.mpr[k.mpr.length - 1].eiwit; }), 2) + '%</b></div>' +
                '<div><span>Lactose</span><b>' + nl(gem(function (k) { return k.mpr[k.mpr.length - 1].lactose; }), 2) + '%</b></div>' +
                '<div><span>Herkauwen</span><b>' + pct(dH) + '</b></div>' +
                '<div><span>Dag &lt; 120</span><b>' + koeien.filter(function (k) { return k.dim < 120; }).length + ' koeien</b></div></div>' +
                '<p class="ck-bron">Melk: robot, gemiddelde laatste 3 dagen &middot; vet, eiwit, lactose: melkcontrole van ' + datumTerug(10) +
                ' &middot; herkauwen: halsband, t.o.v. de eigen norm &middot; dagen in lactatie: CRV</p>' +
                '<div class="ck-paneel"><h5>Koppelsignalen</h5><ul class="ck-ksig">' +
                (nZuur >= 2 ? '<li><b>' + nZuur + ' koeien met verzuringssignalen tegelijk.</b> Dat wijst eerder naar het rantsoen dan naar de koe. Controleer aan het voerhek: ' +
                    'wordt het goed gemengd, of zoeken koeien het krachtvoer eruit? <button class="ck-link" data-naar="voer">Naar voeradvies</button></li>' : '') +
                '<li><b>Herkauwen koppel ' + (Math.abs(dH) < 3 ? 'stabiel' : (dH > 0 ? 'hoger' : 'lager')) + ' (' + pct(dH) + ' t.o.v. norm).</b> ' +
                    'Stijgt het bij de hele koppel, dan is het ruwvoer vaak grover; daalt het, dan vreet de koppel minder ruwvoer.</li>' +
                (vlaggen.length ? '<li><b>Nakijken:</b> ' + vlaggen.map(function (k) {
                    return '<button class="ck-link" data-koe="' + koeien.indexOf(k) + '">' + k.naam + '</button> (' + VLAG[k.profiel].replace('?', '') + ')';
                }).join(', ') + '.</li>' : '') +
                '</ul></div>';
        })();

        /* ---------- scherm 2: de koe ---------- */
        function tekenLijst() {
            rijen.innerHTML = koeien.filter(function (k) {
                var aandacht = k.zone !== 'ok' || VLAG[k.profiel];
                return filter === 'alle' || (filter === 'ok' ? !aandacht : aandacht);
            }).map(function (k) {
                return '<button class="ck-rij' + (k === huidig ? ' aan' : '') + '" data-i="' + koeien.indexOf(k) + '">' +
                    '<span class="ck-dot ' + k.zone + '"></span>' +
                    '<span class="n">' + k.naam + '<small>L' + k.lactatie + ' &middot; dag ' + k.dim +
                    (VLAG[k.profiel] ? ' &middot; <em>' + VLAG[k.profiel] + '</em>' : '') + '</small></span>' +
                    '<span class="m">' + nl(k.melk[13]) + ' kg</span></button>';
            }).join('');
        }

        function tegel(titel, sig, grafiek) {
            return '<div' + (sig.af ? ' class="af"' : '') + '><h6>' + titel + '</h6><span class="w">' + sig.tekst + '</span>' + grafiek + '</div>';
        }

        function tekenDetail() {
            var k = huidig, s = signalen(k), a = advies(k, s);
            var groen = '#7ba58a', rood = '#e0847d';
            function lijn(sig) { return sig.af ? rood : groen; }
            function bereik(r, norm, marge) { var all = r.concat([norm]); return [Math.min.apply(null, all) - marge, Math.max.apply(null, all) + marge]; }
            var bm = bereik(k.melk, k.basis, 1), bh = bereik(k.herkauw, k.normH, 15), be = bereik(k.eten, k.normE, 10), ba = bereik(k.act, 100, 4);
            var m = s.mpr.m, vo = s.mpr.vo;

            var doel = k.kv + a.kv.delta;
            var cijfer = a.kv.delta === 0
                ? '<b>' + nl(k.kv) + ' kg/dag</b><span class="delta nul">=</span>'
                : '<b>' + nl(k.kv) + '</b><span class="pijl">&rarr;</span><b>' + nl(doel) + ' kg/dag</b>' +
                  '<span class="delta ' + (a.kv.delta < 0 ? 'min' : 'plus') + '">' + (a.kv.delta > 0 ? '+' : '−') + nl(Math.abs(a.kv.delta)) + ' kg</span>';
            var kvKaart = '<div class="ck-vkaart"><h5>Advies &middot; krachtvoer aan de robot</h5>' +
                '<div class="cijfer">' + cijfer + '</div><div class="titel">' + a.kv.titel + '</div><p>' + a.kv.actie + '</p>' +
                '<p class="ck-bron">Robot, laatste 3 dagen: ' + (k.rest < 0.1 ? 'portie volledig opgenomen' : 'rest ' + nl(k.rest) + ' kg/dag') + '</p></div>';
            var extra = a.kaart ? '<div class="ck-vkaart ' + a.kaart.kl + '"><h5>' + a.kaart.kop + '</h5>' +
                '<div class="titel">' + a.kaart.titel + '</div><p>' + a.kaart.tekst + '</p></div>' : '';

            detail.innerHTML =
                '<div class="ck-dkop"><h4>' + k.naam + '</h4>' +
                '<span class="ck-badge ' + k.zone + '">' + ZONE_LBL[k.zone] + '</span>' +
                (VLAG[k.profiel] ? '<span class="ck-badge vlag">' + VLAG[k.profiel] + '</span>' : '') + '</div>' +
                '<div class="ck-ken">' +
                '<div><span>Leeftijd</span><b>' + k.leeftijd + ' jaar</b></div>' +
                '<div><span>Lactatie</span><b>' + rangtel(k.lactatie) + ' &middot; dag ' + k.dim + '</b></div>' +
                '<div><span>Melk</span><b' + (s.melk.af ? ' class="af"' : '') + '>' + nl(gem3(k.melk)) + ' kg</b></div>' +
                '<div><span>Vet</span><b' + (s.mpr.af ? ' class="af"' : '') + '>' + nl(m.vet, 2) + '%</b></div>' +
                '<div><span>Eiwit</span><b' + (s.mpr.eiwLaag || m.vet < m.eiwit ? ' class="af"' : '') + '>' + nl(m.eiwit, 2) + '%</b></div>' +
                '<div><span>Lactose</span><b' + (s.mpr.lacLaag ? ' class="af"' : '') + '>' + nl(m.lactose, 2) + '%</b></div></div>' +
                '<p class="ck-bron">Leeftijd en lactatie: CRV &middot; melk: robot, laatste 3 dagen &middot; vet, eiwit, lactose: melkcontrole van ' + m.datum +
                ' (dag ' + m.dag + ', celgetal ' + m.cel + ')' + (vo ? '; vorige ' + vo.datum + ': ' + nl(vo.vet, 2) + ' / ' + nl(vo.eiwit, 2) + ' / ' + nl(vo.lactose, 2) : '; daarvoor droog') + '</p>' +
                '<div class="ck-gauge"><h5>Voerbalans t.o.v. haar eigen optimum &middot; modelschatting</h5>' + gauge(k) + '</div>' +
                '<div class="ck-grond"><h5>Waarop gebaseerd</h5>' +
                '<p class="ck-conclusie">' + a.conclusie + '</p>' +
                '<div class="ck-sig">' +
                tegel('Melkgift &middot; robot', s.melk, spark([{ data: k.melk, kleur: lijn(s.melk) }], k.basis, bm[0], bm[1])) +
                tegel('Herkauwen &middot; halsband', s.herkauw, spark([{ data: k.herkauw, kleur: lijn(s.herkauw) }], k.normH, bh[0], bh[1])) +
                tegel('Vreettijd &middot; halsband', s.eten, spark([{ data: k.eten, kleur: lijn(s.eten) }], k.normE, be[0], be[1])) +
                tegel('Activiteit &middot; halsband', s.act, spark([{ data: k.act, kleur: lijn(s.act) }], 100, ba[0], ba[1])) +
                '</div><div class="ck-sig-voet">14 dagen &middot; stippellijn = haar eigen norm (melkgift: verwacht volgens haar lactatiecurve)' +
                (s.mpr.tekst ? ' &middot; melkcontrole: ' + s.mpr.tekst : '') + '</div></div>' +
                (extra ? '<div class="ck-voer">' + kvKaart + extra + '</div>' : kvKaart);
        }

        /* ---------- scherm 3: voeradvies voor de koppel ---------- */
        var inkoop, hitteTekst;
        (function () {
            var dagen = 30;
            var vers = koeien.filter(function (k) { return k.dim < 120; }).length;
            function rond(kg, stap) { return Math.ceil(kg / stap) * stap; }
            inkoop = [
                { wat: 'Pensbestendig vet (verzadigd, palmvetbasis)', basis: '300 g per koe per dag · ' + vers + ' koeien onder dag 120',
                  kg: rond(vers * 0.3 * dagen, 5), eenheid: Math.ceil(vers * 0.3 * dagen / 25) + ' zakken (à 25 kg)' },
                { wat: 'Pensbuffer (natriumbicarbonaat)', basis: '150 g per koe per dag · zelfde groep',
                  kg: rond(vers * 0.15 * dagen, 5), eenheid: Math.ceil(vers * 0.15 * dagen / 25) + ' zakken (à 25 kg)' }
            ];
            /* hitte: alle koeien vet + buffer; het vet 14 dagen doorvoeren, want de ruwvoeropname herstelt trager dan hij daalt */
            var hVet = rond(N * 0.3 * (5 + 14), 5), hBuf = rond(N * 0.15 * 5, 5);
            hitteTekst = 'Hittegolf: alle ' + N + ' koeien 300 g vet en 150 g buffer, en het vet nog 14 dagen doorvoeren. Per 5 warme dagen ±' +
                hVet + ' kg vet en ±' + hBuf + ' kg buffer extra.';
            var plan = [
                { maand: maand(1), titel: 'Energie zonder extra zetmeel',
                  tekst: 'Controleer eerst het rantsoen aan het voerhek: goed gemengd, en geen uitzoeken. Geef de ' + vers +
                      ' koeien onder dag 120 energie via pensbestendig vet in plaats van extra krachtvoer.' },
                { maand: maand(2), titel: 'Herbeoordelen met je voeradviseur',
                  tekst: 'Bij herstel terug naar het basisrantsoen; neem de melkcontrole en dit overzicht mee in het maandbezoek.' }
            ];
            var inkoopHtml = '<div class="ck-inkoop"><h6>Inkooplijst &middot; ' + maand(1) + ' &middot; ' + N + ' koeien</h6>' +
                inkoop.map(function (r) {
                    return '<div class="ck-inkoop-rij"><span class="wat">' + r.wat + '<small>' + r.basis + '</small></span>' +
                        '<span class="kg">±' + r.kg + ' kg</span><span class="eenheid">' + r.eenheid + '</span></div>';
                }).join('') + '<p class="noot"><b>&#9888;</b> ' + hitteTekst + ' Geen extra ruwvoer: bij hitte vreet ze daar juist minder van.</p></div>';
            var volgtHtml = '<div class="ck-inkoop volgt"><h6>Inkooplijst &middot; ' + maand(2) + '</h6>' +
                '<p>Volgt medio ' + maand(1).toLowerCase() + ', twee weken voor het maandbezoek van je voeradviseur.</p></div>';
            wortel.querySelector('#ckVoer').innerHTML =
                '<p>Koppeladvies voor het rantsoen aan het voerhek, met de inkooplijst voor de komende maand.</p>' +
                plan.map(function (w, i) {
                    return '<div class="ck-week"><div class="ck-week-kop"><span class="wk">' + w.maand + '</span><b>' + w.titel + '</b></div>' +
                        '<p>' + w.tekst + '</p>' + (i === 0 ? inkoopHtml : volgtHtml) + '</div>';
                }).join('') +
                '<div class="ck-deel">' +
                '<button class="ck-deelknop" type="button" data-actie="kopieer">Kopieer inkooplijst</button>' +
                '<button class="ck-deelknop" type="button">Deel met je voeradviseur</button>' +
                '<span class="ck-chip">integraties &middot; binnenkort</span></div>';
        })();

        var smal = window.matchMedia('(max-width:520px)');
        function tekenZwerm() { wortel.querySelector('#ckZwerm').innerHTML = zwerm(koeien, smal.matches); }
        tekenZwerm();
        if (smal.addEventListener) smal.addEventListener('change', tekenZwerm);

        function alles() { tekenLijst(); tekenDetail(); }
        function kiesKoe(i) {
            huidig = koeien[i]; filter = 'alle'; zetFilter(); alles(); toonScherm('koe');
            /* gestapelde weergave: de koe staat onder de lijst, dus breng haar in beeld */
            if (window.matchMedia('(max-width:760px)').matches) detail.scrollIntoView({ block: 'start' });
        }

        /* ---------- bediening ---------- */
        var toast = document.createElement('div');
        toast.className = 'ck-toast';
        ck.appendChild(toast);
        var toastTimer;
        function meld(t) {
            toast.textContent = t; toast.classList.add('aan');
            clearTimeout(toastTimer);
            toastTimer = setTimeout(function () { toast.classList.remove('aan'); }, 2400);
        }
        function zetFilter() {
            wortel.querySelectorAll('.ck-filters button').forEach(function (x) { x.classList.toggle('aan', x.getAttribute('data-f') === filter); });
        }

        ck.addEventListener('click', function (e) {
            var el;
            if ((el = e.target.closest('.ck-tabs button'))) return toonScherm(el.getAttribute('data-s'));
            if ((el = e.target.closest('circle.k, [data-koe]'))) return kiesKoe(+(el.getAttribute('data-i') || el.getAttribute('data-koe')));
            if ((el = e.target.closest('[data-naar]'))) return toonScherm(el.getAttribute('data-naar'));
            if ((el = e.target.closest('.ck-rij'))) { huidig = koeien[+el.getAttribute('data-i')]; return alles(); }
            if ((el = e.target.closest('.ck-filters button'))) { filter = el.getAttribute('data-f'); zetFilter(); return tekenLijst(); }
            if ((el = e.target.closest('.ck-deelknop'))) {
                if (el.getAttribute('data-actie') === 'kopieer') {
                    var tekst = 'Inkooplijst ' + maand(1) + ' · ' + N + ' koeien (Ruminate)\n' +
                        inkoop.map(function (r) { return '- ' + r.wat + ': ±' + r.kg + ' kg (' + r.eenheid + ')'; }).join('\n') + '\n' + hitteTekst;
                    try { navigator.clipboard.writeText(tekst).catch(function () {}); } catch (err) {}
                    meld('Inkooplijst gekopieerd');
                } else {
                    meld('Demo · deze koppeling bouwen we samen met de pilotbedrijven');
                }
            }
        });

        alles();
        toonScherm(scherm);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
